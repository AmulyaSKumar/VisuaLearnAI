import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.3 }
  })
};

export default function ExamplesTabView({ examples = [], onInteraction }) {
  // Debug logging
  console.log('ExamplesTabView - Props received:', { examples, examplesLength: examples?.length });

  const [gameMode, setGameMode] = useState(false);
  const [selectedExamples, setSelectedExamples] = useState(new Set());
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  // Get examples that could be used in the game (need at least some AI and some non-AI)
  const gameExamples = useMemo(() => {
    if (!examples || examples.length < 4) return [];
    // Shuffle and take first 4
    return [...examples]
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);
  }, [examples]);

  const hasAIExamples = examples.some(ex => ex.involves_ai);
  const canPlayGame = gameExamples.length >= 4 && hasAIExamples;

  const handleExampleSelect = (exampleId) => {
    if (showResults) return;

    setSelectedExamples(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exampleId)) {
        newSet.delete(exampleId);
      } else {
        newSet.add(exampleId);
      }
      return newSet;
    });
  };

  const handleSubmitGame = () => {
    let correct = 0;
    gameExamples.forEach(ex => {
      const userSelectedAsAI = selectedExamples.has(ex.id);
      const isActuallyAI = ex.involves_ai;
      if (userSelectedAsAI === isActuallyAI) {
        correct++;
      }
    });
    setScore(correct);
    setShowResults(true);
    onInteraction?.({ type: 'ai_game_complete', score: correct, total: gameExamples.length });
  };

  const resetGame = () => {
    setSelectedExamples(new Set());
    setShowResults(false);
    setScore(0);
    setGameMode(false);
  };

  if (!examples || examples.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p>No examples available for this topic</p>
      </div>
    );
  }

  // Game Mode
  if (gameMode) {
    return (
      <div className="space-y-6">
        {/* Game Header */}
        <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Is this AI?</h3>
              <p className="text-sm text-muted-foreground">
                Select the examples that involve artificial intelligence
              </p>
            </div>
          </div>

          {!showResults && (
            <p className="text-xs text-muted-foreground">
              Click on examples you think involve AI, then submit your answers
            </p>
          )}
        </div>

        {/* Game Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {gameExamples.map((example, index) => {
            const isSelected = selectedExamples.has(example.id);
            const isCorrect = showResults && (isSelected === example.involves_ai);
            const isWrong = showResults && (isSelected !== example.involves_ai);

            return (
              <motion.button
                key={example.id}
                custom={index}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
                onClick={() => handleExampleSelect(example.id)}
                disabled={showResults}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  showResults
                    ? example.involves_ai
                      ? 'border-green-500 bg-green-500/10'
                      : isWrong
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-border bg-card'
                    : isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground mb-1">{example.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {example.description}
                    </p>
                  </div>
                  {showResults && (
                    <div className="flex-shrink-0">
                      {example.involves_ai ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          AI
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground">Not AI</span>
                      )}
                    </div>
                  )}
                  {!showResults && isSelected && (
                    <svg className="w-5 h-5 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Results / Actions */}
        {showResults ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5 text-center"
          >
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3 ${
              score === gameExamples.length ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
              score >= gameExamples.length / 2 ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
              'bg-orange-500/10 text-orange-600 dark:text-orange-400'
            }`}>
              {score === gameExamples.length ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : score >= gameExamples.length / 2 ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-1">
              {score === gameExamples.length ? 'Perfect!' : score >= gameExamples.length / 2 ? 'Good job!' : 'Keep learning!'}
            </h4>
            <p className="text-muted-foreground mb-4">
              You got {score} out of {gameExamples.length} correct
            </p>
            <button
              onClick={resetGame}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Back to Examples
            </button>
          </motion.div>
        ) : (
          <div className="flex justify-center gap-3">
            <button
              onClick={resetGame}
              className="px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitGame}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Submit Answers
            </button>
          </div>
        )}
      </div>
    );
  }

  // Regular Examples View
  return (
    <div className="space-y-6">
      {/* Game CTA */}
      {canPlayGame && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-foreground">Play "Is this AI?"</h4>
                <p className="text-sm text-muted-foreground">Test your knowledge by identifying AI examples</p>
              </div>
            </div>
            <button
              onClick={() => setGameMode(true)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
            >
              Play Now
            </button>
          </div>
        </motion.div>
      )}

      {/* Examples Grid */}
      <div className="space-y-3">
        {examples.map((example, index) => (
          <motion.div
            key={example.id || index}
            custom={index}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-foreground">{example.title}</h4>
                  {example.involves_ai && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                      AI
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {example.description}
                </p>
                {example.real_world_context && (
                  <div className="bg-muted/30 rounded-lg p-3 mt-2">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Real-world context:</span> {example.real_world_context}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
