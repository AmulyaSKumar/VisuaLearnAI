import { useMemo } from 'react';

/**
 * ArraySimulation - Visualizes array sorting algorithms
 * Shows horizontal bars with height proportional to value
 * Highlights compared/swapped elements with color coding
 */
export default function ArraySimulation({ step, initialArray }) {
  const array = step?.array || initialArray || [];
  const highlight = step?.highlight || [];
  const isSwap = step?.swap || false;

  // Calculate max value for scaling
  const maxValue = useMemo(() => Math.max(...array, 1), [array]);

  // Color coding
  const getBarColor = (index) => {
    if (highlight.includes(index)) {
      return isSwap
        ? 'bg-emerald-500' // Green for swap
        : 'bg-amber-500'; // Yellow/orange for comparing
    }
    return 'bg-primary/70';
  };

  const getBarBorder = (index) => {
    if (highlight.includes(index)) {
      return isSwap
        ? 'ring-2 ring-emerald-400 ring-offset-1'
        : 'ring-2 ring-amber-400 ring-offset-1';
    }
    return '';
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Array visualization */}
      <div className="flex items-end gap-1.5 h-48 px-4">
        {array.map((value, index) => {
          const heightPercent = (value / maxValue) * 100;
          const isHighlighted = highlight.includes(index);

          return (
            <div
              key={index}
              className="flex flex-col items-center gap-1"
            >
              {/* Bar */}
              <div
                className={`
                  w-10 rounded-t-md transition-all duration-300 ease-in-out
                  ${getBarColor(index)}
                  ${getBarBorder(index)}
                  ${isHighlighted ? 'scale-105' : ''}
                `}
                style={{
                  height: `${Math.max(heightPercent, 10)}%`,
                  minHeight: '20px'
                }}
              >
                {/* Value label on bar */}
                <span className={`
                  block text-center text-xs font-bold pt-1
                  ${isHighlighted ? 'text-white' : 'text-primary-foreground'}
                `}>
                  {value}
                </span>
              </div>

              {/* Index label below */}
              <span className={`
                text-xs font-mono
                ${isHighlighted ? 'text-foreground font-bold' : 'text-muted-foreground'}
              `}>
                [{index}]
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-500"></div>
          <span>Comparing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500"></div>
          <span>Swapped</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-primary/70"></div>
          <span>Unsorted</span>
        </div>
      </div>
    </div>
  );
}
