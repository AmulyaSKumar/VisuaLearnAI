import { VOICE_STATES } from "../hooks/useRealtimeAudio";

/**
 * Voice toggle button for chat header
 * Shows mic icon with state-based styling
 */
export default function VoiceToggleButton({
  state,
  onToggle,
  disabled = false,
}) {
  const isActive = state !== VOICE_STATES.IDLE;
  const isConnecting = state === VOICE_STATES.CONNECTING;

  // Determine button styling based on state
  const getButtonClasses = () => {
    if (disabled) {
      return "bg-muted/50 text-muted-foreground cursor-not-allowed";
    }
    if (isConnecting) {
      return "bg-yellow-500/20 text-yellow-500 animate-pulse";
    }
    if (isActive) {
      return "bg-red-500/20 text-red-500 hover:bg-red-500/30";
    }
    return "bg-primary/10 text-primary hover:bg-primary/20";
  };

  // Get title text
  const getTitle = () => {
    if (disabled) return "Voice not available";
    if (isConnecting) return "Connecting...";
    if (isActive) return "Stop voice conversation";
    return "Start voice conversation";
  };

  return (
    <button
      onClick={onToggle}
      disabled={disabled || isConnecting}
      className={`
        flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5
        min-h-[36px] min-w-[36px] rounded-lg text-xs font-medium
        transition-all duration-200
        ${getButtonClasses()}
      `}
      title={getTitle()}
    >
      {/* Mic icon */}
      <svg
        viewBox="0 0 24 24"
        className={`w-4 h-4 ${isActive ? "animate-pulse" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        {isActive ? (
          // Active mic with waves
          <>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
            {/* Sound waves */}
            <path d="M8 5.5c-1 .5-1.5 1.5-1.5 2.5" strokeWidth="1.5" className="animate-pulse" />
            <path d="M16 5.5c1 .5 1.5 1.5 1.5 2.5" strokeWidth="1.5" className="animate-pulse" />
          </>
        ) : (
          // Inactive mic
          <>
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </>
        )}
      </svg>

      {/* Label on larger screens */}
      <span className="hidden sm:inline">
        {isConnecting ? "Connecting" : isActive ? "Stop" : "Voice"}
      </span>
    </button>
  );
}
