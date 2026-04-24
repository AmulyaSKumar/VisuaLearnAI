import { useMemo } from 'react';

/**
 * ArraySimulation - Visualizes array sorting and search algorithms
 * Shows horizontal bars with height proportional to value
 * Highlights compared/swapped/sorted/current elements with color coding
 *
 * Supports new IR format highlights:
 * - compared: Elements being compared
 * - swapped: Elements just swapped
 * - sorted: Elements in final sorted position
 * - current: Current focus position (for search)
 * - visited: Already checked positions
 * - primary: Main highlight
 * - secondary: Secondary highlight
 */
export default function ArraySimulation({ step, initialArray }) {
  const array = step?.array || initialArray || [];

  // Support both old and new highlight formats
  const highlights = useMemo(() => {
    // New format: step.highlights object from IR
    const h = step?.highlights || {};

    // Legacy format fallback
    const legacyHighlight = step?.highlight || [];
    const isSwap = step?.swap || false;

    return {
      compared: h.compared || (!isSwap && legacyHighlight.length > 0 ? legacyHighlight : []),
      swapped: h.swapped || (isSwap && legacyHighlight.length > 0 ? legacyHighlight : []),
      sorted: h.sorted || step?.sorted || [],
      current: h.current,
      visited: h.visited || step?.visited || [],
      primary: h.primary || [],
      secondary: h.secondary || []
    };
  }, [step]);

  // Calculate max value for scaling
  const maxValue = useMemo(() => Math.max(...array, 1), [array]);

  // Determine bar state and colors
  const getBarState = (index) => {
    // Priority: swapped > compared > current > sorted > visited > secondary > primary > default
    if (highlights.swapped.includes(index)) return 'swapped';
    if (highlights.compared.includes(index)) return 'compared';
    if (highlights.current === index) return 'current';
    if (highlights.sorted.includes(index)) return 'sorted';
    if (highlights.visited.includes(index)) return 'visited';
    if (highlights.secondary.includes(index)) return 'secondary';
    if (highlights.primary.includes(index)) return 'primary';
    return 'default';
  };

  // Color mapping for each state
  const stateColors = {
    swapped: {
      bar: 'bg-emerald-500',
      ring: 'ring-2 ring-emerald-400 ring-offset-1',
      text: 'text-white',
      scale: 'scale-110'
    },
    compared: {
      bar: 'bg-amber-500',
      ring: 'ring-2 ring-amber-400 ring-offset-1',
      text: 'text-white',
      scale: 'scale-105'
    },
    current: {
      bar: 'bg-blue-500',
      ring: 'ring-2 ring-blue-400 ring-offset-1',
      text: 'text-white',
      scale: 'scale-110'
    },
    sorted: {
      bar: 'bg-emerald-600/80',
      ring: '',
      text: 'text-white',
      scale: ''
    },
    visited: {
      bar: 'bg-slate-400 dark:bg-slate-500',
      ring: '',
      text: 'text-white',
      scale: ''
    },
    secondary: {
      bar: 'bg-indigo-400',
      ring: 'ring-1 ring-indigo-300',
      text: 'text-white',
      scale: ''
    },
    primary: {
      bar: 'bg-purple-500',
      ring: 'ring-2 ring-purple-400',
      text: 'text-white',
      scale: 'scale-105'
    },
    default: {
      bar: 'bg-primary/70',
      ring: '',
      text: 'text-primary-foreground',
      scale: ''
    }
  };

  // Calculate active legend items
  const activeLegendItems = useMemo(() => {
    const items = [];
    if (highlights.compared.length > 0) items.push({ key: 'compared', label: 'Comparing', color: 'bg-amber-500' });
    if (highlights.swapped.length > 0) items.push({ key: 'swapped', label: 'Swapped', color: 'bg-emerald-500' });
    if (highlights.current !== undefined) items.push({ key: 'current', label: 'Current', color: 'bg-blue-500' });
    if (highlights.sorted.length > 0) items.push({ key: 'sorted', label: 'Sorted', color: 'bg-emerald-600/80' });
    if (highlights.visited.length > 0) items.push({ key: 'visited', label: 'Checked', color: 'bg-slate-400' });

    // Always show default if nothing else is active, or as the baseline
    items.push({ key: 'default', label: 'Unsorted', color: 'bg-primary/70' });

    return items;
  }, [highlights]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Array visualization */}
      <div className="flex items-end justify-center gap-1 sm:gap-1.5 h-48 px-2 w-full overflow-x-auto">
        {array.map((value, index) => {
          const heightPercent = (value / maxValue) * 100;
          const state = getBarState(index);
          const colors = stateColors[state];

          return (
            <div
              key={index}
              className="flex flex-col items-center gap-1 flex-shrink-0"
            >
              {/* Bar */}
              <div
                className={`
                  w-8 sm:w-10 rounded-t-md transition-all duration-300 ease-in-out
                  ${colors.bar}
                  ${colors.ring}
                  ${colors.scale}
                `}
                style={{
                  height: `${Math.max(heightPercent, 10)}%`,
                  minHeight: '20px'
                }}
              >
                {/* Value label on bar */}
                <span className={`
                  block text-center text-xs font-bold pt-1
                  ${colors.text}
                `}>
                  {value}
                </span>
              </div>

              {/* Index label below */}
              <span className={`
                text-xs font-mono
                ${state !== 'default' ? 'text-foreground font-bold' : 'text-muted-foreground'}
              `}>
                [{index}]
              </span>
            </div>
          );
        })}
      </div>

      {/* Dynamic legend based on active highlights */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
        {activeLegendItems.map(item => (
          <div key={item.key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${item.color}`}></div>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Variables display (if available from new IR) */}
      {step?.variables && Object.keys(step.variables).length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs bg-muted/30 px-3 py-2 rounded-lg">
          {Object.entries(step.variables).map(([key, value]) => (
            <div key={key} className="flex items-center gap-1">
              <span className="text-muted-foreground">{key}:</span>
              <span className="font-mono font-medium text-foreground">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
