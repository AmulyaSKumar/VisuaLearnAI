import { useMemo } from 'react';

/**
 * StateMachineSimulation - Visualizes Finite Automata (DFA/NFA)
 * Shows states as nodes, transitions as edges, and input processing
 */
export default function StateMachineSimulation({ step }) {
  const state = step?.state || {};
  const highlights = step?.highlights || {};

  // Get automaton data
  const automaton = state.automaton || {};
  const input = state.input || '';
  const position = state.position ?? -1;
  const variables = state.variables || {};

  // Automaton structure
  const {
    states = [],
    transitions = {},
    startState,
    acceptStates = []
  } = automaton;

  // For NFA, currentStates is an array
  const currentStates = state.currentStates || (state.currentState ? [state.currentState] : []);

  // Highlights
  const {
    currentState: highlightCurrent,
    previousState,
    transition,
    accepted,
    rejected,
    dead,
    complete,
    checking,
    acceptingStates = []
  } = highlights;

  // Layout states in a circle
  const statePositions = useMemo(() => {
    const positions = {};
    const n = states.length;
    const radius = 100;
    const centerX = 150;
    const centerY = 120;

    states.forEach((s, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      positions[s] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    return positions;
  }, [states]);

  // Get state style
  const getStateStyle = (s) => {
    const isAcceptState = acceptStates.includes(s);
    const isCurrent = currentStates.includes(s) || highlightCurrent === s;
    const isPrevious = previousState === s;
    const isAccepting = acceptingStates.includes(s);

    if (dead) {
      return 'fill-slate-300 dark:fill-slate-600 stroke-slate-400';
    }
    if (rejected && isCurrent) {
      return 'fill-red-500 stroke-red-600';
    }
    if (accepted && isAccepting) {
      return 'fill-emerald-500 stroke-emerald-600';
    }
    if (isCurrent) {
      return 'fill-amber-500 stroke-amber-600';
    }
    if (isPrevious) {
      return 'fill-blue-400 stroke-blue-500';
    }
    if (isAcceptState) {
      return 'fill-emerald-200 dark:fill-emerald-800 stroke-emerald-500';
    }
    return 'fill-muted stroke-border';
  };

  // Build transition edges for rendering
  const transitionEdges = useMemo(() => {
    const edges = [];
    const edgeMap = new Map(); // Group transitions by state pair

    for (const [key, value] of Object.entries(transitions)) {
      const [from, symbol] = key.split(',');
      const targets = Array.isArray(value) ? value : [value];

      for (const to of targets) {
        const edgeKey = `${from}-${to}`;
        if (!edgeMap.has(edgeKey)) {
          edgeMap.set(edgeKey, { from, to, symbols: [] });
        }
        edgeMap.get(edgeKey).symbols.push(symbol);
      }
    }

    edgeMap.forEach((edge) => {
      edges.push({
        ...edge,
        label: edge.symbols.join(','),
        isSelfLoop: edge.from === edge.to
      });
    });

    return edges;
  }, [transitions]);

  // Render input string with position highlight
  const renderInput = () => (
    <div className="flex items-center justify-center gap-1 font-mono text-lg">
      {input.split('').map((char, i) => (
        <span
          key={i}
          className={`
            px-2 py-1 rounded transition-all
            ${i === position ? 'bg-amber-500 text-white scale-110' :
              i < position ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
              'bg-muted text-muted-foreground'}
          `}
        >
          {char}
        </span>
      ))}
      {input.length === 0 && (
        <span className="text-muted-foreground italic">ε (empty)</span>
      )}
    </div>
  );

  // Render SVG automaton
  const renderAutomaton = () => (
    <svg viewBox="0 0 300 240" className="w-full max-w-md mx-auto">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            className="fill-muted-foreground"
          />
        </marker>
        <marker
          id="arrowhead-active"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            className="fill-amber-500"
          />
        </marker>
      </defs>

      {/* Transition edges */}
      {transitionEdges.map((edge, i) => {
        const fromPos = statePositions[edge.from];
        const toPos = statePositions[edge.to];
        if (!fromPos || !toPos) return null;

        const isActive = transition?.from === edge.from && transition?.to === edge.to;

        if (edge.isSelfLoop) {
          // Self-loop
          const loopRadius = 20;
          return (
            <g key={i}>
              <path
                d={`M ${fromPos.x} ${fromPos.y - 25}
                    C ${fromPos.x - 30} ${fromPos.y - 60},
                      ${fromPos.x + 30} ${fromPos.y - 60},
                      ${fromPos.x} ${fromPos.y - 25}`}
                fill="none"
                className={isActive ? 'stroke-amber-500 stroke-2' : 'stroke-muted-foreground'}
                markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
              />
              <text
                x={fromPos.x}
                y={fromPos.y - 55}
                textAnchor="middle"
                className={`text-[10px] ${isActive ? 'fill-amber-500 font-bold' : 'fill-muted-foreground'}`}
              >
                {edge.label}
              </text>
            </g>
          );
        }

        // Calculate edge path
        const dx = toPos.x - fromPos.x;
        const dy = toPos.y - fromPos.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / len;
        const ny = dy / len;

        // Start and end points (offset from center)
        const startX = fromPos.x + nx * 25;
        const startY = fromPos.y + ny * 25;
        const endX = toPos.x - nx * 28;
        const endY = toPos.y - ny * 28;

        // Midpoint for label
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        // Offset label perpendicular to edge
        const perpX = -ny * 12;
        const perpY = nx * 12;

        return (
          <g key={i}>
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              className={isActive ? 'stroke-amber-500 stroke-2' : 'stroke-muted-foreground'}
              markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
            />
            <text
              x={midX + perpX}
              y={midY + perpY}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-[10px] ${isActive ? 'fill-amber-500 font-bold' : 'fill-muted-foreground'}`}
            >
              {edge.label}
            </text>
          </g>
        );
      })}

      {/* Start arrow */}
      {startState && statePositions[startState] && (
        <line
          x1={statePositions[startState].x - 50}
          y1={statePositions[startState].y}
          x2={statePositions[startState].x - 28}
          y2={statePositions[startState].y}
          className="stroke-muted-foreground stroke-2"
          markerEnd="url(#arrowhead)"
        />
      )}

      {/* State nodes */}
      {states.map((s) => {
        const pos = statePositions[s];
        if (!pos) return null;

        const isAcceptState = acceptStates.includes(s);
        const isCurrent = currentStates.includes(s) || highlightCurrent === s;

        return (
          <g key={s}>
            {/* Outer ring for accept states */}
            {isAcceptState && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={28}
                fill="none"
                className="stroke-emerald-500 stroke-2"
              />
            )}
            {/* Main circle */}
            <circle
              cx={pos.x}
              cy={pos.y}
              r={22}
              className={`${getStateStyle(s)} stroke-2 transition-all duration-300`}
            />
            {/* Pulse animation for current */}
            {isCurrent && !dead && !complete && (
              <circle
                cx={pos.x}
                cy={pos.y}
                r={22}
                fill="none"
                className="stroke-amber-400 stroke-2 animate-ping opacity-50"
              />
            )}
            {/* State label */}
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className={`text-xs font-medium ${
                isCurrent && !dead ? 'fill-white' :
                acceptingStates.includes(s) && accepted ? 'fill-white' :
                'fill-foreground'
              }`}
            >
              {s}
            </text>
          </g>
        );
      })}
    </svg>
  );

  // Render current states (for NFA)
  const renderCurrentStates = () => {
    if (currentStates.length <= 1) return null;

    return (
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground">Active states:</span>
        <div className="flex gap-1">
          {currentStates.map((s) => (
            <span
              key={s}
              className={`
                px-2 py-0.5 rounded text-xs font-medium
                ${acceptStates.includes(s) ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}
              `}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Result display
  const renderResult = () => {
    if (!complete) return null;

    return (
      <div className={`
        flex items-center justify-center gap-2 p-3 rounded-lg text-lg font-bold
        ${accepted ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
          'bg-red-500/20 text-red-600 dark:text-red-400'}
      `}>
        {accepted ? '✓ ACCEPTED' : '✗ REJECTED'}
      </div>
    );
  };

  if (!states.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No automaton data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Input string */}
      <div className="p-3 bg-muted/20 rounded-lg">
        <div className="text-xs text-muted-foreground text-center mb-2">Input String</div>
        {renderInput()}
      </div>

      {/* Automaton visualization */}
      <div className="p-2 bg-muted/20 rounded-lg">
        {renderAutomaton()}
      </div>

      {/* Current states (NFA) */}
      {renderCurrentStates()}

      {/* Result */}
      {renderResult()}

      {/* Variables display */}
      {Object.keys(variables).length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs bg-muted/30 px-3 py-2 rounded-lg">
          {Object.entries(variables).map(([key, value]) => {
            if (typeof value === 'object' || key === 'showStructure') return null;
            const displayKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            return (
              <div key={key} className="flex items-center gap-1">
                <span className="text-muted-foreground">{displayKey}:</span>
                <span className="font-mono font-medium text-foreground">{String(value)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-amber-500"></div>
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-emerald-200 dark:bg-emerald-800 ring-2 ring-emerald-500"></div>
          <span>Accept State</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-muted border-2 border-border"></div>
          <span>Regular State</span>
        </div>
      </div>
    </div>
  );
}
