import { useMemo } from 'react';

/**
 * TreeSimulation - Visualizes tree traversal and BST algorithms
 * Supports inorder, preorder, postorder traversals and BST insert/search
 *
 * Enhanced features:
 * - Support for new IR format
 * - Path highlighting for BST operations
 * - Direction indicators (left/right)
 * - Dynamic legend based on active state
 */
export default function TreeSimulation({ step, nodes = [] }) {
  // Extract data from new IR format or legacy format
  const treeData = step?.state?.tree || { nodes };
  const actualNodes = treeData.nodes || nodes || [];

  // Highlights from new IR format
  const highlights = step?.highlights || {};
  const current = highlights.current || step?.current || null;
  const visited = highlights.visited || new Set();
  const visitedArray = Array.isArray(visited) ? visited : [...visited];
  const traversalOrder = step?.traversalOrder || step?.state?.traversalOrder || [];
  const stack = highlights.stack || step?.stack || step?.state?.stack || [];
  const path = highlights.path || step?.path || step?.state?.path || [];
  const direction = highlights.direction || step?.direction || step?.state?.direction;
  const inserted = highlights.inserted || step?.inserted;
  const found = highlights.found;
  const notFound = highlights.notFound;

  // Build tree structure from nodes array
  const tree = useMemo(() => {
    if (!actualNodes.length) return null;

    // Create lookup map
    const nodeMap = {};
    actualNodes.forEach(node => {
      nodeMap[node.id] = { ...node };
    });

    // Find root (node with id "1" or first node)
    const root = nodeMap['1'] || actualNodes[0];
    return { nodeMap, root };
  }, [actualNodes]);

  // Calculate positions for tree nodes (improved layout)
  const nodePositions = useMemo(() => {
    if (!tree) return {};

    const positions = {};
    const width = 320;
    const levelHeight = 55;

    // BFS to assign positions with better spacing
    const queue = [{ node: tree.root, level: 0, position: 0.5, minX: 0, maxX: 1 }];

    while (queue.length > 0) {
      const { node, level, position, minX, maxX } = queue.shift();
      if (!node) continue;

      positions[node.id] = {
        x: position * width,
        y: level * levelHeight + 35
      };

      const childWidth = (maxX - minX) / 2;

      // Add children with proper spacing
      if (node.left && tree.nodeMap[node.left]) {
        const leftPos = (minX + position * width / width) / 2;
        queue.push({
          node: tree.nodeMap[node.left],
          level: level + 1,
          position: position - childWidth / 2,
          minX: minX,
          maxX: position
        });
      }
      if (node.right && tree.nodeMap[node.right]) {
        queue.push({
          node: tree.nodeMap[node.right],
          level: level + 1,
          position: position + childWidth / 2,
          minX: position,
          maxX: maxX
        });
      }
    }

    return positions;
  }, [tree]);

  // Get node styling based on state
  const getNodeStyle = (nodeId, value) => {
    const isInPath = path.includes(nodeId);
    const isVisited = visitedArray.includes(nodeId) || traversalOrder.includes(value);
    const isCurrent = nodeId === current;
    const isInStack = stack.includes(nodeId);
    const isInserted = nodeId === inserted;
    const isFound = nodeId === found;

    if (isFound) {
      return {
        fill: '#22c55e', // green-500
        stroke: '#16a34a',
        textColor: 'white',
        scale: 1.2
      };
    }
    if (isInserted) {
      return {
        fill: '#8b5cf6', // violet-500
        stroke: '#7c3aed',
        textColor: 'white',
        scale: 1.2
      };
    }
    if (isCurrent) {
      return {
        fill: '#10b981', // emerald-500
        stroke: '#059669',
        textColor: 'white',
        scale: 1.15
      };
    }
    if (isVisited) {
      return {
        fill: '#3b82f6', // blue-500
        stroke: '#2563eb',
        textColor: 'white',
        scale: 1
      };
    }
    if (isInStack || isInPath) {
      return {
        fill: '#f59e0b', // amber-500
        stroke: '#d97706',
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
  const getEdgeStyle = (fromId, toId) => {
    const fromInPath = path.includes(fromId);
    const toInPath = path.includes(toId);
    const fromVisited = visitedArray.includes(fromId);
    const toVisited = visitedArray.includes(toId);

    if (fromInPath && toInPath) {
      return { stroke: '#f59e0b', strokeWidth: 3 };
    }
    if (fromVisited && toVisited) {
      return { stroke: '#3b82f6', strokeWidth: 2.5 };
    }
    return { stroke: 'var(--color-border)', strokeWidth: 2 };
  };

  // Build legend items
  const legendItems = useMemo(() => {
    const items = [];
    if (current) items.push({ color: 'bg-emerald-500', label: 'Current' });
    if (found) items.push({ color: 'bg-green-500', label: 'Found' });
    if (inserted) items.push({ color: 'bg-violet-500', label: 'Inserted' });
    if (visitedArray.length > 0 || traversalOrder.length > 0) items.push({ color: 'bg-blue-500', label: 'Visited' });
    if (stack.length > 0 || path.length > 0) items.push({ color: 'bg-amber-500', label: stack.length > 0 ? 'In Stack' : 'Path' });
    return items;
  }, [current, found, inserted, visitedArray, traversalOrder, stack, path]);

  if (!tree) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No tree data available
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Tree visualization */}
      <svg width="320" height="220" className="overflow-visible">
        {/* Edges (draw first so nodes appear on top) */}
        {actualNodes.map(node => {
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
                  {...getEdgeStyle(node.id, node.left)}
                  className="transition-all duration-300"
                />
              )}
              {node.right && nodePositions[node.right] && (
                <line
                  x1={pos.x}
                  y1={pos.y}
                  x2={nodePositions[node.right].x}
                  y2={nodePositions[node.right].y}
                  {...getEdgeStyle(node.id, node.right)}
                  className="transition-all duration-300"
                />
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {actualNodes.map(node => {
          const pos = nodePositions[node.id];
          if (!pos) return null;

          const style = getNodeStyle(node.id, node.value);
          const radius = 20 * style.scale;

          return (
            <g key={node.id} className="transition-all duration-300">
              <circle
                cx={pos.x}
                cy={pos.y}
                r={radius}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={style.scale > 1 ? 3 : 2}
                className="transition-all duration-300"
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill={style.textColor}
                fontSize={style.scale > 1 ? 14 : 12}
                fontWeight={style.scale > 1 ? 'bold' : 'medium'}
              >
                {node.value}
              </text>
            </g>
          );
        })}

        {/* Direction indicator */}
        {direction && current && nodePositions[current] && (
          <text
            x={nodePositions[current].x + (direction === 'left' ? -35 : 35)}
            y={nodePositions[current].y + 25}
            textAnchor="middle"
            fill="var(--color-primary)"
            fontSize={11}
            fontWeight="bold"
          >
            {direction === 'left' ? '← Left' : 'Right →'}
          </text>
        )}
      </svg>

      {/* Traversal order display */}
      {traversalOrder.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            Traversal Order:
          </div>
          <div className="flex gap-1 flex-wrap justify-center">
            {traversalOrder.map((value, index) => (
              <span key={`order-${index}`} className="flex items-center">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded text-sm font-mono">
                  {value}
                </span>
                {index < traversalOrder.length - 1 && (
                  <span className="mx-1 text-muted-foreground">→</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stack display */}
      {stack.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            Stack:
          </div>
          <div className="flex gap-1 flex-wrap justify-center">
            {stack.map((nodeId, index) => {
              const node = tree.nodeMap[nodeId];
              return (
                <span
                  key={`stack-${index}`}
                  className="px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded text-sm font-mono"
                >
                  {node?.value || nodeId}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Path display for BST operations */}
      {path.length > 0 && !stack.length && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-xs font-medium text-muted-foreground">
            Search Path:
          </div>
          <div className="flex gap-1 flex-wrap justify-center items-center">
            {path.map((nodeId, index) => {
              const node = tree.nodeMap[nodeId];
              return (
                <span key={`path-${index}`} className="flex items-center">
                  <span className={`px-2 py-0.5 rounded text-sm font-mono ${
                    nodeId === found
                      ? 'bg-green-500/20 text-green-700 dark:text-green-300'
                      : nodeId === inserted
                        ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300'
                        : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                  }`}>
                    {node?.value || nodeId}
                  </span>
                  {index < path.length - 1 && (
                    <span className="mx-1 text-muted-foreground">→</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Search result indicator */}
      {notFound && (
        <div className="px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded text-sm">
          Value not found in tree
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
