import { useMemo } from 'react';

/**
 * GraphSimulation - Visualizes graph traversal algorithms
 * Supports BFS, DFS, Dijkstra with animated step-by-step visualization
 *
 * Enhanced features:
 * - Support for weighted edges (Dijkstra)
 * - Edge highlighting during traversal
 * - Distance labels for shortest path algorithms
 * - Dynamic legend based on active highlights
 */
export default function GraphSimulation({ step, nodes = [], edges = [] }) {
  // Extract state from new IR format or legacy format
  const graphData = step?.state?.graph || { nodes, edges };
  const actualNodes = graphData.nodes || nodes || [];
  const actualEdges = graphData.edges || edges || [];

  // Highlights from new IR format
  const highlights = step?.highlights || {};
  const current = highlights.current || step?.current || null;
  const visited = highlights.visited || step?.visited || [];
  const queue = highlights.queue || step?.queue || step?.state?.queue || [];
  const stack = highlights.stack || step?.stack || step?.state?.stack || [];
  const exploringNode = highlights.exploring || null;
  const highlightedEdge = highlights.edge || null;
  const path = highlights.path || step?.state?.traversalOrder || [];

  // Distance info for Dijkstra
  const distances = step?.state?.distances || {};
  const isDijkstra = Object.keys(distances).length > 0;

  // Calculate node positions in a circle
  const nodePositions = useMemo(() => {
    const positions = {};
    const centerX = 175;
    const centerY = 140;
    const radius = 100;

    actualNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / actualNodes.length - Math.PI / 2;
      positions[node] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });

    return positions;
  }, [actualNodes]);

  // Check if an edge matches the highlighted edge
  const isEdgeHighlighted = (from, to) => {
    if (!highlightedEdge) return false;
    const [e1, e2] = highlightedEdge;
    return (from === e1 && to === e2) || (from === e2 && to === e1);
  };

  // Check if an edge is part of the visited path
  const isEdgeInPath = (from, to) => {
    if (path.length < 2) return false;
    for (let i = 0; i < path.length - 1; i++) {
      if ((path[i] === from && path[i + 1] === to) || (path[i] === to && path[i + 1] === from)) {
        return true;
      }
    }
    return false;
  };

  // Get node styling based on state
  const getNodeStyle = (node) => {
    if (node === current) {
      return {
        fill: '#10b981', // emerald-500
        stroke: '#059669', // emerald-600
        textColor: 'white',
        scale: 1.2
      };
    }
    if (node === exploringNode) {
      return {
        fill: '#111111',
        stroke: '#111111',
        textColor: 'white',
        scale: 1.1
      };
    }
    if (visited.includes(node)) {
      return {
        fill: '#111111', // blue-500
        stroke: '#000000', // blue-600
        textColor: 'white',
        scale: 1
      };
    }
    if (queue.includes(node) || stack.includes(node)) {
      return {
        fill: '#f59e0b', // amber-500
        stroke: '#d97706', // amber-600
        textColor: 'white',
        scale: 1
      };
    }
    return {
      fill: 'var(--color-muted)',
      stroke: 'var(--color-border)',
      textColor: 'var(--color-foreground)',
      scale: 1
    };
  };

  // Get edge styling
  const getEdgeStyle = (from, to) => {
    if (isEdgeHighlighted(from, to)) {
      return {
        stroke: '#111111',
        strokeWidth: 3,
        opacity: 1
      };
    }
    if (isEdgeInPath(from, to)) {
      return {
        stroke: '#10b981', // emerald-500
        strokeWidth: 2.5,
        opacity: 1
      };
    }
    if (visited.includes(from) && visited.includes(to)) {
      return {
        stroke: '#111111', // blue-500
        strokeWidth: 2,
        opacity: 0.8
      };
    }
    return {
      stroke: 'var(--color-border)',
      strokeWidth: 1.5,
      opacity: 0.5
    };
  };

  // Pending items (queue or stack)
  const pendingItems = queue.length > 0 ? queue : stack;
  const pendingLabel = queue.length > 0 ? 'Queue' : stack.length > 0 ? 'Stack' : 'Pending';

  // Build active legend items
  const legendItems = useMemo(() => {
    const items = [];
    if (current) items.push({ color: 'bg-emerald-500', label: 'Current' });
    if (exploringNode) items.push({ color: 'bg-neutral-500', label: 'Exploring' });
    if (visited.length > 0) items.push({ color: 'bg-neutral-500', label: 'Visited' });
    if (pendingItems.length > 0) items.push({ color: 'bg-amber-500', label: pendingLabel });
    return items;
  }, [current, exploringNode, visited, pendingItems, pendingLabel]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Graph visualization */}
      <svg width="350" height="280" className="overflow-visible">
        {/* Edges */}
        {actualEdges.map((edge, index) => {
          const [from, to, weight] = Array.isArray(edge) ? edge : [edge.from, edge.to, edge.weight];
          const fromPos = nodePositions[from];
          const toPos = nodePositions[to];
          if (!fromPos || !toPos) return null;

          const style = getEdgeStyle(from, to);
          const midX = (fromPos.x + toPos.x) / 2;
          const midY = (fromPos.y + toPos.y) / 2;

          return (
            <g key={`edge-${index}`}>
              <line
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                opacity={style.opacity}
                className="transition-all duration-300"
              />
              {/* Weight label for weighted graphs */}
              {weight !== undefined && (
                <g>
                  <circle
                    cx={midX}
                    cy={midY}
                    r={10}
                    fill="var(--color-background)"
                    stroke="var(--color-border)"
                    strokeWidth={1}
                  />
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--color-foreground)"
                    fontSize={10}
                    fontWeight="medium"
                  >
                    {weight}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {actualNodes.map((node) => {
          const pos = nodePositions[node];
          if (!pos) return null;

          const style = getNodeStyle(node);
          const nodeRadius = 22 * style.scale;
          const distance = distances[node];

          return (
            <g key={node} className="transition-all duration-300">
              {/* Node circle */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={nodeRadius}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.scale > 1 ? 3 : 2}
                className="transition-all duration-300"
              />
              {/* Node label */}
              <text
                x={pos.x}
                y={pos.y - (isDijkstra ? 4 : 0)}
                textAnchor="middle"
                dominantBaseline="central"
                fill={style.textColor}
                fontSize={style.scale > 1 ? 16 : 14}
                fontWeight={style.scale > 1 ? 'bold' : 'medium'}
                className="transition-all duration-300"
              >
                {node}
              </text>
              {/* Distance label for Dijkstra */}
              {isDijkstra && (
                <text
                  x={pos.x}
                  y={pos.y + 10}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={style.textColor}
                  fontSize={10}
                  opacity={0.9}
                >
                  {distance}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Queue/Stack display */}
      {pendingItems.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            {pendingLabel}:
          </div>
          <div className="flex gap-1 flex-wrap justify-center">
            {pendingItems.map((node, index) => (
              <span
                key={`pending-${index}`}
                className="px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded text-sm font-mono"
              >
                {node}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Traversal order display */}
      {path.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            Traversal Order:
          </div>
          <div className="flex gap-1 flex-wrap justify-center items-center">
            {path.map((node, index) => (
              <span key={`path-${index}`} className="flex items-center">
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded text-sm font-mono">
                  {node}
                </span>
                {index < path.length - 1 && (
                  <span className="mx-1 text-muted-foreground">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Distance table for Dijkstra */}
      {isDijkstra && Object.keys(distances).length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            Distances from source:
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {Object.entries(distances).map(([node, dist]) => (
              <span
                key={`dist-${node}`}
                className={`px-2 py-0.5 rounded text-xs font-mono ${
                  node === current
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : visited.includes(node)
                      ? 'bg-neutral-500/20 text-neutral-700 dark:text-neutral-300'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {node}={dist}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {legendItems.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {legendItems.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
