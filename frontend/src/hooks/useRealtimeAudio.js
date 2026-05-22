import { useState, useRef, useCallback, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// Voice session states
export const VOICE_STATES = {
  IDLE: 'IDLE',
  CONNECTING: 'CONNECTING',
  LISTENING: 'LISTENING',
  PROCESSING: 'PROCESSING',
  SPEAKING: 'SPEAKING',
};

// Error types for device compatibility
export const VOICE_ERRORS = {
  MIC_PERMISSION_DENIED: 'MIC_PERMISSION_DENIED',
  MIC_NOT_FOUND: 'MIC_NOT_FOUND',
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
};

/**
 * Hook for real-time voice conversation via Azure OpenAI gpt-4o-realtime
 * Features:
 * - State machine for voice states
 * - Ephemeral session token fetching
 * - Auto-reconnect with exponential backoff
 * - Session duration limit with warnings
 * - Message sync callbacks
 * - Device compatibility handling
 * - Sequential audio playback queue
 */
export default function useRealtimeAudio({
  conversationId = null,
  accessToken = null,
  personaId = null,
  onTranscript = null,
  onStateChange = null,
  onTimeWarning = null,
  maxDuration = 300000, // 5 minutes
} = {}) {
  const [state, setState] = useState(VOICE_STATES.IDLE);
  const [transcript, setTranscript] = useState(""); // AI transcript
  const [userTranscript, setUserTranscript] = useState(""); // User transcript
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null); // Warning state

  const wsRef = useRef(null);
  const realtimeModeRef = useRef('preview');
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const playbackQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const sourceNodeRef = useRef(null);
  const sessionStartRef = useRef(null);
  const durationIntervalRef = useRef(null);
  const maxDurationTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const sessionConfiguredTimeoutRef = useRef(null);
  const intentionalCloseRef = useRef(false);

  // Update state and notify
  const updateState = useCallback((newState) => {
    setState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  // Clear audio queue and stop playback
  const clearAudioQueue = useCallback(() => {
    playbackQueueRef.current = [];
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    isPlayingRef.current = false;
  }, []);

  // Play queued PCM16 audio chunks sequentially
  const playNextChunk = useCallback(() => {
    if (!audioCtxRef.current || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      // Return to listening after speaking (check current state)
      setState(currentState => {
        if (currentState === VOICE_STATES.SPEAKING) {
          onStateChange?.(VOICE_STATES.LISTENING);
          return VOICE_STATES.LISTENING;
        }
        return currentState;
      });
      return;
    }

    isPlayingRef.current = true;
    updateState(VOICE_STATES.SPEAKING);

    const pcmData = playbackQueueRef.current.shift();

    try {
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
    } catch (err) {
      console.error("Audio playback error:", err);
      // Continue to next chunk on error
      playNextChunk();
    }
  }, [onStateChange, updateState]);

  // Enqueue PCM16 audio for playback (base64 → Int16Array)
  const enqueueAudio = useCallback((base64Data) => {
    try {
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
    } catch (err) {
      console.error("Audio decode error:", err);
    }
  }, [playNextChunk]);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Clear timeouts
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (maxDurationTimeoutRef.current) {
      clearTimeout(maxDurationTimeoutRef.current);
      maxDurationTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (sessionConfiguredTimeoutRef.current) {
      clearTimeout(sessionConfiguredTimeoutRef.current);
      sessionConfiguredTimeoutRef.current = null;
    }

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

    // Clear audio queue
    clearAudioQueue();
  }, [clearAudioQueue]);

  // Stop voice session
  const stop = useCallback(() => {
    intentionalCloseRef.current = true;
    cleanup();
    updateState(VOICE_STATES.IDLE);
    setTranscript("");
    setUserTranscript("");
    setSessionDuration(0);
    setReconnectCount(0);
    setTimeRemaining(null);
    setError(null);
    setErrorType(null);
    sessionStartRef.current = null;
    realtimeModeRef.current = 'preview';
  }, [cleanup, updateState]);

  // Check browser compatibility
  const checkCompatibility = useCallback(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return { compatible: false, error: VOICE_ERRORS.BROWSER_NOT_SUPPORTED };
    }
    if (!window.AudioContext && !window.webkitAudioContext) {
      return { compatible: false, error: VOICE_ERRORS.BROWSER_NOT_SUPPORTED };
    }
    if (!window.AudioWorkletNode) {
      return { compatible: false, error: VOICE_ERRORS.BROWSER_NOT_SUPPORTED };
    }
    if (!window.WebSocket) {
      return { compatible: false, error: VOICE_ERRORS.BROWSER_NOT_SUPPORTED };
    }
    return { compatible: true, error: null };
  }, []);

  // Request mic permission with error handling
  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      return { success: true, stream };
    } catch (err) {
      console.error("Mic permission error:", err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return { success: false, error: VOICE_ERRORS.MIC_PERMISSION_DENIED };
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return { success: false, error: VOICE_ERRORS.MIC_NOT_FOUND };
      }
      return { success: false, error: VOICE_ERRORS.MIC_NOT_FOUND };
    }
  }, []);

  // Start voice session
  const start = useCallback(async () => {
    if (state !== VOICE_STATES.IDLE) {
      console.warn("Voice session already active");
      return;
    }

    intentionalCloseRef.current = false;
    setError(null);
    setErrorType(null);
    setTranscript("");
    setUserTranscript("");
    setTimeRemaining(null);
    updateState(VOICE_STATES.CONNECTING);

    // Check browser compatibility
    const { compatible, error: compatError } = checkCompatibility();
    if (!compatible) {
      setError("Your browser doesn't support voice conversations. Please use Chrome, Edge, or Safari.");
      setErrorType(compatError);
      updateState(VOICE_STATES.IDLE);
      return;
    }

    try {
      // 1. Request mic permission first (with detailed error handling)
      const { success: micSuccess, stream, error: micError } = await requestMicPermission();
      if (!micSuccess) {
        setErrorType(micError);
        if (micError === VOICE_ERRORS.MIC_PERMISSION_DENIED) {
          setError("Microphone access denied. Please allow microphone access in your browser settings.");
        } else {
          setError("No microphone found. Please connect a microphone and try again.");
        }
        updateState(VOICE_STATES.IDLE);
        return;
      }
      micStreamRef.current = stream;

      // 2. Fetch ephemeral session token from backend
      const sessionResponse = await fetch(`${API_BASE}/api/realtime/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
        },
        body: JSON.stringify({ conversationId, personaId }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        if (sessionResponse.status === 503) {
          setErrorType(VOICE_ERRORS.SERVICE_UNAVAILABLE);
          throw new Error('Voice service is not configured');
        }
        throw new Error(errorData.error || 'Failed to create voice session');
      }

      const sessionData = await sessionResponse.json();
      let { wsEndpoint } = sessionData;

      if (!wsEndpoint) {
        setErrorType(VOICE_ERRORS.SERVICE_UNAVAILABLE);
        throw new Error('Voice service not available');
      }

      // Add access token to WebSocket URL for authentication
      console.log("WebSocket endpoint from API:", wsEndpoint);
      if (accessToken) {
        const separator = wsEndpoint.includes('?') ? '&' : '?';
        wsEndpoint = `${wsEndpoint}${separator}token=${encodeURIComponent(accessToken)}`;
      }
      console.log("Connecting to WebSocket:", wsEndpoint.substring(0, 80) + '...');

      // 3. Set up AudioContext
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;

      // Resume audio context if suspended
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // 4. Load AudioWorklet for PCM capture
      await audioCtx.audioWorklet.addModule("/pcm-processor.js");
      const micSource = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, "pcm-processor");
      workletNodeRef.current = workletNode;

      // 5. Connect to Azure Realtime
      const ws = new WebSocket(wsEndpoint);
      wsRef.current = ws;
      realtimeModeRef.current = 'preview';

      // Track session start time
      sessionStartRef.current = Date.now();

      // Start duration tracking
      durationIntervalRef.current = setInterval(() => {
        if (sessionStartRef.current) {
          const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
          setSessionDuration(elapsed);

          // Calculate time remaining for warning
          const remaining = Math.ceil((maxDuration - (Date.now() - sessionStartRef.current)) / 1000);
          if (remaining <= 60 && remaining > 0) {
            setTimeRemaining(remaining);
          }
        }
      }, 1000);

      // Set warning timeout (1 minute before end)
      warningTimeoutRef.current = setTimeout(() => {
        setTimeRemaining(60);
        onTimeWarning?.(60);
      }, maxDuration - 60000);

      // Set max duration timeout
      maxDurationTimeoutRef.current = setTimeout(() => {
        console.log("Voice session max duration reached");
        setTimeRemaining(0);
        stop();
      }, maxDuration);

      ws.onopen = () => {
        console.log("Voice WS connected successfully");
        // Session config is handled by the backend proxy
        sessionConfiguredTimeoutRef.current = setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN && state !== VOICE_STATES.LISTENING) {
            setError("Voice session setup timed out");
            setErrorType(VOICE_ERRORS.CONNECTION_FAILED);
            ws.close();
          }
        }, 12000);
      };

      ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }

        switch (msg.type) {
          case "visualearn.realtime_mode":
            realtimeModeRef.current = msg.mode || 'preview';
            console.log("Realtime mode:", realtimeModeRef.current, msg.deployment || '');
            break;

          case "session.created":
          case "translation_session.created":
            // Session created - wait for session.updated before starting mic
            // Backend proxy sends session.update with personalization config
            console.log("Session created:", msg.session?.id);
            setReconnectCount(0);
            break;

          case "session.updated":
          case "translation_session.updated":
            // Session fully configured - NOW start mic pipeline
            console.log("Session configured, starting mic");
            if (sessionConfiguredTimeoutRef.current) {
              clearTimeout(sessionConfiguredTimeoutRef.current);
              sessionConfiguredTimeoutRef.current = null;
            }
            updateState(VOICE_STATES.LISTENING);
            // Start mic → worklet → WS pipeline
            micSource.connect(workletNode);
            workletNode.connect(audioCtx.destination);
            workletNode.port.onmessage = (e) => {
              if (e.data.type === "audio" && ws.readyState === WebSocket.OPEN) {
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
            updateState(VOICE_STATES.LISTENING);
            // Stop any current AI playback when user starts speaking
            clearAudioQueue();
            break;

          case "input_audio_buffer.speech_stopped":
            updateState(VOICE_STATES.PROCESSING);
            if (realtimeModeRef.current === 'ga' && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
              ws.send(JSON.stringify({
                type: "response.create",
                response: {
                  modalities: ["text", "audio"],
                },
              }));
            }
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

          case "translation.audio.delta":
          case "translation.output_audio.delta":
            if (msg.delta) enqueueAudio(msg.delta);
            break;

          case "translation.transcript.delta":
          case "translation.output_text.delta":
            setTranscript(prev => prev + (msg.delta || ""));
            break;

          case "response.done":
          case "translation.done":
            // Audio queue will handle state transition when done
            if (!isPlayingRef.current) {
              updateState(VOICE_STATES.LISTENING);
            }
            // Reset transcript for next turn after a short delay
            setTimeout(() => setTranscript(""), 500);
            break;

          // Custom message from our backend for saved messages
          case "visualearn.message_saved":
            if (msg.messageId) {
              onTranscript?.(msg.role, msg.transcript, msg.messageId);
            }
            break;

          case "error":
            console.error("Realtime error:", msg.error);
            setError(typeof msg.error === "string" ? msg.error : msg.error?.message || "Unknown error");
            setErrorType(VOICE_ERRORS.CONNECTION_FAILED);
            break;

          default:
            if (typeof msg.type === 'string') {
              if (msg.type.endsWith('.audio.delta') && msg.delta) {
                enqueueAudio(msg.delta);
              } else if (msg.type.endsWith('.transcript.delta') && msg.delta) {
                setTranscript(prev => prev + msg.delta);
              }
            }
            break;
        }
      };

      ws.onerror = (err) => {
        console.error("Voice WS error:", err);
        setError("Connection failed");
        setErrorType(VOICE_ERRORS.CONNECTION_FAILED);
      };

      ws.onclose = (event) => {
        console.log("Voice WS closed:", event.code, event.reason);

        // Only attempt reconnect if not intentionally closed
        if (!intentionalCloseRef.current && state !== VOICE_STATES.IDLE && reconnectCount < 3) {
          const backoffMs = Math.min(1000 * Math.pow(2, reconnectCount), 30000);
          console.log(`Reconnecting in ${backoffMs}ms (attempt ${reconnectCount + 1})`);

          setReconnectCount(prev => prev + 1);
          cleanup();

          reconnectTimeoutRef.current = setTimeout(() => {
            start();
          }, backoffMs);
        } else if (!intentionalCloseRef.current) {
          setError("Connection lost. Please try again.");
          setErrorType(VOICE_ERRORS.CONNECTION_FAILED);
          cleanup();
          updateState(VOICE_STATES.IDLE);
        }
      };

    } catch (err) {
      console.error("Voice start error:", err);
      setError(err.message);
      if (!errorType) {
        setErrorType(VOICE_ERRORS.CONNECTION_FAILED);
      }
      cleanup();
      updateState(VOICE_STATES.IDLE);
    }
  }, [
    accessToken,
    checkCompatibility,
    cleanup,
    clearAudioQueue,
    conversationId,
    enqueueAudio,
    errorType,
    maxDuration,
    onTimeWarning,
    onTranscript,
    personaId,
    reconnectCount,
    requestMicPermission,
    state,
    stop,
    updateState,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    isActive: state !== VOICE_STATES.IDLE,
    isConnecting: state === VOICE_STATES.CONNECTING,
    isListening: state === VOICE_STATES.LISTENING,
    isProcessing: state === VOICE_STATES.PROCESSING,
    isSpeaking: state === VOICE_STATES.SPEAKING,
    transcript,
    userTranscript,
    error,
    errorType,
    sessionDuration,
    timeRemaining,
    reconnectCount,
    start,
    stop,
  };
}
