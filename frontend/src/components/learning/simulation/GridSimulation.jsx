import { useMemo } from 'react';

/**
 * GridSimulation - Visualizes grid-based algorithms
 * Supports: Flood Fill, A* Pathfinding, and other grid algorithms
 *
 * Cell states visualized:
 * - 0: Empty/walkable (default)
 * - 1: Wall/obstacle
 * - 2+: Filled (for flood fill)
 * - Special highlights: start, end, path, current, openSet, closedSet
 */
export default function GridSimulation({ step, grid }) {
  // Get grid data from step state or props
  const gridData = step?.state?.grid || grid?.cells || [];
  const rows = gridData.length;
  const cols = gridData[0]?.length || 0;

  // Extract highlights from step
  const highlights = step?.highlights || {};
  const {
    start,
    end,
    current,
    path = [],
    openSet = [],
    closedSet = [],
    filled = [],
    queue = [],
    checking
  } = highlights;

  // Cell size calculation based on grid dimensions
  const cellSize = useMemo(() => {
    const maxWidth = 400;
    const maxHeight = 320;
    const sizeFromWidth = Math.floor(maxWidth / cols);
    const sizeFromHeight = Math.floor(maxHeight / rows);
    return Math.min(sizeFromWidth, sizeFromHeight, 40);
  }, [rows, cols]);

  // Helper to check if a cell matches a position
  const posMatches = (pos, r, c) => pos && pos.row === r && pos.col === c;

  // Helper to check if cell is in array of positions
  const isInArray = (arr, r, c) => arr.some(pos => pos.row === r && pos.col === c);

  // Get cell styling based on state
  const getCellStyle = (value, row, col) => {
    // Priority: current > path > start/end > openSet > closedSet > filled > checking > queue > wall > empty

    // Current cell being processed
    if (posMatches(current, row, col)) {
      return {
        bg: 'bg-amber-500',
        border: 'border-amber-600',
        ring: 'ring-2 ring-amber-400 ring-offset-1',
        text: 'text-white',
        scale: 'scale-105'
      };
    }

    // Checking neighbor
    if (posMatches(checking, row, col)) {
      return {
        bg: 'bg-purple-500',
        border: 'border-purple-600',
        ring: 'ring-2 ring-purple-400',
        text: 'text-white',
        scale: ''
      };
    }

    // Path cells (for A*)
    if (isInArray(path, row, col)) {
      return {
        bg: 'bg-emerald-500',
        border: 'border-emerald-600',
        ring: '',
        text: 'text-white',
        scale: ''
      };
    }

    // Start cell
    if (posMatches(start, row, col)) {
      return {
        bg: 'bg-blue-500',
        border: 'border-blue-600',
        ring: 'ring-2 ring-blue-400',
        text: 'text-white',
        scale: ''
      };
    }

    // End cell
    if (posMatches(end, row, col)) {
      return {
        bg: 'bg-rose-500',
        border: 'border-rose-600',
        ring: 'ring-2 ring-rose-400',
        text: 'text-white',
        scale: ''
      };
    }

    // Open set (A*)
    if (isInArray(openSet, row, col)) {
      return {
        bg: 'bg-sky-400',
        border: 'border-sky-500',
        ring: '',
        text: 'text-white',
        scale: ''
      };
    }

    // Closed set / visited (A*)
    if (isInArray(closedSet, row, col)) {
      return {
        bg: 'bg-slate-400 dark:bg-slate-500',
        border: 'border-slate-500 dark:border-slate-600',
        ring: '',
        text: 'text-white',
        scale: ''
      };
    }

    // Filled cells (Flood Fill)
    if (isInArray(filled, row, col) || value >= 2) {
      return {
        bg: 'bg-indigo-500',
        border: 'border-indigo-600',
        ring: '',
        text: 'text-white',
        scale: ''
      };
    }

    // Queue (BFS frontier)
    if (isInArray(queue, row, col)) {
      return {
        bg: 'bg-cyan-400',
        border: 'border-cyan-500',
        ring: '',
        text: 'text-white',
        scale: ''
      };
    }

    // Wall
    if (value === 1) {
      return {
        bg: 'bg-slate-700 dark:bg-slate-800',
        border: 'border-slate-800 dark:border-slate-900',
        ring: '',
        text: 'text-slate-400',
        scale: ''
      };
    }

    // Empty/walkable
    return {
      bg: 'bg-muted/50',
      border: 'border-border',
      ring: '',
      text: 'text-muted-foreground',
      scale: ''
    };
  };

  // Build legend based on active highlights
  const legendItems = useMemo(() => {
    const items = [];

    if (start) items.push({ color: 'bg-blue-500', label: 'Start' });
    if (end) items.push({ color: 'bg-rose-500', label: 'End' });
    if (current) items.push({ color: 'bg-amber-500', label: 'Current' });
    if (path.length > 0) items.push({ color: 'bg-emerald-500', label: 'Path' });
    if (openSet.length > 0) items.push({ color: 'bg-sky-400', label: 'Open Set' });
    if (closedSet.length > 0) items.push({ color: 'bg-slate-400', label: 'Visited' });
    if (filled.length > 0) items.push({ color: 'bg-indigo-500', label: 'Filled' });
    if (queue.length > 0) items.push({ color: 'bg-cyan-400', label: 'Queue' });

    // Always show wall and empty
    items.push({ color: 'bg-slate-700', label: 'Wall' });
    items.push({ color: 'bg-muted/50 border border-border', label: 'Empty' });

    return items;
  }, [start, end, current, path, openSet, closedSet, filled, queue]);

  // Get cell label (f-score for A*, value for flood fill)
  const getCellLabel = (value, row, col) => {
    // Show f-score for open set cells
    const openNode = openSet.find(n => n.row === row && n.col === col);
    if (openNode && openNode.f !== undefined) {
      return openNode.f;
    }

    // Show fill value if filled
    if (value >= 2) {
      return value;
    }

    return '';
  };

  if (!gridData.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No grid data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Grid visualization */}
      <div
        className="inline-grid gap-0.5 p-2 bg-muted/30 rounded-lg"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`
        }}
      >
        {gridData.map((row, rowIdx) =>
          row.map((cellValue, colIdx) => {
            const style = getCellStyle(cellValue, rowIdx, colIdx);
            const label = getCellLabel(cellValue, rowIdx, colIdx);

            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={`
                  flex items-center justify-center
                  rounded-sm border transition-all duration-200
                  ${style.bg}
                  ${style.border}
                  ${style.ring}
                  ${style.scale}
                `}
                style={{
                  width: cellSize,
                  height: cellSize
                }}
                title={`(${rowIdx}, ${colIdx})`}
              >
                {/* Cell content */}
                {posMatches(start, rowIdx, colIdx) && (
                  <span className="text-xs font-bold">S</span>
                )}
                {posMatches(end, rowIdx, colIdx) && (
                  <span className="text-xs font-bold">E</span>
                )}
                {!posMatches(start, rowIdx, colIdx) && !posMatches(end, rowIdx, colIdx) && label && (
                  <span className={`text-[10px] font-medium ${style.text}`}>
                    {label}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Statistics display */}
      {step?.state?.variables && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs bg-muted/30 px-3 py-2 rounded-lg">
          {Object.entries(step.state.variables).map(([key, value]) => {
            // Skip complex objects
            if (typeof value === 'object') return null;
            // Format key for display
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
        {legendItems.map((item, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${item.color}`}></div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Queue/Open Set display */}
      {(queue.length > 0 || openSet.length > 0) && (
        <div className="flex flex-col items-center gap-1.5 max-w-full">
          <div className="text-xs font-medium text-muted-foreground">
            {queue.length > 0 ? 'Queue:' : 'Open Set:'}
          </div>
          <div className="flex gap-1 flex-wrap justify-center max-h-16 overflow-y-auto">
            {(queue.length > 0 ? queue : openSet).slice(0, 20).map((pos, idx) => (
              <span
                key={idx}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                  queue.length > 0
                    ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                    : 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                }`}
              >
                ({pos.row},{pos.col}){pos.f !== undefined ? ` f=${pos.f}` : ''}
              </span>
            ))}
            {(queue.length > 20 || openSet.length > 20) && (
              <span className="text-muted-foreground text-[10px]">
                +{(queue.length > 0 ? queue.length : openSet.length) - 20} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
