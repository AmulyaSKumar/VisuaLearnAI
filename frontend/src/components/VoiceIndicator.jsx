import { useEffect, useRef } from "react";
import { VOICE_STATES } from "../hooks/useRealtimeAudio";

/**
 * Inline voice status indicator bar
 * Shows state, transcript, and duration
 */
export default function VoiceIndicator({
  state,
  transcript,
  userTranscript,
  sessionDuration,
  error,
  onStop,
}) {
  const waveformRef = useRef(null);
  const animationRef = useRef(null);

  // Waveform animation for speaking state
  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    let phase = 0;

    const draw = () => {
      phase += 0.08;
      ctx.clearRect(0, 0, w, h);

      const isSpeaking = state === VOICE_STATES.SPEAKING;
      const isListening = state === VOICE_STATES.LISTENING;
      const amplitude = isSpeaking ? 12 : isListening ? 6 : 2;

      // Determine color based on state
      let color;
      if (isSpeaking) color = "#6366f1"; // indigo
      else if (isListening) color = "#22c55e"; // green
      else color = "#64748b"; // slate

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const t = (x / w) * Math.PI * 4;
        const y = h / 2 +
          Math.sin(t + phase) * amplitude * 0.7 +
          Math.sin(t * 1.5 + phase * 1.2) * amplitude * 0.3;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state]);

  // Format duration as mm:ss
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get status text and color
  const getStatusInfo = () => {
    switch (state) {
      case VOICE_STATES.CONNECTING:
        return { text: "Connecting...", color: "text-yellow-500", bgColor: "bg-yellow-500/10" };
      case VOICE_STATES.LISTENING:
        return { text: "Listening", color: "text-green-500", bgColor: "bg-green-500/10" };
      case VOICE_STATES.PROCESSING:
        return { text: "Processing", color: "text-amber-500", bgColor: "bg-amber-500/10" };
      case VOICE_STATES.SPEAKING:
        return { text: "Speaking", color: "text-indigo-500", bgColor: "bg-indigo-500/10" };
      default:
        return { text: "Ready", color: "text-muted-foreground", bgColor: "bg-muted/50" };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusInfo.bgColor}`}>
            {/* Animated dot */}
            <span className={`w-2 h-2 rounded-full ${statusInfo.color.replace("text-", "bg-")} ${
              state === VOICE_STATES.LISTENING || state === VOICE_STATES.SPEAKING
                ? "animate-pulse"
                : ""
            }`} />
            <span className={`text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>

          {/* Waveform */}
          <canvas
            ref={waveformRef}
            width={80}
            height={24}
            className="opacity-80"
          />

          {/* Transcript display */}
          <div className="flex-1 min-w-0">
            {error ? (
              <p className="text-xs text-red-500 truncate">{error}</p>
            ) : transcript ? (
              <p className="text-xs text-foreground truncate">
                <span className="text-indigo-500 font-medium">AI: </span>
                {transcript}
              </p>
            ) : userTranscript ? (
              <p className="text-xs text-muted-foreground truncate">
                <span className="text-green-500 font-medium">You: </span>
                {userTranscript}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {state === VOICE_STATES.LISTENING
                  ? "Speak now..."
                  : state === VOICE_STATES.CONNECTING
                    ? "Setting up voice..."
                    : ""}
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="text-xs text-muted-foreground font-mono">
            {formatDuration(sessionDuration)}
          </div>

          {/* Stop button */}
          <button
            onClick={onStop}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
            title="End voice session"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5"
              fill="currentColor"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
