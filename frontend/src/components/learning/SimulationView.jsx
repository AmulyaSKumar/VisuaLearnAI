import { useState, useEffect, useCallback } from 'react';
import useSimulation from '../../hooks/useSimulation';
import AdaptiveSimulationFrame from './simulation/AdaptiveSimulationFrame';

const SPEED_LABELS = {
  400: 'Fast',
  800: 'Normal',
  1400: 'Slow',
};

function IconButton({ children, onClick, disabled, title, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white text-black transition hover:border-[#4c1d95]/40 hover:bg-[#f8f1df] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export default function SimulationView({ topic, userId, conversationId, onInteraction, accessToken, simulationDetection }) {
  const {
    simulation,
    loading,
    error,
    source,
    isValid,
    stepCount,
    refetch,
    detectionConfidence,
    simulationId,
    topicUnderstanding,
    telemetry,
    fallbackUsed,
    submitFeedback,
    feedbackState,
  } = useSimulation(topic, {
    accessToken,
    detection: simulationDetection,
    conversationId,
    userId,
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(800);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentStep(0);
    setPlaying(false);
  }, [simulationId]);

  useEffect(() => {
    if (!playing || !stepCount) return undefined;

    const interval = setInterval(() => {
      setCurrentStep((previous) => {
        if (previous >= stepCount - 1) {
          setPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [playing, speed, stepCount]);

  const activeStep = simulation?.steps?.[currentStep] || null;

  const handleStepChange = useCallback((nextStep) => {
    const bounded = Math.max(0, Math.min(nextStep, Math.max(stepCount - 1, 0)));
    setPlaying(false);
    setCurrentStep(bounded);
    onInteraction?.({
      type: 'simulation_step',
      step: bounded,
      totalSteps: stepCount,
      simulationType: simulation?.type,
      simulationId,
    });
  }, [onInteraction, simulation?.type, simulationId, stepCount]);

  const handleTogglePlay = () => {
    const nextPlaying = !playing;
    if (nextPlaying && currentStep >= stepCount - 1) {
      setCurrentStep(0);
    }
    setPlaying(nextPlaying);
    onInteraction?.({
      type: nextPlaying ? 'simulation_play' : 'simulation_pause',
      step: currentStep,
      simulationId,
    });
  };

  const handleRestart = () => {
    setPlaying(false);
    setCurrentStep(0);
  };

  const handleRegenerate = () => {
    submitFeedback('regenerate', null, 'User requested a regenerated simulation');
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-black/10 bg-[#f8f1df] p-8 text-center text-black">
        <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-[#4c1d95] border-t-transparent animate-spin" />
        <p className="text-sm font-medium">Building adaptive simulation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-black/10 bg-[#f8f1df] p-5 text-black">
        <p className="text-sm font-semibold">The simulation viewer needs a refresh.</p>
        <p className="mt-1 text-sm text-black/70">{error}</p>
        <button
          type="button"
          onClick={() => refetch(topic)}
          className="mt-4 rounded-md bg-[#4c1d95] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5b21b6]"
        >
          Reload
        </button>
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="rounded-lg border border-black/10 bg-[#f8f1df] p-6 text-black">
        <p className="text-sm font-semibold">Choose Simulation from the plus menu to generate an adaptive visual.</p>
        <p className="mt-1 text-sm text-black/70">The viewer will render the generated educational spec here.</p>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto bg-[#f8f1df] p-4 sm:p-6' : ''}`}>
      <section className="rounded-lg border border-black/10 bg-[#f8f1df] p-3 text-black shadow-sm sm:p-4">
        <div className="mb-3 flex flex-col gap-3 border-b border-black/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4c1d95]">
              {topicUnderstanding?.domain || simulation?.type || 'Adaptive simulation'}
            </p>
            <h3 className="truncate text-base font-semibold text-black">
              {topicUnderstanding?.topic || topic || 'Simulation'}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
              {source && <span>{source === 'guided-fallback' ? 'Guided visual' : 'AI generated'}</span>}
              {fallbackUsed && <span>Fallback path</span>}
              {detectionConfidence && <span>{Math.round(detectionConfidence * 100)}% confidence</span>}
              {telemetry?.generation_time_ms && <span>{telemetry.generation_time_ms}ms generation</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => submitFeedback('helpful', 1)}
              disabled={feedbackState.pending}
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black hover:border-[#4c1d95]/40"
            >
              Helpful
            </button>
            <button
              type="button"
              onClick={() => submitFeedback('not_useful', -1)}
              disabled={feedbackState.pending}
              className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black hover:border-[#4c1d95]/40"
            >
              Not useful
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={feedbackState.pending}
              className="rounded-md bg-[#4c1d95] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6]"
            >
              Regenerate
            </button>
            <IconButton
              onClick={() => setIsFullscreen((value) => !value)}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9H5V5m10 4h4V5M9 15H5v4m10-4h4v4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4m8 0h4v4M4 16v4h4m12-4v4h-4" />
                )}
              </svg>
            </IconButton>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
            <AdaptiveSimulationFrame simulation={simulation} currentStep={currentStep} />
          </div>

          <aside className="rounded-lg border border-black/10 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#4c1d95]">
              Step {currentStep + 1} of {stepCount}
            </p>
            <h4 className="mt-2 text-sm font-semibold text-black">
              {activeStep?.title || 'Current step'}
            </h4>
            <p className="mt-2 text-sm leading-6 text-black/70">
              {activeStep?.description || simulation.explanation}
            </p>
            {simulation.explanation && (
              <p className="mt-4 border-t border-black/10 pt-4 text-xs leading-5 text-black/60">
                {simulation.explanation}
              </p>
            )}
          </aside>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-[#4c1d95] transition-all duration-200"
            style={{ width: `${((currentStep + 1) / stepCount) * 100}%` }}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-1">
            <IconButton onClick={handleRestart} disabled={currentStep === 0} title="Restart">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M5 19A9 9 0 0019 5" />
              </svg>
            </IconButton>
            <IconButton onClick={() => handleStepChange(currentStep - 1)} disabled={currentStep === 0} title="Previous step">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </IconButton>
            <IconButton onClick={handleTogglePlay} title={playing ? 'Pause' : 'Play'} className="bg-[#4c1d95] text-white hover:bg-[#5b21b6]">
              {playing ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </IconButton>
            <IconButton onClick={() => handleStepChange(currentStep + 1)} disabled={currentStep >= stepCount - 1} title="Next step">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </IconButton>
          </div>

          <label className="flex flex-1 items-center gap-3 text-xs font-medium text-black/70 sm:justify-end">
            Speed
            <input
              type="range"
              min="400"
              max="1400"
              step="100"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="w-36 accent-[#4c1d95]"
            />
            <span className="w-14 text-right">{SPEED_LABELS[speed] || `${speed}ms`}</span>
          </label>
        </div>

        {feedbackState.error && (
          <p className="mt-3 text-xs text-red-700">{feedbackState.error}</p>
        )}
      </section>
    </div>
  );
}
