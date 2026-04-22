import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Learning tips that rotate during loading
const LEARNING_TIPS = [
  "Spaced repetition can boost retention by up to 200%",
  "Taking notes by hand improves understanding",
  "Teaching others helps you learn 90% more",
  "Your brain forms new connections while you sleep",
  "Breaking learning into chunks improves focus",
  "Active recall beats passive reading every time",
  "Connecting new ideas to existing knowledge helps memory",
  "Taking breaks actually speeds up learning",
  "Visualizing concepts strengthens neural pathways",
  "Questions engage your brain more than statements",
];

// Tab-specific loading messages
const TAB_MESSAGES = {
  learn: {
    title: "Crafting your lesson",
    subtitle: "Organizing concepts for optimal understanding",
    icon: "book",
  },
  examples: {
    title: "Finding real-world examples",
    subtitle: "Connecting theory to practice",
    icon: "lightbulb",
  },
  flashcards: {
    title: "Creating flashcards",
    subtitle: "Preparing spaced repetition cards",
    icon: "cards",
  },
  quiz: {
    title: "Generating quiz questions",
    subtitle: "Testing your understanding",
    icon: "quiz",
  },
  mindmap: {
    title: "Building your mind map",
    subtitle: "Visualizing connections between concepts",
    icon: "mindmap",
  },
  simulation: {
    title: "Preparing simulation",
    subtitle: "Setting up interactive visualization",
    icon: "play",
  },
};

// Animated icons for each tab type
function AnimatedIcon({ type }) {
  switch (type) {
    case 'book':
      return (
        <motion.div className="relative w-16 h-16">
          <motion.svg
            className="w-16 h-16 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.svg>
          {/* Floating sparkles */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-1.5 h-1.5 bg-primary/60 rounded-full"
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                x: [0, (i - 1) * 20],
                y: [0, -20 - i * 5],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.3,
              }}
              style={{ left: '50%', top: '30%' }}
            />
          ))}
        </motion.div>
      );

    case 'lightbulb':
      return (
        <motion.div className="relative w-16 h-16">
          <motion.svg
            className="w-16 h-16 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </motion.svg>
          {/* Pulsing glow */}
          <motion.div
            className="absolute inset-0 bg-primary/20 rounded-full blur-xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      );

    case 'cards':
      return (
        <motion.div className="relative w-16 h-16 flex items-center justify-center">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-10 h-14 bg-card border-2 border-primary/30 rounded-lg shadow-sm"
              animate={{
                rotateZ: [-5 + i * 5, 5 + i * 5, -5 + i * 5],
                y: [0, -5, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
              style={{
                left: `${20 + i * 8}%`,
                zIndex: 3 - i,
              }}
            />
          ))}
        </motion.div>
      );

    case 'quiz':
      return (
        <motion.div className="relative w-16 h-16">
          <motion.svg
            className="w-16 h-16 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </motion.svg>
          {/* Checkmark animation */}
          <motion.svg
            className="absolute w-6 h-6 text-green-500"
            style={{ right: '15%', bottom: '25%' }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          >
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: [0, 1, 1, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.svg>
        </motion.div>
      );

    case 'mindmap':
      return (
        <motion.div className="relative w-16 h-16 flex items-center justify-center">
          {/* Center node */}
          <motion.div
            className="w-4 h-4 bg-primary rounded-full z-10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          {/* Orbiting nodes */}
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute w-2.5 h-2.5 bg-primary/60 rounded-full"
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.75,
              }}
              style={{
                transformOrigin: '32px 32px',
                left: 'calc(50% - 5px)',
                top: 'calc(50% - 24px)',
              }}
            />
          ))}
          {/* Connection lines */}
          <svg className="absolute w-full h-full" viewBox="0 0 64 64">
            {[0, 1, 2, 3].map((i) => {
              const angle = (i * 90 - 45) * (Math.PI / 180);
              const x = 32 + Math.cos(angle) * 20;
              const y = 32 + Math.sin(angle) * 20;
              return (
                <motion.line
                  key={i}
                  x1="32"
                  y1="32"
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  strokeWidth="1"
                  className="text-primary/30"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: i * 0.2 }}
                />
              );
            })}
          </svg>
        </motion.div>
      );

    case 'play':
    default:
      return (
        <motion.div className="relative w-16 h-16">
          <motion.svg
            className="w-16 h-16 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            animate={{ rotate: [0, 0, 0] }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </motion.svg>
          {/* Pulse ring */}
          <motion.div
            className="absolute inset-0 border-2 border-primary/30 rounded-full"
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      );
  }
}

// Progress dots
function ProgressDots() {
  return (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-primary/60 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Engaging loading component with animations and tips
 * @param {Object} props
 * @param {string} props.tabType - 'learn' | 'examples' | 'flashcards' | 'quiz' | 'mindmap' | 'simulation'
 * @param {string} props.topic - Optional topic name for context
 */
function EngagingLoader({ tabType = 'learn', topic }) {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * LEARNING_TIPS.length));

  // Rotate tips every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LEARNING_TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const tabConfig = TAB_MESSAGES[tabType] || TAB_MESSAGES.learn;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {/* Animated icon */}
      <div className="mb-8">
        <AnimatedIcon type={tabConfig.icon} />
      </div>

      {/* Title and subtitle */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center justify-center gap-3">
          {tabConfig.title}
          <ProgressDots />
        </h3>
        <p className="text-sm text-muted-foreground">
          {tabConfig.subtitle}
        </p>
        {topic && (
          <p className="text-xs text-muted-foreground/70 mt-1">
            Topic: {topic}
          </p>
        )}
      </motion.div>

      {/* Progress bar */}
      <div className="w-full max-w-xs mb-8">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary/50 via-primary to-primary/50"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{ width: '50%' }}
          />
        </div>
      </div>

      {/* Rotating tips */}
      <div className="w-full max-w-md">
        <div className="bg-muted/30 border border-border/50 rounded-lg px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="min-h-[40px] flex items-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={tipIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-muted-foreground"
                >
                  <span className="font-medium text-foreground">Did you know? </span>
                  {LEARNING_TIPS[tipIndex]}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(EngagingLoader);
