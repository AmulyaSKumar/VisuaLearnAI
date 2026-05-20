/**
 * StackSimulation - Visualizes stack operations (push, pop, peek)
 * Shows vertical stack with operation animations
 */
export default function StackSimulation({ step }) {
  const state = step?.state || {};
  const variables = step?.variables || {};
  const highlights = step?.highlights || {};

  const stack = state.stack || variables.stack || [];
  const maxSize = state.maxSize || variables.maxSize || 10;
  const operation = state.operation || variables.operation;
  const currentOp = state.currentOp || {};
  const pushing = state.pushing;
  const popping = state.popping;

  // Calculate display height
  const displayStack = [...stack];
  const emptySlots = maxSize - displayStack.length;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6">
      {/* Operation indicator */}
      {operation && (
        <div className="text-center">
          <span className={`
            inline-block px-3 py-1 rounded-full text-sm font-medium
            ${operation.includes('push') ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
              operation.includes('pop') ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
              operation.includes('peek') ? 'bg-neutral-500/20 text-neutral-600 dark:text-neutral-400' :
              'bg-muted text-muted-foreground'}
          `}>
            {operation}
          </span>
        </div>
      )}

      <div className="flex items-end gap-8">
        {/* Stack visualization */}
        <div className="flex flex-col items-center">
          {/* Incoming value for push */}
          {pushing !== undefined && (
            <div className="mb-2 animate-bounce">
              <div className="w-16 h-10 bg-emerald-500 text-white rounded flex items-center justify-center font-mono font-bold shadow-lg">
                {pushing}
              </div>
              <div className="text-center text-xs text-emerald-600 dark:text-emerald-400 mt-1">↓ push</div>
            </div>
          )}

          {/* Stack container */}
          <div className="border-2 border-primary/50 border-t-0 rounded-b-lg p-1 bg-muted/30">
            {/* Empty slots */}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="w-16 h-10 border border-dashed border-muted-foreground/30 rounded mb-1 flex items-center justify-center"
              >
                <span className="text-xs text-muted-foreground/30">-</span>
              </div>
            ))}

            {/* Stack elements (top to bottom display) */}
            {displayStack.slice().reverse().map((item, displayIndex) => {
              const actualIndex = displayStack.length - 1 - displayIndex;
              const isTop = actualIndex === displayStack.length - 1;
              const isPopping = popping !== undefined && isTop;

              return (
                <div
                  key={`item-${actualIndex}`}
                  className={`
                    w-16 h-10 rounded mb-1 flex items-center justify-center
                    font-mono font-bold transition-all duration-300
                    ${isPopping ? 'bg-rose-500 text-white animate-pulse scale-110' :
                      isTop ? 'bg-primary text-primary-foreground shadow-md' :
                      'bg-muted text-foreground'}
                  `}
                >
                  {item}
                </div>
              );
            })}
          </div>

          {/* Base indicator */}
          <div className="w-20 h-2 bg-primary/70 rounded-b-lg"></div>
          <span className="text-xs text-muted-foreground mt-1">Stack Base</span>
        </div>

        {/* Stack info panel */}
        <div className="bg-muted/50 rounded-lg p-4 min-w-[140px]">
          <h4 className="text-sm font-semibold mb-3 text-foreground">Stack Info</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size:</span>
              <span className="font-mono">{stack.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max:</span>
              <span className="font-mono">{maxSize}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Top:</span>
              <span className="font-mono font-bold text-primary">
                {stack.length > 0 ? stack[stack.length - 1] : '-'}
              </span>
            </div>
            {variables.overflow && (
              <div className="text-rose-500 text-xs font-medium">
                Stack overflow
              </div>
            )}
            {variables.underflow && (
              <div className="text-amber-500 text-xs font-medium">
                Stack underflow
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Operation history */}
      {state.history && state.history.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center max-w-md">
          {state.history.slice(-8).map((op, i) => (
            <span
              key={i}
              className={`
                text-xs px-2 py-0.5 rounded
                ${op.type === 'push' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                  op.type === 'pop' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                  'bg-muted text-muted-foreground'}
              `}
            >
              {op.type}({op.value !== undefined ? op.value : ''})
            </span>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 text-xs mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-primary rounded"></div>
          <span className="text-muted-foreground">Top</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-muted rounded"></div>
          <span className="text-muted-foreground">Element</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border border-dashed border-muted-foreground/30 rounded"></div>
          <span className="text-muted-foreground">Empty</span>
        </div>
      </div>
    </div>
  );
}
