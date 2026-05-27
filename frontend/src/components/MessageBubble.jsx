import { useEffect, useState } from "react";
import useTextToSpeech from "../hooks/useTextToSpeech";

export default function MessageBubble({ content, showTTS = false, isStreaming = false }) {
  const {
    isSpeaking,
    isPaused,
    isLoading,
    isSupported,
    speak,
    pause,
    resume,
    stop,
  } = useTextToSpeech({ rate: 0.95 });
  const [renderedHtml, setRenderedHtml] = useState("");

  const handleTTS = () => {
    if (isLoading) return;
    if (isPaused) {
      resume();
      return;
    }
    if (isSpeaking) {
      pause();
      return;
    }
    speak(content);
  };

  // Parse markdown-like content into rendered HTML
  const renderMarkdown = (text) => {
    const lines = text.split("\n");
    const htmlParts = [];
    let inList = false;
    let listItems = [];

    const flushList = () => {
      if (listItems.length > 0) {
        htmlParts.push(`<ul class="mb-4 pl-4 space-y-1">${listItems.join("")}</ul>`);
        listItems = [];
        inList = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Escape HTML entities
      line = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      // Headers
      if (line.startsWith("### ")) {
        flushList();
        const heading = inlineFormat(line.slice(4));
        htmlParts.push(`<h4 class="text-sm font-semibold text-foreground mt-5 mb-2">${heading}</h4>`);
        continue;
      }
      if (line.startsWith("## ")) {
        flushList();
        const heading = inlineFormat(line.slice(3));
        htmlParts.push(`<h3 class="text-base font-semibold text-foreground mt-6 mb-2">${heading}</h3>`);
        continue;
      }
      if (line.startsWith("# ")) {
        flushList();
        const heading = inlineFormat(line.slice(2));
        htmlParts.push(`<h2 class="text-lg font-bold text-foreground mt-6 mb-3">${heading}</h2>`);
        continue;
      }

      // Bullet lists
      if (line.match(/^[-•*]\s/)) {
        inList = true;
        const item = inlineFormat(line.replace(/^[-•*]\s/, ""));
        listItems.push(`<li class="text-[15px] leading-relaxed text-foreground/90">${item}</li>`);
        continue;
      }

      // Numbered lists
      if (line.match(/^\d+\.\s/)) {
        inList = true;
        const item = inlineFormat(line.replace(/^\d+\.\s/, ""));
        listItems.push(`<li class="text-[15px] leading-relaxed text-foreground/90 list-decimal">${item}</li>`);
        continue;
      }

      // Empty lines
      if (line.trim() === "") {
        flushList();
        continue;
      }

      // Regular paragraph
      flushList();
      htmlParts.push(`<p class="mb-3 text-[15px] leading-relaxed text-foreground/90">${inlineFormat(line)}</p>`);
    }

    flushList();
    return htmlParts.join("");
  };

  // Inline formatting: bold, italic, code, links
  const inlineFormat = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-muted text-primary px-1.5 py-0.5 rounded text-[13px] font-mono">$1</code>');
  };

  useEffect(() => {
    const updateHtml = () => setRenderedHtml(renderMarkdown(content || ""));
    if (!isStreaming) {
      updateHtml();
      return undefined;
    }

    const timeoutId = window.setTimeout(updateHtml, 100);
    return () => window.clearTimeout(timeoutId);
  }, [content, isStreaming]);

  if (!content) return null;

  return (
    <div className="relative group rounded-lg border border-border/60 bg-background/40 p-3">
      {showTTS && isSupported && (
        <div className="mb-2 flex justify-end">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleTTS}
              disabled={isLoading}
              className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all
                ${isSpeaking
                  ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                  : isLoading
                    ? "bg-muted text-muted-foreground cursor-wait"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              {isLoading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg>
                  Preparing
                </>
              ) : isSpeaking && !isPaused ? (
                <>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  Pause
                </>
              ) : isPaused ? (
                <>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  Resume
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
                  Play
                </>
              )}
            </button>
            {(isSpeaking || isPaused) && (
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Stop"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            )}
          </div>
        </div>
      )}
      <div
        className="max-w-none"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}
