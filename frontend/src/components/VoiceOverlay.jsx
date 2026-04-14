import { useEffect, useRef, useState } from "react";

/**
 * Full-screen voice conversation overlay with waveform animation and live transcript
 */
export default function VoiceOverlay({ voice }) {
  const { isActive, isConnecting, isAISpeaking, isListening, transcript, userTranscript, error, stop } = voice;
  const canvasRef = useRef(null);
  const animFrame = useRef(null);
  const [dots, setDots] = useState("");

  // Animated dots for "Listening..."
  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 500);
    return () => clearInterval(iv);
  }, []);

  // Waveform animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width = 280;
    const h = canvas.height = 80;
    let phase = 0;

    const draw = () => {
      phase += 0.06;
      ctx.clearRect(0, 0, w, h);

      const active = isAISpeaking || isListening;
      const amplitude = active ? (isAISpeaking ? 25 : 12) : 3;
      const color = isAISpeaking ? "#6366f1" : isListening ? "#22c55e" : "#64748b";

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = active ? 12 : 4;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        const t = (x / w) * Math.PI * 4;
        const y = h / 2 +
          Math.sin(t + phase) * amplitude * 0.6 +
          Math.sin(t * 1.5 + phase * 1.3) * amplitude * 0.3 +
          Math.sin(t * 0.5 + phase * 0.7) * amplitude * 0.1;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Secondary wave
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const t = (x / w) * Math.PI * 3;
        const y = h / 2 +
          Math.sin(t + phase * 1.2 + 1) * amplitude * 0.5 +
          Math.sin(t * 2 + phase * 0.8) * amplitude * 0.2;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      animFrame.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animFrame.current);
  }, [isAISpeaking, isListening]);

  if (!isActive && !isConnecting) return null;

  const statusText = isConnecting
    ? "Connecting" + dots
    : isAISpeaking
      ? "AI Speaking"
      : isListening
        ? "Listening" + dots
        : "Ready";

  const statusColor = isConnecting
    ? "text-yellow-400"
    : isAISpeaking
      ? "text-indigo-400"
      : isListening
        ? "text-green-400"
        : "text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl animate-fadeIn">
      {/* Pulse ring behind mic */}
      <div className="relative mb-8">
        <div className={`absolute inset-0 rounded-full ${isAISpeaking ? "bg-indigo-500/20 animate-ping" : isListening ? "bg-green-500/20 animate-ping" : ""}`}
          style={{ width: 120, height: 120, top: -20, left: -20 }} />
        <div className={`w-20 h-20 rounded-full flex items-center justify-center ${isAISpeaking ? "bg-indigo-500/30 ring-2 ring-indigo-400" : isListening ? "bg-green-500/30 ring-2 ring-green-400" : "bg-slate-700"} transition-all duration-500`}>
          <svg viewBox="0 0 24 24" className={`w-8 h-8 ${isAISpeaking ? "text-indigo-400" : isListening ? "text-green-400" : "text-slate-400"} transition-colors`} fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </div>
      </div>

      {/* Status */}
      <p className={`text-lg font-medium mb-6 ${statusColor} transition-colors`}>
        {statusText}
      </p>

      {/* Waveform */}
      <canvas ref={canvasRef} className="mb-8 opacity-80" />

      {/* Transcripts */}
      <div className="w-full max-w-md px-6 space-y-3 min-h-[80px]">
        {userTranscript && (
          <div className="text-right">
            <span className="text-xs text-slate-500 mb-1 block">You</span>
            <p className="text-sm text-slate-300 bg-slate-800/50 rounded-xl px-4 py-2 inline-block max-w-full">
              {userTranscript}
            </p>
          </div>
        )}
        {transcript && (
          <div className="text-left">
            <span className="text-xs text-slate-500 mb-1 block">VisuaLearn AI</span>
            <p className="text-sm text-white bg-indigo-500/20 rounded-xl px-4 py-2 inline-block max-w-full">
              {transcript}
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm mt-4 bg-red-500/10 rounded-lg px-4 py-2">
          ⚠️ {error}
        </p>
      )}

      {/* End call button */}
      <button
        onClick={stop}
        className="mt-8 w-14 h-14 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center transition-all hover:scale-110 shadow-lg shadow-red-500/30"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 004.1.7 2 2 0 012 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 015.71 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L9.69 9.91a16 16 0 00.99 3.4z" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      </button>

      <p className="text-xs text-slate-600 mt-4">Tap to end conversation</p>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}
