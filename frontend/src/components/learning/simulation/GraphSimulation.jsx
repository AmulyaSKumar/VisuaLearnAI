import { useMemo } from 'react';

/**
 * GraphSimulation - Visualizes graph traversal algorithms
 * Uses simple circular layout for nodes (V1: no force-directed physics)
 * Shows visited nodes, current node, and pending queue/stack
 */
export default function GraphSimulation({ step, nodes = [], edges = [] }) {
  const visited = step?.visited || [];
  const current = step?.current || '';
  const queue = step?.queue || step?.stack || [];

  // Calculate node positions in a circle
  const nodePositions = useMemo(() => {
    const positions = {};
    const centerX = 150;
    const centerY = 120;
    const radius = 80;

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length - Math.PI / 2;
      positions[node] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    return positions;
  }, [nodes]);

  // Get node styling based on state
  const getNodeStyle = (node) => {
    if (node === current) {
      return {
        fill: '#10b981', // emerald-500
        stroke: '#059669', // emerald-600
        textColor: 'white'
      };
    }
    if (visited.includes(node)) {
      return {
        fill: '#3b82f6', // blue-500
        stroke: '#2563eb', // blue-600
        textColor: 'white'
      };
    }
    if (queue.includes(node)) {
      return {
        fill: '#f59e0b', // amber-500
        stroke: '#d97706', // amber-600
        textColor: 'white'
      };
    }
    return {
      fill: 'var(--color-muted)',
      stroke: 'var(--color-border)',
      textColor: 'var(--color-foreground)'
    };
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Graph visualization */}
      <svg width="300" height="240" className="overflow-visible">
        {/* Edges */}
        {edges.map(([from, to], index) => {
          const fromPos = nodePositions[from];
          const toPos = nodePositions[to];
          if (!fromPos || !toPos) return null;

          const isVisitedEdge = visited.includes(from) && visited.includes(to);

          return (
            <line
              key={`edge-${index}`}
              x1={fromPos.x}
              y1={fromPos.y}
              x2={toPos.x}
              y2={toPos.y}
              stroke={isVisitedEdge ? '#3b82f6' : 'var(--color-border)'}
              strokeWidth={isVisitedEdge ? 2.5 : 1.5}
              className="transition-all duration-300"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = nodePositions[node];
          if (!pos) return null;

          const style = getNodeStyle(node);
          const isCurrent = node === current;

          return (
            <g key={node} className="transition-all duration-300">
              {/* Node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isCurrent ? 24 : 20}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={isCurrent ? 3 : 2}
                className="transition-all duration-300"
              />
              {/* Node label */}
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={style.textColor}
                fontSize={isCurrent ? 16 : 14}
                fontWeight={isCurrent ? 'bold' : 'normal'}
                className="transition-all duration-300"
              >
                {node}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Queue/Stack display */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs font-medium text-muted-foreground">
          {step?.queue ? 'Queue' : 'Stack'}:
        </div>
        <div className="flex gap-1">
          {queue.length > 0 ? (
            queue.map((node, index) => (
              <span
                key={`queue-${index}`}
                className="px-2 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded text-sm font-mono"
              >
                {node}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">(empty)</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Visited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span>In Queue</span>
        </div>
      </div>
    </div>
  );
}
