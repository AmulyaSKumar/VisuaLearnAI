import { useState, useEffect, useRef } from "react";
import { useSpeechToText } from "../hooks/useSpeechToText";

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

export default function InputBar({
  onSend,
  inputDisabled = false,
  webSearchEnabled = false,
  selectedTools = [],
  onToggleWebSearch,
  onDocumentUpload,
  onGenerateArtifact,
}) {
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const [showTools, setShowTools] = useState(false);
  const toolsRef = useRef(null);
  const dictationBaseRef = useRef("");
  const {
    isListening,
    isSupported: isSpeechSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    clearTranscript,
  } = useSpeechToText({
    continuous: true,
    interimResults: true,
    silenceTimeoutMs: 3000,
    onError: (message) => console.warn("Speech-to-text error:", message),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 200);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showTools) return undefined;

    const handleClickOutside = (event) => {
      if (!toolsRef.current?.contains(event.target)) {
        setShowTools(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTools]);

  useEffect(() => {
    if (!isListening && !transcript && !interimTranscript) return;
    const parts = [dictationBaseRef.current, transcript, interimTranscript]
      .map(part => String(part || "").trim())
      .filter(Boolean);
    setInput(parts.join(" ").replace(/\s+/g, " "));
  }, [interimTranscript, isListening, transcript]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || inputDisabled) return;

    stopListening();
    clearTranscript();
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClear = () => {
    stopListening();
    clearTranscript();
    dictationBaseRef.current = "";
    setInput("");
  };

  const displayText = input;
  const hasTools = onToggleWebSearch || onDocumentUpload || onGenerateArtifact;

  const handleTool = (action) => {
    setShowTools(false);
    if (action === "web") {
      onToggleWebSearch?.();
      return;
    }
    if (action === "document") {
      onDocumentUpload?.();
      return;
    }
    onGenerateArtifact?.(action);
  };

  const handleToggleSpeech = () => {
    if (!isSpeechSupported || inputDisabled) return;
    if (isListening) {
      stopListening();
      return;
    }
    dictationBaseRef.current = input.trim();
    clearTranscript();
    startListening();
  };

  const handleInputChange = (event) => {
    setInput(event.target.value);
    if (isListening) {
      dictationBaseRef.current = event.target.value;
      clearTranscript();
    }
  };

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="w-full relative z-20 flex items-center neu-pressed rounded-xl overflow-visible"
      >
        <div className="flex items-center gap-2 pl-3">
          {hasTools && (
            <div className="relative" ref={toolsRef}>
              <button
                type="button"
                onClick={() => setShowTools((open) => !open)}
                className="w-10 h-10 min-h-[40px] min-w-[40px] rounded-xl border border-primary/30 bg-primary/10 text-primary shadow-sm flex items-center justify-center hover:bg-primary/20"
                title="Add tools"
                aria-label="Add tools"
                aria-expanded={showTools}
              >
                <svg width="16" height="16" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M8 2.75C8 2.47 7.78 2.25 7.5 2.25S7 2.47 7 2.75V7H2.75C2.47 7 2.25 7.22 2.25 7.5S2.47 8 2.75 8H7v4.25c0 .28.22.5.5.5s.5-.22.5-.5V8h4.25c.28 0 .5-.22.5-.5s-.22-.5-.5-.5H8V2.75Z" fill="currentColor" />
                </svg>
              </button>

              {showTools && (
                <div className="absolute bottom-full left-0 z-[100] mb-2 w-60 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                  {onToggleWebSearch && (
                    <button
                      type="button"
                      onClick={() => handleTool("web")}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                    >
                      <span>Web search</span>
                      {webSearchEnabled && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </button>
                  )}
                  {onDocumentUpload && (
                    <button
                      type="button"
                      onClick={() => handleTool("document")}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                    >
                      Upload document
                    </button>
                  )}
                  {onGenerateArtifact && (
                    <>
                      <button type="button" onClick={() => handleTool("quiz")} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted">
                        Quiz
                      </button>
                      <button type="button" onClick={() => handleTool("flashcards")} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted">
                        Flashcards
                      </button>
                      <button type="button" onClick={() => handleTool("mindmap")} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted">
                        Mind Map
                      </button>
                      <button type="button" onClick={() => handleTool("simulation")} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted">
                        Simulation
                      </button>
                      <button type="button" onClick={() => handleTool("3d_scene")} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted">
                        3D Visualization
                      </button>
                      <button type="button" onClick={() => handleTool("video")} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted">
                        Video
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {isSpeechSupported && (
            <button
              type="button"
              onClick={handleToggleSpeech}
              disabled={inputDisabled}
              className={`h-10 min-h-[40px] rounded-xl border px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                isListening
                  ? "animate-pulse border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              title={isListening ? "Stop listening" : "Start speech input"}
              aria-label={isListening ? "Stop listening" : "Start speech input"}
            >
              <span className="inline-flex items-center gap-1.5">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <path d="M12 19v3" />
                </svg>
                {isListening && <span className="hidden sm:inline">Listening...</span>}
              </span>
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 px-3 py-2">
          {selectedTools.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedTools.map((tool) => (
                <span
                  key={tool.id}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  {tool.icon && <span aria-hidden="true">{tool.icon}</span>}
                  <span className="truncate">{tool.label}</span>
                  {tool.onRemove && (
                    <button
                      type="button"
                      onClick={tool.onRemove}
                      className="-mr-1 grid h-5 w-5 place-items-center rounded-full text-primary/70 hover:bg-primary/10 hover:text-primary"
                      aria-label={`Remove ${tool.label}`}
                      title={`Remove ${tool.label}`}
                    >
                      x
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <input
            type="text"
            value={displayText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={showPlaceholder ? PLACEHOLDERS[placeholderIndex] : ""}
            disabled={inputDisabled}
            className={`min-w-0 bg-transparent border-none focus:outline-none focus:ring-0 text-sm sm:text-[15px] py-2 text-foreground placeholder:text-muted-foreground disabled:opacity-50 transition-opacity ${
              showPlaceholder ? "placeholder:opacity-100" : "placeholder:opacity-0"
            }`}
          />
        </div>

        <div className="flex items-center gap-2 pr-3">
          {displayText && (
            <button
              type="button"
              onClick={handleClear}
              className="w-9 h-9 neu-btn rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center"
              title="Clear"
            >
              <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path>
              </svg>
            </button>
          )}

          {displayText.trim() && (
            <button
              type="submit"
              disabled={inputDisabled}
              className="w-11 h-11 min-h-[44px] min-w-[44px] neu-btn-primary rounded-xl flex items-center justify-center disabled:opacity-50"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
