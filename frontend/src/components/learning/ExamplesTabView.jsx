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

// View modes
const VIEW_MODES = {
  browse: 'browse',
  game: 'game',
  caseStudy: 'caseStudy',
};

export default function ExamplesTabView({ examples = [], onInteraction, updateConceptMastery }) {
  const [viewMode, setViewMode] = useState(VIEW_MODES.browse);
  const [selectedExamples, setSelectedExamples] = useState(new Set());
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [activeCaseStudy, setActiveCaseStudy] = useState(null);
  const [caseStudyStep, setCaseStudyStep] = useState(0);
  const [caseStudyAnswers, setCaseStudyAnswers] = useState({});
  const [expandedCards, setExpandedCards] = useState(new Set());

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

    // Update concept mastery
    if (updateConceptMastery) {
      const isGoodScore = correct >= gameExamples.length / 2;
      updateConceptMastery('ai_identification', isGoodScore, 'game');
    }

    onInteraction?.({ type: 'ai_game_complete', score: correct, total: gameExamples.length });
  };

  const resetGame = () => {
    setSelectedExamples(new Set());
    setShowResults(false);
    setScore(0);
    setViewMode(VIEW_MODES.browse);
  };

  const toggleCardExpanded = (cardId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const startCaseStudy = (example) => {
    setActiveCaseStudy(example);
    setCaseStudyStep(0);
    setCaseStudyAnswers({});
    setViewMode(VIEW_MODES.caseStudy);
  };

  const handleCaseStudyAnswer = (questionIndex, answer) => {
    setCaseStudyAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const completeCaseStudy = () => {
    // Track completion
    if (updateConceptMastery && activeCaseStudy) {
      const conceptId = activeCaseStudy.id || 'case_study';
      updateConceptMastery(conceptId, true, 'case_study');
    }

    onInteraction?.({
      type: 'case_study_complete',
      exampleId: activeCaseStudy?.id,
      answers: caseStudyAnswers
    });

    setActiveCaseStudy(null);
    setViewMode(VIEW_MODES.browse);
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

  // Case Study Mode
  if (viewMode === VIEW_MODES.caseStudy && activeCaseStudy) {
    return (
      <div className="space-y-6">
        {/* Case Study Header */}
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{activeCaseStudy.title}</h3>
              <p className="text-sm text-muted-foreground">Interactive Case Study</p>
            </div>
            <button
              onClick={resetGame}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Exit
            </button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded-full ${
                step <= caseStudyStep
                  ? 'bg-indigo-500'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={caseStudyStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-card border border-border rounded-xl p-6"
          >
            {caseStudyStep === 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-foreground">The Scenario</h4>
                <p className="text-muted-foreground">{activeCaseStudy.description}</p>
                {activeCaseStudy.real_world_context && (
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Real-world context:</span>{' '}
                      {activeCaseStudy.real_world_context}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => setCaseStudyStep(1)}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Continue to Analysis
                </button>
              </div>
            )}

            {caseStudyStep === 1 && (
              <div className="space-y-4">
                <h4 className="font-medium text-foreground">What do you think?</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Based on the scenario, answer the following:
                </p>

                {/* Question 1 */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Does this example involve AI technology?
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {['Yes', 'No'].map((option) => (
                      <button
                        key={option}
                        onClick={() => handleCaseStudyAnswer(0, option === 'Yes')}
                        className={`p-3 rounded-lg border-2 font-medium transition-all ${
                          caseStudyAnswers[0] === (option === 'Yes')
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question 2 */}
                <div className="space-y-3 pt-4">
                  <p className="text-sm font-medium text-foreground">
                    What is the main benefit of this application?
                  </p>
                  <div className="space-y-2">
                    {['Efficiency', 'Accuracy', 'Cost Savings', 'User Experience'].map((option, idx) => (
                      <button
                        key={option}
                        onClick={() => handleCaseStudyAnswer(1, idx)}
                        className={`w-full p-3 rounded-lg border-2 text-left font-medium transition-all ${
                          caseStudyAnswers[1] === idx
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setCaseStudyStep(2)}
                  disabled={caseStudyAnswers[0] === undefined}
                  className={`w-full py-3 rounded-lg font-medium transition-colors ${
                    caseStudyAnswers[0] !== undefined
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  See Results
                </button>
              </div>
            )}

            {caseStudyStep === 2 && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  caseStudyAnswers[0] === activeCaseStudy.involves_ai
                    ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-amber-500/10 border border-amber-500/30'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {caseStudyAnswers[0] === activeCaseStudy.involves_ai ? (
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    <span className={`font-medium ${
                      caseStudyAnswers[0] === activeCaseStudy.involves_ai
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {caseStudyAnswers[0] === activeCaseStudy.involves_ai ? 'Correct!' : 'Not quite'}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">
                    This example {activeCaseStudy.involves_ai ? 'does involve' : 'does not involve'} AI technology.
                    {activeCaseStudy.real_world_context && (
                      <span className="block mt-2 text-muted-foreground">{activeCaseStudy.real_world_context}</span>
                    )}
                  </p>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Key Takeaway</p>
                      <p className="text-sm text-foreground mt-1">
                        Understanding whether a system uses AI helps you evaluate its capabilities, limitations, and ethical considerations.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={completeCaseStudy}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                  Complete Case Study
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Game Mode
  if (viewMode === VIEW_MODES.game) {
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
              onClick={() => setViewMode(VIEW_MODES.game)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors text-sm"
            >
              Play Now
            </button>
          </div>
        </motion.div>
      )}

      {/* Examples Grid */}
      <div className="space-y-3">
        {examples.map((example, index) => {
          const isExpanded = expandedCards.has(example.id || index);

          return (
            <motion.div
              key={example.id || index}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors"
            >
              <div className="p-4">
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
                    <p className="text-sm text-muted-foreground">
                      {example.description}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleCardExpanded(example.id || index)}
                    className="w-8 h-8 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
                  >
                    <svg
                      className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-border"
                  >
                    <div className="p-4 bg-muted/20 space-y-3">
                      {example.real_world_context && (
                        <div className="p-3 bg-background rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Real-world context:</span>{' '}
                            {example.real_world_context}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => startCaseStudy(example)}
                          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Explore Case Study
                        </button>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(example.title)}+explained`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Learn More
                        </a>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
