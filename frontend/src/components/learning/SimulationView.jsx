import { useState, useEffect, useCallback } from 'react';
import useSimulation from '../../hooks/useSimulation';
import ArraySimulation from './simulation/ArraySimulation';
import GraphSimulation from './simulation/GraphSimulation';
import TreeSimulation from './simulation/TreeSimulation';
import GenericSimulation from './simulation/GenericSimulation';

/**
 * SimulationView - Main controller for algorithm simulation playback
 * Supports play/pause, step navigation, speed control, and input editing
 *
 * NEW FEATURES:
 * - User-editable inputs with live regeneration
 * - Enhanced visualization with sorted/current/visited highlights
 * - Complexity display
 * - Algorithm title and description
 */
export default function SimulationView({ topic, userId, onInteraction, accessToken, simulationDetection }) {
  const {
    simulation,
    loading,
    error,
    source,
    isValid,
    stepCount,
    refetch,
    detectionSource,
    detectionConfidence,
    // New features
    generatorKey,
    userInputs,
    inputSchema,
    updateInput,
    regenerateWithInputs
  } = useSimulation(topic, {
    accessToken,
    detection: simulationDetection
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [showInputEditor, setShowInputEditor] = useState(false);
  const [editingInputs, setEditingInputs] = useState({});

  // Reset step when simulation changes
  useEffect(() => {
    setCurrentStep(0);
    setPlaying(false);
  }, [simulation]);

  // Sync editing inputs with userInputs
  useEffect(() => {
    setEditingInputs(userInputs || {});
  }, [userInputs]);

  // Auto-advance when playing
  useEffect(() => {
    if (!playing || !simulation?.steps) return;

    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= simulation.steps.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [playing, simulation, speed]);

  const handleStepChange = useCallback((newStep) => {
    setPlaying(false);
    setCurrentStep(newStep);

    if (onInteraction) {
      onInteraction({
        type: 'simulation_step',
        step: newStep,
        totalSteps: simulation?.steps?.length,
        simulationType: simulation?.type
      });
    }
  }, [simulation, onInteraction]);

  const handleNext = () => {
    if (simulation?.steps) {
      handleStepChange(Math.min(currentStep + 1, simulation.steps.length - 1));
    }
  };

  const handlePrev = () => {
    handleStepChange(Math.max(currentStep - 1, 0));
  };

  const handleReset = () => {
    handleStepChange(0);
  };

  const handleTogglePlay = () => {
    if (!playing && currentStep >= (simulation?.steps?.length || 1) - 1) {
      setCurrentStep(0);
    }
    setPlaying(!playing);

    if (onInteraction) {
      onInteraction({
        type: playing ? 'simulation_pause' : 'simulation_play',
        step: currentStep
      });
    }
  };

  // Handle input changes and regeneration
  const handleInputChange = (key, value) => {
    setEditingInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleRegenerate = () => {
    // Parse array input if it's a string
    const processedInputs = { ...editingInputs };
    if (inputSchema) {
      for (const [key, schema] of Object.entries(inputSchema)) {
        if (schema.type === 'array' && typeof processedInputs[key] === 'string') {
          processedInputs[key] = processedInputs[key]
            .replace(/[\[\]]/g, '')
            .split(/[,\s]+/)
            .map(s => s.trim())
            .filter(s => s !== '')
            .map(Number)
            .filter(n => !isNaN(n));
        }
      }
    }
    regenerateWithInputs(processedInputs);
    setShowInputEditor(false);
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground text-sm">Generating simulation...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 border border-destructive/50 bg-destructive/10 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-destructive mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="font-medium text-destructive">Failed to load simulation</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty/no simulation state
  if (!isValid) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <p>No simulation available for this topic.</p>
        <p className="text-sm mt-1">Try searching for sorting, graph, or tree algorithms.</p>
      </div>
    );
  }

  const stepData = simulation.steps[currentStep];
  const irStepData = simulation.ir?.steps?.[currentStep];

  // Merge step data for visualization
  const mergedStepData = {
    ...stepData,
    // Include new IR highlights if available
    highlights: irStepData?.highlights || stepData?.highlights || {},
    variables: irStepData?.state?.variables || stepData?.variables || {},
    // Include state data for graph/tree visualizations
    state: irStepData?.state || stepData?.state || {},
    meta: irStepData?.meta || stepData?.meta || {}
  };

  // Render type-specific visualization
  const renderVisualization = () => {
    switch (simulation.type) {
      case 'array_sort':
      case 'array_search':
      case 'array':
        return (
          <ArraySimulation
            step={mergedStepData}
            initialArray={simulation.initialArray}
          />
        );
      case 'graph_traversal':
      case 'graph':
        return (
          <GraphSimulation
            step={mergedStepData}
            nodes={simulation.nodes}
            edges={simulation.edges}
          />
        );
      case 'tree_traversal':
      case 'tree':
        return (
          <TreeSimulation
            step={mergedStepData}
            nodes={simulation.nodes}
          />
        );
      default:
        return (
          <GenericSimulation
            step={mergedStepData}
            steps={simulation.steps}
            currentStepIndex={currentStep}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with title and complexity */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {simulation.title && (
            <h3 className="text-lg font-semibold text-foreground">{simulation.title}</h3>
          )}
          {simulation.complexity && (
            <p className="text-xs text-muted-foreground mt-1">
              Time: {simulation.complexity.time} • Space: {simulation.complexity.space}
            </p>
          )}
        </div>

        {/* Edit button */}
        {inputSchema && (
          <button
            onClick={() => setShowInputEditor(!showInputEditor)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Input
          </button>
        )}
      </div>

      {/* Input Editor Panel */}
      {showInputEditor && inputSchema && (
        <div className="p-4 bg-muted/30 rounded-lg border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Edit Simulation Input</span>
            <button
              onClick={() => setShowInputEditor(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {Object.entries(inputSchema).map(([key, schema]) => (
            <div key={key} className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                {schema.label || key}
                {schema.description && (
                  <span className="ml-1 text-muted-foreground/70">({schema.description})</span>
                )}
              </label>
              {schema.type === 'array' ? (
                <input
                  type="text"
                  value={Array.isArray(editingInputs[key]) ? editingInputs[key].join(', ') : editingInputs[key] || ''}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  placeholder="e.g., 5, 3, 8, 2, 7"
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : schema.type === 'number' ? (
                <input
                  type="number"
                  value={editingInputs[key] || ''}
                  onChange={(e) => handleInputChange(key, Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : (
                <input
                  type="text"
                  value={editingInputs[key] || ''}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              )}
            </div>
          ))}

          <button
            onClick={handleRegenerate}
            className="w-full py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Regenerate Simulation
          </button>
        </div>
      )}

      {/* Source indicator */}
      {source && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`
            px-1.5 py-0.5 rounded text-[10px] font-medium
            ${source === 'cache' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
              source === 'template' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
              source === 'fallback' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
              'bg-muted text-muted-foreground'}
          `}>
            {source === 'cache' ? 'Cached' :
             source === 'template' ? 'Instant' :
             source === 'fallback' ? 'Basic' :
             'Generated'}
          </span>

          {detectionSource === 'backend' && detectionConfidence && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">
              Auto-detected ({Math.round(detectionConfidence * 100)}% confidence)
            </span>
          )}

          <span>{stepCount} steps</span>

          {generatorKey && (
            <span className="text-muted-foreground/70">• {generatorKey}</span>
          )}
        </div>
      )}

      {/* Visualization area */}
      <div className="min-h-[280px] border border-border rounded-lg p-4 bg-muted/20 flex items-center justify-center">
        {renderVisualization()}
      </div>

      {/* Step description */}
      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
          <span className="text-sm font-bold text-primary">{currentStep + 1}</span>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-0.5">
            Step {currentStep + 1} of {stepCount}
          </div>
          <p className="text-sm text-foreground">
            {stepData?.description || irStepData?.meta?.description || 'No description available'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-200"
          style={{ width: `${((currentStep + 1) / stepCount) * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Navigation buttons */}
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <button
            onClick={handleReset}
            disabled={currentStep === 0}
            className="p-2 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset to start"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="p-2 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            title="Previous step"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={handleTogglePlay}
            className="p-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
            title={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>

          <button
            onClick={handleNext}
            disabled={currentStep >= stepCount - 1}
            className="p-2 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            title="Next step"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <button
            onClick={() => handleStepChange(stepCount - 1)}
            disabled={currentStep >= stepCount - 1}
            className="p-2 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
            title="Skip to end"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Speed:</span>
          <input
            type="range"
            min="200"
            max="2000"
            step="100"
            value={2200 - speed}
            onChange={(e) => setSpeed(2200 - Number(e.target.value))}
            className="w-20 h-1.5 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
          />
          <span className="text-xs text-muted-foreground w-8">
            {speed < 500 ? 'Fast' : speed > 1500 ? 'Slow' : 'Med'}
          </span>
        </div>
      </div>
    </div>
  );
}
