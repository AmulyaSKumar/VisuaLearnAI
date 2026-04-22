import { useState, useEffect, useCallback } from "react";
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

export default function InputBar({ onSend, inputDisabled = false, onVoiceStart }) {
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  const {
    isListening,
    isSupported: sttSupported,
    interimTranscript,
    startListening,
    stopListening,
    clearTranscript,
  } = useSpeechToText({
    onResult: (text) => {
      setInput((prev) => prev + text);
    },
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || inputDisabled) return;

    onSend(input);
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
      return;
    }

    onVoiceStart?.();
    startListening();
  }, [isListening, onVoiceStart, startListening, stopListening]);

  const displayText = input + (interimTranscript ? ` ${interimTranscript}` : "");

  return (
    <div className="w-full">
      <form
        onSubmit={handleSubmit}
        className="w-full relative flex items-center neu-pressed rounded-xl overflow-hidden"
      >
        <input
          type="text"
          value={displayText}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={showPlaceholder ? PLACEHOLDERS[placeholderIndex] : ""}
          disabled={inputDisabled}
          className={`flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm sm:text-[15px] py-4 sm:py-5 px-5 text-foreground placeholder:text-muted-foreground disabled:opacity-50 transition-opacity ${
            showPlaceholder ? "placeholder:opacity-100" : "placeholder:opacity-0"
          }`}
        />

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

          {sttSupported && (
            <button
              type="button"
              onClick={handleVoiceClick}
              className={`w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-all ${
                isListening
                  ? "neu-btn-primary animate-pulse"
                  : "neu-btn text-foreground"
              }`}
              title={isListening ? "Stop listening" : "Voice input"}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7.5 11C8.88071 11 10 9.88071 10 8.5V4.5C10 3.11929 8.88071 2 7.5 2C6.11929 2 5 3.11929 5 4.5V8.5C5 9.88071 6.11929 11 7.5 11ZM7.5 10C8.32843 10 9 9.32843 9 8.5V4.5C9 3.67157 8.32843 3 7.5 3C6.67157 3 6 3.67157 6 4.5V8.5C6 9.32843 6.67157 10 7.5 10Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path><path d="M2.5 8C2.5 7.72386 2.27614 7.5 2 7.5C1.72386 7.5 1.5 7.72386 1.5 8C1.5 11.0858 3.84439 13.6231 6.84065 13.966V15H8.15935V13.966C11.1556 13.6231 13.5 11.0858 13.5 8C13.5 7.72386 13.2761 7.5 13 7.5C12.7239 7.5 12.5 7.72386 12.5 8C12.5 10.7614 10.2614 13 7.5 13C4.73858 13 2.5 10.7614 2.5 8Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
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

      {isListening && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-rose-600 dark:text-rose-400 animate-in fade-in duration-200">
          <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
          <span>Listening... speak now</span>
        </div>
      )}
    </div>
  );
}
