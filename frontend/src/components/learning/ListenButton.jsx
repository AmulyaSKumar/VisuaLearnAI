import { motion, AnimatePresence } from 'framer-motion';
import useTextToSpeech from '../../hooks/useTextToSpeech';

// Audio wave bars animation
function AudioWave({ isPlaying }) {
  return (
    <div className="flex items-center gap-0.5 h-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-0.5 bg-current rounded-full"
          animate={isPlaying ? {
            height: ['8px', '16px', '8px'],
          } : { height: '8px' }}
          transition={{
            duration: 0.5,
            repeat: isPlaying ? Infinity : 0,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Speaker icon
function SpeakerIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );
}

// Pause icon
function PauseIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

// Play icon
function PlayIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

// Stop icon
function StopIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

/**
 * Enhanced Listen Button with audio visualization
 * Uses Web Speech API directly for reliable control
 */
export default function ListenButton({ text, variant = 'default', className = '' }) {
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

  const handleStop = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    stop();
  };

  const handlePause = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    pause();
  };

  const handleResume = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    resume();
  };

  const handleMainClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoading) return;
    if (isPaused) {
      resume();
      return;
    }
    if (isSpeaking) {
      pause();
      return;
    }
    speak(text);
  };

  if (!isSupported) return null;

  // Icon-only variant
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleMainClick}
        className={`p-2 rounded-full transition-all ${
          isSpeaking
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
        } ${className}`}
        title={isPaused ? 'Resume' : isSpeaking ? 'Pause' : 'Listen'}
      >
        {isLoading ? <AudioWave isPlaying /> : isSpeaking ? <AudioWave isPlaying={!isPaused} /> : <SpeakerIcon />}
      </button>
    );
  }

  // Compact variant
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleMainClick}
        className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md transition-all ${
          isSpeaking
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        } ${className}`}
      >
        {isSpeaking ? (
          <>
            <AudioWave isPlaying={!isPaused} />
            <span>{isPaused ? 'Paused' : isLoading ? 'Preparing' : 'Playing'}</span>
          </>
        ) : (
          <>
            <SpeakerIcon className="w-3.5 h-3.5" />
            <span>Listen</span>
          </>
        )}
      </button>
    );
  }

  // Default full variant
  return (
    <div className={`inline-flex items-center ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        {isSpeaking ? (
          <motion.div
            key="playing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg"
          >
            <AudioWave isPlaying={!isPaused} />

            <span className="text-sm font-medium text-primary min-w-[60px]">
              {isPaused ? 'Paused' : 'Playing'}
            </span>

            <div className="flex items-center gap-1 ml-1 border-l border-primary/20 pl-2">
              {/* Pause/Resume button */}
              <button
                type="button"
                onClick={isPaused ? handleResume : handlePause}
                className="p-1.5 rounded-md hover:bg-primary/20 text-primary transition-colors"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <PlayIcon /> : <PauseIcon />}
              </button>

              {/* Stop button */}
              <button
                type="button"
                onClick={handleStop}
                className="p-1.5 rounded-md hover:bg-primary/20 text-primary transition-colors"
                title="Stop"
              >
                <StopIcon />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="idle"
            type="button"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onClick={handleMainClick}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:text-foreground hover:bg-muted/50 hover:border-foreground/20 transition-all active:scale-95"
          >
            <SpeakerIcon />
            <span>Listen to this</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
