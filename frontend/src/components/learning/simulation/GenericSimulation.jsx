/**
 * GenericSimulation - Fallback renderer for any step-based simulation
 * Handles: { step, description, state?, highlight?, ... }
 * Simple timeline/step view for unknown or new simulation types
 */
export default function GenericSimulation({ step, steps = [], currentStepIndex = 0 }) {
  if (!step) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No simulation data available</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-4 px-2">
        <span className="text-xs text-muted-foreground">
          Step {step.step || currentStepIndex + 1}
        </span>
        {steps.length > 0 && (
          <span className="text-xs text-muted-foreground">
            of {steps.length}
          </span>
        )}
      </div>

      {/* Main visualization area */}
      <div className="bg-muted/30 rounded-lg p-6 min-h-[200px]">
        {/* State display - handles various formats */}
        {step.array && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Current State:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {step.array.map((val, idx) => {
                const isHighlighted = step.highlight?.includes(idx);
                return (
                  <div
                    key={idx}
                    className={`
                      w-12 h-12 flex items-center justify-center
                      rounded-md border-2 font-mono text-sm font-bold
                      transition-all duration-200
                      ${isHighlighted
                        ? 'border-primary bg-primary/20 text-primary scale-110'
                        : 'border-border bg-background text-foreground'
                      }
                      ${step.swap && isHighlighted ? 'ring-2 ring-primary ring-offset-2' : ''}
                    `}
                  >
                    {val}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Visited nodes (for graph/tree) */}
        {step.visited && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Visited:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {step.visited.map((node, idx) => (
                <span
                  key={idx}
                  className={`
                    px-3 py-1 rounded-full text-sm font-medium
                    ${node === step.current
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                    }
                  `}
                >
                  {node}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Queue/Stack display */}
        {(step.queue || step.stack) && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">
              {step.queue ? 'Queue:' : 'Stack:'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {(step.queue || step.stack).map((node, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 rounded-md border border-border text-sm"
                >
                  {node}
                </span>
              ))}
              {(step.queue || step.stack).length === 0 && (
                <span className="text-sm text-muted-foreground italic">empty</span>
              )}
            </div>
          </div>
        )}

        {/* Traversal order */}
        {step.traversalOrder && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Traversal Order:</p>
            <div className="flex flex-wrap gap-1 justify-center items-center">
              {step.traversalOrder.map((val, idx) => (
                <span key={idx} className="flex items-center">
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded text-sm font-medium">
                    {val}
                  </span>
                  {idx < step.traversalOrder.length - 1 && (
                    <span className="mx-1 text-muted-foreground">→</span>
                  )}
                </span>
              ))}
              {step.traversalOrder.length === 0 && (
                <span className="text-sm text-muted-foreground italic">none yet</span>
              )}
            </div>
          </div>
        )}

        {/* Current node indicator */}
        {step.current && (
          <div className="text-center mb-4">
            <span className="text-xs text-muted-foreground">Current: </span>
            <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-sm font-bold">
              {step.current}
            </span>
          </div>
        )}

        {/* Generic state object display */}
        {step.state && typeof step.state === 'object' && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">State:</p>
            <pre className="bg-background p-3 rounded-md text-xs font-mono overflow-x-auto">
              {JSON.stringify(step.state, null, 2)}
            </pre>
          </div>
        )}

        {/* Description */}
        {step.description && (
          <div className="text-center pt-4 border-t border-border mt-4">
            <p className="text-sm text-foreground">{step.description}</p>
          </div>
        )}
      </div>

      {/* Progress dots */}
      {steps.length > 1 && steps.length <= 20 && (
        <div className="flex justify-center gap-1 mt-4">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`
                w-2 h-2 rounded-full transition-all
                ${idx === currentStepIndex
                  ? 'bg-primary w-4'
                  : idx < currentStepIndex
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }
              `}
            />
          ))}
        </div>
      )}
    </div>
  );
}
