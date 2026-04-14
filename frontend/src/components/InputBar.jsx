import { useState } from "react";

const MODES = [
  { id: 'simple', label: 'Simple' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'technical', label: 'Technical' },
];

const STYLES = [
  { id: 'visual', label: 'Visual' },
  { id: 'interactive', label: 'Interactive' },
  { id: 'audio', label: 'Audio' },
];

export default function InputBar({ onSend, inputDisabled = false, onVoiceStart, showPreferences = true }) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("balanced");
  const [style, setStyle] = useState("visual");
  const [showOptions, setShowOptions] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || inputDisabled) return;
    // Send message with preferences
    onSend(input, { mode, style });
    setInput("");
    setShowOptions(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Preferences Panel - shown when input has text */}
      {showPreferences && input.trim() && (
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 bg-muted/30 rounded-lg border border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Mode Selection */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground font-medium flex-shrink-0">Mode:</span>
            <div className="flex gap-1 flex-wrap">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`px-2 sm:px-2.5 py-1.5 min-h-[32px] text-xs rounded-md transition-all ${
                    mode === m.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden sm:block w-px h-4 bg-border" />

          {/* Style Selection */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground font-medium flex-shrink-0">Style:</span>
            <div className="flex gap-1 flex-wrap">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`px-2 sm:px-2.5 py-1.5 min-h-[32px] text-xs rounded-md transition-all ${
                    style === s.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {s.label}
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What would you like to learn today?"
          disabled={inputDisabled}
          className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm sm:text-[15px] py-3 sm:py-4 px-3 sm:px-2 text-foreground placeholder:text-muted-foreground disabled:opacity-50"
        />

        <div className="flex items-center gap-1 sm:gap-2 pr-2">
          {/* Send or Mic button */}
          {input.trim() ? (
            <button
              type="submit"
              disabled={inputDisabled}
              className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-md bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={onVoiceStart}
              className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-md bg-sidebar-accent hover:bg-sidebar-border text-foreground flex items-center justify-center transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 11C8.88071 11 10 9.88071 10 8.5V4.5C10 3.11929 8.88071 2 7.5 2C6.11929 2 5 3.11929 5 4.5V8.5C5 9.88071 6.11929 11 7.5 11ZM7.5 10C8.32843 10 9 9.32843 9 8.5V4.5C9 3.67157 8.32843 3 7.5 3C6.67157 3 6 3.67157 6 4.5V8.5C6 9.32843 6.67157 10 7.5 10Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path><path d="M2.5 8C2.5 7.72386 2.27614 7.5 2 7.5C1.72386 7.5 1.5 7.72386 1.5 8C1.5 11.0858 3.84439 13.6231 6.84065 13.966V15H8.15935V13.966C11.1556 13.6231 13.5 11.0858 13.5 8C13.5 7.72386 13.2761 7.5 13 7.5C12.7239 7.5 12.5 7.72386 12.5 8C12.5 10.7614 10.2614 13 7.5 13C4.73858 13 2.5 10.7614 2.5 8Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
