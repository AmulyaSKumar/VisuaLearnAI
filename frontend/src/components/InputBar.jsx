import { useState, useEffect, useCallback } from "react";
import { useSpeechToText } from "../hooks/useSpeechToText";

// New intuitive modes
const MODES = [
  { id: 'quick', label: 'Quick Learn', icon: '⚡', description: 'Brief overview' },
  { id: 'deep', label: 'Understand Deeply', icon: '🧠', description: 'Comprehensive explanation' },
  { id: 'expert', label: 'Expert Mode', icon: '🎓', description: 'Technical details' },
];

// Learning styles
const STYLES = [
  { id: 'story', label: 'Tell a Story', icon: '📖', description: 'Narrative approach' },
  { id: 'code', label: 'With Code', icon: '💻', description: 'Code examples' },
  { id: 'steps', label: 'Step by Step', icon: '📝', description: 'Sequential guide' },
  { id: 'compare', label: 'Compare', icon: '⚖️', description: 'Comparisons & contrasts' },
];

// Rotating placeholder suggestions
const PLACEHOLDERS = [
  "How does machine learning work?",
  "Explain quantum computing like I'm 5",
  "What's the difference between DNA and RNA?",
  "How do neural networks learn?",
  "What causes climate change?",
  "Explain blockchain in simple terms",
  "How does the stock market work?",
  "What is photosynthesis?",
];

export default function InputBar({ onSend, inputDisabled = false, onVoiceStart, showPreferences = true }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("deep");
  const [style, setStyle] = useState("story");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  // Speech-to-text
  const {
    isListening,
    isSupported: sttSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    clearTranscript,
  } = useSpeechToText({
    onResult: (text) => {
      setInput(prev => prev + text);
    },
  });

  // Rotate placeholders
  useEffect(() => {
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 200);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || inputDisabled) return;
    // Send message with preferences
    onSend(input, { mode, style });
    setInput("");
    clearTranscript();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClear = () => {
    setInput("");
    clearTranscript();
  };

  const handleVoiceClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const displayText = input + (interimTranscript ? ` ${interimTranscript}` : '');

  return (
    <div className="w-full space-y-3">
      {/* Preferences Panel - shown when input has text */}
      {showPreferences && input.trim() && (
        <div className="flex flex-col gap-3 px-3 py-3 bg-muted/30 rounded-lg border border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Mode Selection */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium">Learning Mode</span>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all border ${
                    mode === m.id
                      ? 'bg-primary/10 border-primary/50 text-foreground'
                      : 'bg-background border-border hover:bg-muted hover:border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  <span>{m.icon}</span>
                  <span className="text-sm font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style Selection */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground font-medium">Explain it</span>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all border ${
                    style === s.id
                      ? 'bg-primary/10 border-primary/50 text-foreground'
                      : 'bg-background border-border hover:bg-muted hover:border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  <span>{s.icon}</span>
                  <span className="text-sm font-medium">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSubmit}
        className="w-full relative flex items-center bg-sidebar border border-sidebar-border rounded-xl focus-within:ring-1 focus-within:ring-ring focus-within:border-ring shadow-sm overflow-hidden"
      >
        {/* Upload button - hidden on very small screens */}
        <button
          type="button"
          className="hidden sm:flex flex-shrink-0 w-10 h-10 min-h-[44px] min-w-[44px] ml-1 rounded-md items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.81825 1.18188C7.64251 1.00615 7.35759 1.00615 7.18185 1.18188L4.18185 4.18188C4.00611 4.35762 4.00611 4.64254 4.18185 4.81828C4.35759 4.99401 4.64251 4.99401 4.81825 4.81828L7.05005 2.58648V9.49996C7.05005 9.74849 7.25152 9.94996 7.50005 9.94996C7.74858 9.94996 7.95005 9.74849 7.95005 9.49996V2.58648L10.1819 4.81828C10.3576 4.99401 10.6425 4.99401 10.8182 4.81828C10.994 4.64254 10.994 4.35762 10.8182 4.18188L7.81825 1.18188ZM2.5 9.99997C2.77614 9.99997 3 10.2238 3 10.5V12C3 12.5538 3.44565 13 3.99635 13H11.0012C11.5511 13 12 12.5528 12 12V10.5C12 10.2238 12.2239 9.99997 12.5 9.99997C12.7761 9.99997 13 10.2238 13 10.5V12C13 13.1062 12.1062 14 11.0012 14H3.99635C2.89019 14 2 13.103 2 12V10.5C2 10.2238 2.22386 9.99997 2.5 9.99997Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
        </button>

        <input
          type="text"
          value={displayText}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={showPlaceholder ? PLACEHOLDERS[placeholderIndex] : ''}
          disabled={inputDisabled}
          className={`flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm sm:text-[15px] py-3 sm:py-4 px-3 sm:px-2 text-foreground placeholder:text-muted-foreground disabled:opacity-50 transition-opacity ${
            showPlaceholder ? 'placeholder:opacity-100' : 'placeholder:opacity-0'
          }`}
        />

        <div className="flex items-center gap-1 sm:gap-2 pr-2">
          {/* Clear button */}
          {displayText && (
            <button
              type="button"
              onClick={handleClear}
              className="w-8 h-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent flex items-center justify-center transition-colors"
              title="Clear"
            >
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
              </svg>
            </button>
          )}

          {/* Voice input button (Speech-to-Text) */}
          {sttSupported && (
            <button
              type="button"
              onClick={handleVoiceClick}
              className={`w-10 h-10 min-h-[44px] min-w-[44px] rounded-md flex items-center justify-center transition-colors ${
                isListening
                  ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
                  : 'bg-sidebar-accent hover:bg-sidebar-border text-foreground'
              }`}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 11C8.88071 11 10 9.88071 10 8.5V4.5C10 3.11929 8.88071 2 7.5 2C6.11929 2 5 3.11929 5 4.5V8.5C5 9.88071 6.11929 11 7.5 11ZM7.5 10C8.32843 10 9 9.32843 9 8.5V4.5C9 3.67157 8.32843 3 7.5 3C6.67157 3 6 3.67157 6 4.5V8.5C6 9.32843 6.67157 10 7.5 10Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path><path d="M2.5 8C2.5 7.72386 2.27614 7.5 2 7.5C1.72386 7.5 1.5 7.72386 1.5 8C1.5 11.0858 3.84439 13.6231 6.84065 13.966V15H8.15935V13.966C11.1556 13.6231 13.5 11.0858 13.5 8C13.5 7.72386 13.2761 7.5 13 7.5C12.7239 7.5 12.5 7.72386 12.5 8C12.5 10.7614 10.2614 13 7.5 13C4.73858 13 2.5 10.7614 2.5 8Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            </button>
          )}

          {/* Send button */}
          {displayText.trim() && (
            <button
              type="submit"
              disabled={inputDisabled}
              className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-md bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            </button>
          )}
        </div>
      </form>

      {/* Voice listening indicator */}
      {isListening && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-rose-600 dark:text-rose-400 animate-in fade-in duration-200">
          <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          <span>Listening... speak now</span>
        </div>
      )}
    </div>
  );
}
