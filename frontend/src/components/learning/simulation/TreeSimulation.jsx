import { useMemo } from 'react';

/**
 * TreeSimulation - Visualizes tree traversal algorithms
 * Uses simple hierarchical layout (V1: no fancy tree balancing)
 * Shows current node, traversal order, and pending stack
 */
export default function TreeSimulation({ step, nodes = [] }) {
  const current = step?.current || '';
  const traversalOrder = step?.traversalOrder || [];
  const stack = step?.stack || [];

  // Build tree structure from nodes array
  const tree = useMemo(() => {
    if (!nodes.length) return null;

    // Create lookup map
    const nodeMap = {};
    nodes.forEach(node => {
      nodeMap[node.id] = { ...node };
    });

    // Find root (node with id "1" or first node)
    const root = nodeMap['1'] || nodes[0];
    return { nodeMap, root };
  }, [nodes]);

  // Calculate positions for tree nodes
  const nodePositions = useMemo(() => {
    if (!tree) return {};

    const positions = {};
    const width = 280;
    const height = 200;
    const levelHeight = 60;

    // BFS to assign positions
    const queue = [{ node: tree.root, level: 0, position: 0.5 }];
    const levelCounts = {};

    while (queue.length > 0) {
      const { node, level, position } = queue.shift();

      if (!levelCounts[level]) {
        levelCounts[level] = 0;
      }

      positions[node.id] = {
        x: position * width,
        y: level * levelHeight + 30
      };

      // Add children
      const leftPos = position - 0.25 / (level + 1);
      const rightPos = position + 0.25 / (level + 1);

      if (node.left && tree.nodeMap[node.left]) {
        queue.push({
          node: tree.nodeMap[node.left],
          level: level + 1,
          position: leftPos
        });
      }
      if (node.right && tree.nodeMap[node.right]) {
        queue.push({
          node: tree.nodeMap[node.right],
          level: level + 1,
          position: rightPos
        });
      }
    }

    return positions;
  }, [tree]);

  // Get node styling based on state
  const getNodeStyle = (nodeId, value) => {
    const isVisited = traversalOrder.includes(value);
    const isCurrent = nodeId === current;
    const isInStack = stack.includes(nodeId);

    if (isCurrent) {
      return {
        fill: '#10b981', // emerald-500
        stroke: '#059669',
        textColor: 'white'
      };
    }
    if (isVisited) {
      return {
        fill: '#3b82f6', // blue-500
        stroke: '#2563eb',
        textColor: 'white'
      };
    }
    if (isInStack) {
      return {
        fill: '#f59e0b', // amber-500
        stroke: '#d97706',
        textColor: 'white'
      };
    }
    return {
      fill: 'var(--color-muted)',
      stroke: 'var(--color-border)',
      textColor: 'var(--color-foreground)'
    };
  };

  if (!tree) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No tree data available
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Tree visualization */}
      <svg width="280" height="200" className="overflow-visible">
        {/* Edges (draw first so nodes appear on top) */}
        {nodes.map(node => {
          const pos = nodePositions[node.id];
          if (!pos) return null;

          return (
            <g key={`edges-${node.id}`}>
              {node.left && nodePositions[node.left] && (
                <line
                  x1={pos.x}
                  y1={pos.y}
                  x2={nodePositions[node.left].x}
                  y2={nodePositions[node.left].y}
                  stroke="var(--color-border)"
                  strokeWidth={2}
                />
              )}
              {node.right && nodePositions[node.right] && (
                <line
                  x1={pos.x}
                  y1={pos.y}
                  x2={nodePositions[node.right].x}
                  y2={nodePositions[node.right].y}
                  stroke="var(--color-border)"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const pos = nodePositions[node.id];
          if (!pos) return null;

          const style = getNodeStyle(node.id, node.value);
          const isCurrent = node.id === current;

          return (
            <g key={node.id} className="transition-all duration-300">
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isCurrent ? 22 : 18}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={isCurrent ? 3 : 2}
                className="transition-all duration-300"
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={style.textColor}
                fontSize={isCurrent ? 14 : 12}
                fontWeight={isCurrent ? 'bold' : 'normal'}
              >
                {node.value}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Traversal order display */}
      <div className="flex flex-col items-center gap-2">
        <div className="text-xs font-medium text-muted-foreground">
          Traversal Order:
        </div>
        <div className="flex gap-1 flex-wrap justify-center">
          {traversalOrder.length > 0 ? (
            traversalOrder.map((value, index) => (
              <span
                key={`order-${index}`}
                className="px-2 py-1 bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded text-sm font-mono"
              >
                {value}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground text-sm">(empty)</span>
          )}
        </div>
      </div>

      {/* Stack display */}
      {stack.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <div className="text-xs font-medium text-muted-foreground">
            Stack:
          </div>
          <div className="flex gap-1">
            {stack.map((nodeId, index) => {
              const node = tree.nodeMap[nodeId];
              return (
                <span
                  key={`stack-${index}`}
                  className="px-2 py-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded text-sm font-mono"
                >
                  {node?.value || nodeId}
                </span>
              );
            })}
          </div>
        </div>
      )}

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
          <span>In Stack</span>
        </div>
      </div>
    </div>
  );
}
