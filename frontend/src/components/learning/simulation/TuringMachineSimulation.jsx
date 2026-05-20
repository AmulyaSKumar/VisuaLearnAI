/**
 * TuringMachineSimulation - Visualizes Turing Machine execution
 * Shows tape, head position, state, and transition history
 */
export default function TuringMachineSimulation({ step }) {
  const state = step?.state || {};
  const variables = step?.variables || {};

  const tape = state.tape || [];
  const head = state.head || 0;
  const currentState = state.state || variables.state || 'q0';
  const halted = state.halted;
  const accepted = state.accepted;
  const reading = state.reading;
  const wrote = state.wrote;
  const moved = state.moved;
  const stateChanged = state.stateChanged;
  const timeout = state.timeout;

  // Calculate visible tape window (show 15 cells centered on head)
  const windowSize = 15;
  const startIndex = Math.max(0, head - Math.floor(windowSize / 2));
  const visibleTape = [];
  for (let i = startIndex; i < startIndex + windowSize; i++) {
    visibleTape.push({
      index: i,
      value: tape[i] || '_',
      isHead: i === head
    });
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6">
      {/* Machine state indicator */}
      <div className="flex items-center gap-4">
        <div className={`
          px-4 py-2 rounded-lg font-mono font-bold text-lg
          ${halted ? (accepted ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white') :
            'bg-primary text-primary-foreground'}
        `}>
          State: {currentState}
        </div>
        {halted && (
          <span className={`
            px-3 py-1 rounded-full text-sm font-medium
            ${accepted ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
              timeout ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
              'bg-rose-500/20 text-rose-600 dark:text-rose-400'}
          `}>
            {accepted ? 'ACCEPTED' : timeout ? 'TIMEOUT' : 'HALTED'}
          </span>
        )}
      </div>

      {/* Tape visualization */}
      <div className="flex flex-col items-center gap-2">
        {/* Head indicator */}
        <div className="flex items-center" style={{ marginLeft: `${(head - startIndex) * 48}px` }}>
          <div className="flex flex-col items-center">
            <div className="text-xs text-primary font-semibold mb-1">HEAD</div>
            <div className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-primary"></div>
          </div>
        </div>

        {/* Tape cells */}
        <div className="flex items-center border-2 border-primary/50 rounded">
          {/* Left ellipsis */}
          {startIndex > 0 && (
            <div className="w-8 h-12 flex items-center justify-center text-muted-foreground">
              ···
            </div>
          )}

          {visibleTape.map((cell, i) => (
            <div
              key={i}
              className={`
                w-12 h-12 border-x border-border flex items-center justify-center
                font-mono text-lg font-bold transition-all duration-300
                ${cell.isHead ? 'bg-primary text-primary-foreground scale-110 shadow-lg z-10' :
                  cell.value === '_' ? 'bg-muted/30 text-muted-foreground' :
                  'bg-card text-foreground'}
                ${reading && cell.isHead ? 'animate-pulse ring-2 ring-neutral-500' : ''}
                ${wrote && cell.isHead ? 'ring-2 ring-emerald-500' : ''}
              `}
            >
              {cell.value}
            </div>
          ))}

          {/* Right ellipsis */}
          <div className="w-8 h-12 flex items-center justify-center text-muted-foreground">
            ···
          </div>
        </div>

        {/* Cell indices */}
        <div className="flex items-center">
          {startIndex > 0 && <div className="w-8"></div>}
          {visibleTape.map((cell, i) => (
            <div
              key={i}
              className={`
                w-12 text-center text-xs
                ${cell.isHead ? 'text-primary font-bold' : 'text-muted-foreground'}
              `}
            >
              {cell.index}
            </div>
          ))}
          <div className="w-8"></div>
        </div>
      </div>

      {/* Current action display */}
      <div className="flex flex-wrap gap-4 justify-center">
        {reading && (
          <div className="bg-neutral-500/10 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">Reading</div>
            <div className="font-mono font-bold text-neutral-600 dark:text-neutral-400">'{tape[head] || '_'}'</div>
          </div>
        )}
        {wrote && (
          <div className="bg-emerald-500/10 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Wrote</div>
            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">'{wrote}'</div>
          </div>
        )}
        {moved && (
          <div className="bg-amber-500/10 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Moved</div>
            <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {moved.direction === 'R' ? '→ Right' : moved.direction === 'L' ? '← Left' : '• Stay'}
            </div>
          </div>
        )}
        {stateChanged && (
          <div className="bg-neutral-500/10 rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">State Change</div>
            <div className="font-mono font-bold text-neutral-600 dark:text-neutral-400">
              {stateChanged.from} → {stateChanged.to}
            </div>
          </div>
        )}
      </div>

      {/* Variables panel */}
      <div className="bg-muted/30 rounded-lg p-4 min-w-0 w-full">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Head Position:</span>
            <span className="font-mono font-bold">{head}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current State:</span>
            <span className="font-mono font-bold text-primary">{currentState}</span>
          </div>
          {variables.totalSteps !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Steps:</span>
              <span className="font-mono">{variables.totalSteps}</span>
            </div>
          )}
          {variables.inputTape && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Input:</span>
              <span className="font-mono">{variables.inputTape}</span>
            </div>
          )}
          {state.finalTape && (
            <div className="flex justify-between col-span-2">
              <span className="text-muted-foreground">Final Tape:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{state.finalTape}</span>
            </div>
          )}
        </div>
      </div>

      {/* Transition format hint */}
      <div className="text-xs text-muted-foreground text-center">
        Transition: (state, read) → (write, move, next_state)
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-primary rounded"></div>
          <span className="text-muted-foreground">Head Position</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-muted/30 border border-border rounded"></div>
          <span className="text-muted-foreground">Blank Cell</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-emerald-500 rounded"></div>
          <span className="text-muted-foreground">Accepted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-rose-500 rounded"></div>
          <span className="text-muted-foreground">Halted/Rejected</span>
        </div>
      </div>
    </div>
  );
}
