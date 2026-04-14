import { useState, useRef, useCallback, useEffect } from "react";

const WS_BASE_URL = "ws://localhost:3001/ws/realtime";

/**
 * Hook for real-time voice conversation via gpt-realtime-1.5
 * Handles: WebSocket connection, mic capture (AudioWorklet), audio playback
 * @param {string} userId - Optional user ID for personalization
 */
export default function useRealtimeAudio(userId = null) {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState(""); // AI transcript
  const [userTranscript, setUserTranscript] = useState(""); // User transcript
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const playbackQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const sourceNodeRef = useRef(null);

  // Play queued PCM16 audio chunks
  const playNextChunk = useCallback(() => {
    if (!audioCtxRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsAISpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsAISpeaking(true);

    const pcmData = playbackQueueRef.current.shift();
    const float32 = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      float32[i] = pcmData[i] / 32768;
    }

    const buffer = audioCtxRef.current.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtxRef.current.destination);
    source.onended = playNextChunk;
    source.start();
    sourceNodeRef.current = source;
  }, []);

  // Enqueue PCM16 audio for playback (base64 → Int16Array)
  const enqueueAudio = useCallback((base64Data) => {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    playbackQueueRef.current.push(int16);

    if (!isPlayingRef.current) {
      playNextChunk();
    }
  }, [playNextChunk]);

  // Start voice session
  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    setUserTranscript("");
    setIsConnecting(true);

    try {
      // 1. Set up AudioContext
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      audioCtxRef.current = audioCtx;

      // 2. Get mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // 3. Load AudioWorklet for PCM capture
      await audioCtx.audioWorklet.addModule("/pcm-processor.js");
      const micSource = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
      workletNodeRef.current = workletNode;

      // 4. Connect to backend WebSocket proxy with userId for personalization
      const wsUrl = userId ? `${WS_BASE_URL}?userId=${userId}` : WS_BASE_URL;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("🎙️ Voice WS connected");
      };

      ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }

        switch (msg.type) {
          case "session.created":
            console.log("✅ Session created:", msg.session?.id);
            // Configure the session
            ws.send(JSON.stringify({
              type: "session.update",
              session: {
                voice: "alloy",
                instructions: "You are VisuaLearn AI, a helpful and friendly tutor. Keep your responses concise and natural. Speak like a real tutor would.",
                modalities: ["text", "audio"],
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                input_audio_transcription: { model: "whisper-1" },
                turn_detection: {
                  type: "server_vad",
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                  create_response: true,
                },
              },
            }));
            break;

          case "session.updated":
            console.log("✅ Session configured");
            setIsConnecting(false);
            setIsActive(true);
            setIsListening(true);
            // Start mic → worklet → WS pipeline
            micSource.connect(workletNode);
            workletNode.connect(audioCtx.destination); // needed for worklet to run
            workletNode.port.onmessage = (e) => {
              if (e.data.type === "audio" && ws.readyState === WebSocket.OPEN) {
                // Convert ArrayBuffer to base64 on the main thread where btoa is available
                const uint8 = new Uint8Array(e.data.data);
                let binary = "";
                for (let i = 0; i < uint8.length; i++) {
                  binary += String.fromCharCode(uint8[i]);
                }
                const base64 = btoa(binary);

                ws.send(JSON.stringify({
                  type: "input_audio_buffer.append",
                  audio: base64,
                }));
              }
            };
            break;

          case "input_audio_buffer.speech_started":
            setIsListening(true);
            setIsAISpeaking(false);
            // Stop any current AI playback when user starts speaking
            playbackQueueRef.current = [];
            if (sourceNodeRef.current) {
              try { sourceNodeRef.current.stop(); } catch {}
              sourceNodeRef.current = null;
            }
            isPlayingRef.current = false;
            break;

          case "input_audio_buffer.speech_stopped":
            setIsListening(false);
            break;

          case "conversation.item.input_audio_transcription.completed":
            if (msg.transcript) {
              setUserTranscript(msg.transcript);
            }
            break;

          case "response.audio_transcript.delta":
            setTranscript(prev => prev + (msg.delta || ""));
            break;

          case "response.audio.delta":
            if (msg.delta) enqueueAudio(msg.delta);
            break;

          case "response.done":
            setIsListening(true);
            // Reset transcript for next turn after a short delay
            setTimeout(() => setTranscript(""), 200);
            break;

          case "error":
            console.error("Realtime error:", msg.error);
            setError(typeof msg.error === "string" ? msg.error : msg.error?.message || "Unknown error");
            break;
        }
      };

      ws.onerror = () => {
        setError("Connection failed");
        setIsConnecting(false);
      };

      ws.onclose = () => {
        setIsActive(false);
        setIsConnecting(false);
        setIsListening(false);
      };

    } catch (err) {
      console.error("Voice start error:", err);
      setError(err.message);
      setIsConnecting(false);
    }
  }, [enqueueAudio]);

  // Stop voice session
  const stop = useCallback(() => {
    // Close WebSocket
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }
    wsRef.current = null;

    // Stop mic
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

    // Disconnect worklet
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Close audio context
    if (audioCtxRef.current?.state !== "closed") {
      audioCtxRef.current?.close();
    }
    audioCtxRef.current = null;

    // Stop playback
    playbackQueueRef.current = [];
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    isPlayingRef.current = false;

    setIsActive(false);
    setIsConnecting(false);
    setIsAISpeaking(false);
    setIsListening(false);
    setTranscript("");
    setUserTranscript("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    isActive,
    isConnecting,
    isAISpeaking,
    isListening,
    transcript,
    userTranscript,
    error,
    start,
    stop,
  };
}
