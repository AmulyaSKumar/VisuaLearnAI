import { useState, useRef, useCallback, useEffect } from "react";

export default function MessageBubble({ content, showTTS = false }) {
  if (!content) return null;

  const [ttsState, setTtsState] = useState("idle"); // idle | loading | playing
  const audioRef = useRef(null);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleTTS = useCallback(async () => {
    if (ttsState === "playing") {
      // Stop playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setTtsState("idle");
      return;
    }

    setTtsState("loading");
    try {
      const res = await fetch("http://localhost:3001/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });
      const data = await res.json();
      if (!data.audio) throw new Error(data.error || "No audio");

      // Create audio element from base64 MP3
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: "audio/mp3" }
      );
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setTtsState("playing");
      audio.onended = () => { setTtsState("idle"); URL.revokeObjectURL(url); };
      audio.onerror = () => { setTtsState("idle"); URL.revokeObjectURL(url); };
      audio.play();
    } catch (err) {
      console.error("TTS error:", err);
      setTtsState("idle");
    }
  }, [content, ttsState]);

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

  return (
    <div className="relative group">
      <div 
        className="max-w-none" 
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} 
      />
      {/* TTS Listen button */}
      {showTTS && (
        <button
          onClick={handleTTS}
          disabled={ttsState === "loading"}
          className={`mt-2 inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] rounded-lg text-xs font-medium transition-all
            ${ttsState === "playing"
              ? "bg-primary/20 text-primary ring-1 ring-primary/30"
              : ttsState === "loading"
                ? "bg-muted text-muted-foreground cursor-wait"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
            }`}
        >
          {ttsState === "loading" ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg>
              Generating...
            </>
          ) : ttsState === "playing" ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              Stop
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
              Listen
            </>
          )}
        </button>
      )}
    </div>
  );
}

