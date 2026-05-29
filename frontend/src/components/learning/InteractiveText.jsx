import { useState, useRef, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://visualearnai-backend.onrender.com' : 'http://localhost:3001');

function safeText(value) {
  return String(value ?? '').replace(/[<>]/g, '').trim();
}

function keywordList(content) {
  const values = [
    ...(content?.keywords || []),
    ...(content?.keyTerms || []),
    ...(content?.concepts || []).map(concept => concept.title),
  ];
  return [...new Set(values.map(safeText).filter(Boolean))].slice(0, 10);
}

function renderHighlightedText(text, keywords) {
  const clean = safeText(text);
  if (!keywords.length) return clean;

  const escaped = keywords.map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  return clean.split(pattern).map((part, index) => {
    const isKeyword = keywords.some(keyword => keyword.toLowerCase() === part.toLowerCase());
    return isKeyword ? (
      <mark key={`${part}-${index}`} className="rounded bg-primary/15 px-1 text-primary">
        {part}
      </mark>
    ) : part;
  });
}

function buildInteractiveBlocks(content) {
  const explicitBlocks = Array.isArray(content?.interactiveBlocks) ? content.interactiveBlocks : [];
  if (explicitBlocks.length > 0) return explicitBlocks.slice(0, 8);

  const blocks = [];
  if (content?.examples?.length) {
    blocks.push({
      type: 'examples',
      title: 'Examples',
      items: content.examples.slice(0, 3).map(example => ({
        title: example.title || example.description,
        body: example.real_world_context || example.description,
      })),
    });
  }

  if (content?.concepts?.length) {
    blocks.push({
      type: 'steps',
      title: 'Step Cards',
      items: content.concepts.slice(0, 4).map(concept => ({
        title: concept.title,
        body: concept.description || concept.explanation,
      })),
    });
  }

  if (content?.keyTakeaways?.length) {
    blocks.push({
      type: 'emphasis',
      title: 'Emphasis',
      items: content.keyTakeaways.slice(0, 3).map(takeaway => ({
        title: 'Remember',
        body: takeaway,
      })),
    });
  }

  return blocks;
}

export default function InteractiveText({ content, audioMode = false }) {
  const [currentParagraph, setCurrentParagraph] = useState(0);
  const [currentSentence, setCurrentSentence] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [ttsUnavailable, setTtsUnavailable] = useState(false);
  const audioRef = useRef(null);
  const intervalRef = useRef(null);

  // Get explanation text based on mode
  const getExplanationText = () => {
    if (!content?.summary) return '';

    // In a real implementation, we'd have different versions
    // For now, adjust the summary based on mode
    let text = content.summary;

    if (content.concepts?.length > 0) {
      text += '\n\n';
      content.concepts.forEach((concept) => {
        text += `${concept.title}: ${concept.description}\n`;
      });
    }

    return text;
  };

  const text = getExplanationText();
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  const keywords = keywordList(content);
  const interactiveBlocks = buildInteractiveBlocks(content);

  // Split paragraph into sentences
  const getSentences = (paragraph) => {
    return paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
  };

  const currentParagraphText = paragraphs[currentParagraph] || '';
  const sentences = getSentences(currentParagraphText);

  // TTS for current paragraph
  const playAudio = useCallback(async () => {
    if (!currentParagraphText || ttsUnavailable) return;

    setIsLoading(true);
    setAudioError('');
    try {
      const res = await fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: currentParagraphText })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data.message || data.error || 'Audio playback is unavailable right now.';
        setAudioError(message);
        setTtsUnavailable(true);
        return;
      }

      if (!data.audio) throw new Error(data.error || 'No audio');

      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      // Simulate sentence highlighting during playback
      const avgSentenceTime = (audio.duration || 5) / sentences.length * 1000;

      audio.onplay = () => {
        setIsPlaying(true);
        setCurrentSentence(0);

        // Progress through sentences during playback
        intervalRef.current = setInterval(() => {
          setCurrentSentence(prev => {
            if (prev >= sentences.length - 1) {
              clearInterval(intervalRef.current);
              return prev;
            }
            return prev + 1;
          });
        }, avgSentenceTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        clearInterval(intervalRef.current);
        URL.revokeObjectURL(url);

        // Auto-advance to next paragraph
        if (currentParagraph < paragraphs.length - 1) {
          setTimeout(() => {
            setCurrentParagraph(prev => prev + 1);
            setCurrentSentence(0);
          }, 500);
        }
      };

      audio.onerror = () => {
        setIsPlaying(false);
        clearInterval(intervalRef.current);
        URL.revokeObjectURL(url);
      };

      audio.play();
    } catch (err) {
      setAudioError(err.message || 'Audio playback is unavailable right now.');
      setTtsUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  }, [currentParagraphText, currentParagraph, paragraphs.length, sentences.length, ttsUnavailable]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    clearInterval(intervalRef.current);
  };

  const nextParagraph = () => {
    stopAudio();
    if (currentParagraph < paragraphs.length - 1) {
      setCurrentParagraph(currentParagraph + 1);
      setCurrentSentence(0);
    }
  };

  const prevParagraph = () => {
    stopAudio();
    if (currentParagraph > 0) {
      setCurrentParagraph(currentParagraph - 1);
      setCurrentSentence(0);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      clearInterval(intervalRef.current);
    };
  }, []);

  // Auto-play in audio mode
  useEffect(() => {
    if (audioMode && paragraphs.length > 0 && !isPlaying && !isLoading && !ttsUnavailable) {
      playAudio();
    }
  }, [audioMode, currentParagraph, isLoading, isPlaying, paragraphs.length, playAudio, ttsUnavailable]);

  if (!text) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No content available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentParagraph + 1) / paragraphs.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {currentParagraph + 1} / {paragraphs.length}
        </span>
      </div>

      {/* Content */}
      <div className="bg-muted/20 rounded-xl p-6 min-h-[200px]">
        {sentences.map((sentence, idx) => (
          <span
            key={idx}
            className={`transition-all duration-200 ${
              idx === currentSentence && isPlaying
                ? 'bg-primary/20 text-primary font-medium'
                : idx < currentSentence && isPlaying
                  ? 'text-muted-foreground'
                  : 'text-foreground'
            }`}
          >
            {renderHighlightedText(sentence, keywords)}
          </span>
        ))}
      </div>

      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {keywords.map(keyword => (
            <span key={keyword} className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              {keyword}
            </span>
          ))}
        </div>
      )}

      {interactiveBlocks.length > 0 && (
        <div className="grid gap-3">
          {interactiveBlocks.map((block, blockIndex) => (
            <details
              key={`${block.title || block.type}-${blockIndex}`}
              className="rounded-lg border border-border bg-card"
              open={block.type === 'steps'}
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
                {safeText(block.title || block.type || 'More detail')}
              </summary>
              <div className="grid gap-3 border-t border-border p-4">
                {(block.items || []).map((item, itemIndex) => (
                  <div key={`${item.title || itemIndex}-${itemIndex}`} className="rounded-md bg-muted/30 p-3">
                    <p className="text-sm font-medium text-foreground">
                      {safeText(item.title || `Step ${itemIndex + 1}`)}
                    </p>
                    {item.body && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {renderHighlightedText(item.body, keywords)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevParagraph}
          disabled={currentParagraph === 0}
          className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {isPlaying ? (
            <button
              onClick={stopAudio}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Pause
            </button>
          ) : (
            <button
              onClick={playAudio}
              disabled={isLoading || ttsUnavailable}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  {ttsUnavailable ? 'Audio Unavailable' : 'Listen'}
                </>
              )}
            </button>
          )}
        </div>

        <button
          onClick={nextParagraph}
          disabled={currentParagraph === paragraphs.length - 1}
          className="p-2 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {audioError && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {audioError}
        </div>
      )}

      {/* Key Takeaways */}
      {content?.keyTakeaways?.length > 0 && (
        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Key Takeaways
          </h4>
          <ul className="space-y-2">
            {content.keyTakeaways.map((takeaway, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                {takeaway}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
