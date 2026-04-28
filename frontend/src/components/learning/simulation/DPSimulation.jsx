import { useMemo } from 'react';

/**
 * DPSimulation - Visualizes Dynamic Programming algorithms
 * Supports: Fibonacci, Knapsack, and other DP problems
 * Shows DP table with cell highlighting for current, dependencies, and filled cells
 */
export default function DPSimulation({ step }) {
  const state = step?.state || {};
  const highlights = step?.highlights || {};

  // Get DP data
  const dp = state.dp || [];
  const items = state.items || []; // For knapsack
  const variables = state.variables || {};

  // Check if it's 1D (fibonacci) or 2D (knapsack)
  const is2D = dp.length > 0 && Array.isArray(dp[0]);

  // Highlights
  const {
    current,
    filled = [],
    justFilled,
    dependencies = [],
    result,
    complete,
    currentCell,
    compareCell,
    prevCell,
    currentItem,
    selectedItems = [],
    resultCell
  } = highlights;

  // Cell size based on data
  const cellSize = useMemo(() => {
    if (is2D) {
      const cols = dp[0]?.length || 0;
      return Math.min(40, Math.floor(380 / (cols + 1)));
    }
    return Math.min(50, Math.floor(400 / dp.length));
  }, [dp, is2D]);

  // Get cell style for 1D DP
  const get1DCellStyle = (index, value) => {
    if (index === result && complete) {
      return 'bg-emerald-500 text-white ring-2 ring-emerald-400';
    }
    if (index === justFilled) {
      return 'bg-amber-500 text-white ring-2 ring-amber-400 scale-105';
    }
    if (index === current) {
      return 'bg-blue-500 text-white ring-2 ring-blue-400';
    }
    if (dependencies.includes(index)) {
      return 'bg-purple-500 text-white';
    }
    if (filled.includes(index)) {
      return 'bg-indigo-500/80 text-white';
    }
    if (value !== null) {
      return 'bg-muted text-foreground';
    }
    return 'bg-muted/30 text-muted-foreground';
  };

  // Get cell style for 2D DP
  const get2DCellStyle = (row, col, value) => {
    if (resultCell?.row === row && resultCell?.col === col) {
      return 'bg-emerald-500 text-white ring-2 ring-emerald-400';
    }
    if (currentCell?.row === row && currentCell?.col === col) {
      return 'bg-amber-500 text-white ring-2 ring-amber-400';
    }
    if (compareCell?.row === row && compareCell?.col === col) {
      return 'bg-purple-500 text-white';
    }
    if (prevCell?.row === row && prevCell?.col === col) {
      return 'bg-blue-400 text-white';
    }
    if (value > 0) {
      return 'bg-indigo-500/70 text-white';
    }
    return 'bg-muted/30 text-muted-foreground';
  };

  // Render 1D DP table (Fibonacci)
  const render1DTable = () => (
    <div className="flex flex-col items-center gap-4">
      {/* Index row */}
      <div className="flex gap-1">
        {dp.map((_, i) => (
          <div
            key={`idx-${i}`}
            className="flex items-center justify-center text-xs text-muted-foreground font-mono"
            style={{ width: cellSize, height: 20 }}
          >
            {i}
          </div>
        ))}
      </div>

      {/* Values row */}
      <div className="flex gap-1">
        {dp.map((value, i) => (
          <div
            key={`val-${i}`}
            className={`
              flex items-center justify-center rounded-md font-mono font-medium
              transition-all duration-300 border border-border/50
              ${get1DCellStyle(i, value)}
            `}
            style={{ width: cellSize, height: cellSize }}
          >
            {value !== null ? value : '-'}
          </div>
        ))}
      </div>

      {/* Labels */}
      <div className="flex gap-1">
        {dp.map((_, i) => (
          <div
            key={`lbl-${i}`}
            className="flex items-center justify-center text-[10px] text-muted-foreground"
            style={{ width: cellSize }}
          >
            F({i})
          </div>
        ))}
      </div>
    </div>
  );

  // Render 2D DP table (Knapsack)
  const render2DTable = () => {
    const rows = dp.length;
    const cols = dp[0]?.length || 0;

    return (
      <div className="flex flex-col gap-2">
        {/* Items display */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2 justify-center mb-2">
            {items.map((item, i) => (
              <div
                key={item.id}
                className={`
                  px-2 py-1 rounded text-xs font-medium
                  ${selectedItems.includes(i) ? 'bg-emerald-500 text-white' :
                    currentItem === i ? 'bg-amber-500 text-white' :
                    'bg-muted text-foreground'}
                `}
              >
                {item.id}: w={item.weight}, v={item.value}
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="p-1 text-xs text-muted-foreground">i\w</th>
                {Array.from({ length: cols }, (_, c) => (
                  <th key={c} className="p-1 text-xs text-muted-foreground font-mono">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dp.map((row, r) => (
                <tr key={r}>
                  <td className="p-1 text-xs text-muted-foreground font-mono">
                    {r === 0 ? '0' : items[r - 1]?.id || r}
                  </td>
                  {row.map((value, c) => (
                    <td key={c} className="p-0.5">
                      <div
                        className={`
                          flex items-center justify-center rounded text-xs font-mono
                          transition-all duration-200 border border-border/30
                          ${get2DCellStyle(r, c, value)}
                        `}
                        style={{ width: cellSize, height: cellSize }}
                      >
                        {value}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Legend
  const legendItems = useMemo(() => {
    const items = [];
    if (current !== undefined || currentCell) items.push({ color: 'bg-amber-500', label: 'Current' });
    if (dependencies.length > 0 || compareCell) items.push({ color: 'bg-purple-500', label: 'Dependencies' });
    if (prevCell) items.push({ color: 'bg-blue-400', label: 'Previous' });
    if (filled.length > 0) items.push({ color: 'bg-indigo-500', label: 'Filled' });
    if (complete || resultCell) items.push({ color: 'bg-emerald-500', label: 'Result' });
    return items;
  }, [current, currentCell, dependencies, compareCell, prevCell, filled, complete, resultCell]);

  if (!dp.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No DP table data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Main visualization */}
      <div className="p-4 bg-muted/20 rounded-lg">
        {is2D ? render2DTable() : render1DTable()}
      </div>

      {/* Variables display */}
      {Object.keys(variables).length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs bg-muted/30 px-3 py-2 rounded-lg">
          {Object.entries(variables).map(([key, value]) => {
            if (typeof value === 'object') return null;
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
      {legendItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          {legendItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${item.color}`}></div>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
