import { useMemo } from 'react';

/**
 * MathSimulation - Visualizes Mathematical Optimization algorithms
 * Supports: Gradient Descent, Newton's Method
 * Shows function plot with iteration points and convergence path
 */
export default function MathSimulation({ step }) {
  const state = step?.state || {};
  const highlights = step?.highlights || {};

  // Get math data
  const functionPoints = state.functionPoints || [];
  const functionName = state.functionName || 'f(x)';
  const currentPoint = state.currentPoint || highlights.currentPoint;
  const previousPoint = state.previousPoint || highlights.previousPoint;
  const history = state.history || highlights.history || [];
  const tangentLine = state.tangentLine;
  const roots = state.roots || highlights.roots || [];
  const minimum = state.minimum || highlights.minimum;
  const variables = state.variables || {};

  // Highlights
  const {
    showGradient,
    showTangent,
    converged,
    complete,
    error,
    xIntercept
  } = highlights;

  // SVG dimensions
  const svgWidth = 400;
  const svgHeight = 280;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Calculate scales
  const scales = useMemo(() => {
    if (!functionPoints.length) return null;

    const xValues = functionPoints.map(p => p.x);
    const yValues = functionPoints.map(p => p.y);

    // Add history points to consider
    history.forEach(p => {
      if (p.x !== undefined) xValues.push(p.x);
      if (p.y !== undefined) yValues.push(p.y);
    });

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues, 0);
    const yMax = Math.max(...yValues);

    // Add some padding to y range
    const yPadding = (yMax - yMin) * 0.1;

    return {
      xMin,
      xMax,
      yMin: yMin - yPadding,
      yMax: yMax + yPadding,
      toSvgX: (x) => padding.left + ((x - xMin) / (xMax - xMin)) * plotWidth,
      toSvgY: (y) => padding.top + plotHeight - ((y - (yMin - yPadding)) / ((yMax + yPadding) - (yMin - yPadding))) * plotHeight
    };
  }, [functionPoints, history]);

  // Generate function path
  const functionPath = useMemo(() => {
    if (!scales || !functionPoints.length) return '';

    return functionPoints.map((p, i) => {
      const x = scales.toSvgX(p.x);
      const y = scales.toSvgY(p.y);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [functionPoints, scales]);

  // Generate history path (gradient descent path)
  const historyPath = useMemo(() => {
    if (!scales || history.length < 2) return '';

    return history.map((p, i) => {
      const x = scales.toSvgX(p.x);
      const y = scales.toSvgY(p.y);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  }, [history, scales]);

  // Generate tangent line path
  const tangentPath = useMemo(() => {
    if (!scales || !tangentLine || !currentPoint) return '';

    const { slope, intercept } = tangentLine;
    const x1 = scales.xMin;
    const x2 = scales.xMax;
    const y1 = slope * x1 + intercept;
    const y2 = slope * x2 + intercept;

    // Clamp to visible area
    const svgX1 = scales.toSvgX(x1);
    const svgY1 = scales.toSvgY(y1);
    const svgX2 = scales.toSvgX(x2);
    const svgY2 = scales.toSvgY(y2);

    return `M ${svgX1} ${svgY1} L ${svgX2} ${svgY2}`;
  }, [tangentLine, currentPoint, scales]);

  // X-axis ticks
  const xTicks = useMemo(() => {
    if (!scales) return [];
    const ticks = [];
    const range = scales.xMax - scales.xMin;
    const step = range / 5;
    for (let i = 0; i <= 5; i++) {
      const value = scales.xMin + i * step;
      ticks.push({ value, x: scales.toSvgX(value) });
    }
    return ticks;
  }, [scales]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    if (!scales) return [];
    const ticks = [];
    const range = scales.yMax - scales.yMin;
    const step = range / 4;
    for (let i = 0; i <= 4; i++) {
      const value = scales.yMin + i * step;
      ticks.push({ value, y: scales.toSvgY(value) });
    }
    return ticks;
  }, [scales]);

  // Zero line Y position
  const zeroY = scales ? scales.toSvgY(0) : null;

  if (!functionPoints.length || !scales) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No function data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Function name */}
      <div className="text-sm font-medium text-foreground">
        {functionName}
      </div>

      {/* Plot */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full max-w-lg bg-muted/20 rounded-lg"
      >
        {/* Grid lines */}
        <g className="text-muted-foreground/20">
          {xTicks.map((tick, i) => (
            <line
              key={`xgrid-${i}`}
              x1={tick.x}
              y1={padding.top}
              x2={tick.x}
              y2={svgHeight - padding.bottom}
              stroke="currentColor"
              strokeDasharray="2,2"
            />
          ))}
          {yTicks.map((tick, i) => (
            <line
              key={`ygrid-${i}`}
              x1={padding.left}
              y1={tick.y}
              x2={svgWidth - padding.right}
              y2={tick.y}
              stroke="currentColor"
              strokeDasharray="2,2"
            />
          ))}
        </g>

        {/* X-axis (y=0 line) */}
        {zeroY >= padding.top && zeroY <= svgHeight - padding.bottom && (
          <line
            x1={padding.left}
            y1={zeroY}
            x2={svgWidth - padding.right}
            y2={zeroY}
            className="stroke-muted-foreground"
            strokeWidth="1"
          />
        )}

        {/* Axes */}
        <line
          x1={padding.left}
          y1={svgHeight - padding.bottom}
          x2={svgWidth - padding.right}
          y2={svgHeight - padding.bottom}
          className="stroke-foreground"
          strokeWidth="1"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={svgHeight - padding.bottom}
          className="stroke-foreground"
          strokeWidth="1"
        />

        {/* Axis labels */}
        {xTicks.map((tick, i) => (
          <text
            key={`xlabel-${i}`}
            x={tick.x}
            y={svgHeight - padding.bottom + 15}
            textAnchor="middle"
            className="text-[10px] fill-muted-foreground"
          >
            {tick.value.toFixed(1)}
          </text>
        ))}
        {yTicks.map((tick, i) => (
          <text
            key={`ylabel-${i}`}
            x={padding.left - 8}
            y={tick.y + 3}
            textAnchor="end"
            className="text-[10px] fill-muted-foreground"
          >
            {tick.value.toFixed(1)}
          </text>
        ))}

        {/* Function curve */}
        <path
          d={functionPath}
          fill="none"
          className="stroke-neutral-500"
          strokeWidth="2"
        />

        {/* Tangent line (Newton's method) */}
        {showTangent && tangentPath && (
          <path
            d={tangentPath}
            fill="none"
            className="stroke-neutral-500"
            strokeWidth="1.5"
            strokeDasharray="4,4"
          />
        )}

        {/* History path */}
        {history.length > 1 && (
          <path
            d={historyPath}
            fill="none"
            className="stroke-amber-500"
            strokeWidth="1.5"
            strokeDasharray="3,3"
          />
        )}

        {/* Root markers */}
        {roots.map((root, i) => (
          <g key={`root-${i}`}>
            <line
              x1={scales.toSvgX(root)}
              y1={zeroY - 8}
              x2={scales.toSvgX(root)}
              y2={zeroY + 8}
              className="stroke-emerald-500"
              strokeWidth="2"
            />
          </g>
        ))}

        {/* Minimum marker */}
        {minimum && (
          <g>
            <circle
              cx={scales.toSvgX(minimum.x)}
              cy={scales.toSvgY(minimum.y)}
              r="6"
              className="fill-emerald-500"
            />
            <circle
              cx={scales.toSvgX(minimum.x)}
              cy={scales.toSvgY(minimum.y)}
              r="10"
              fill="none"
              className="stroke-emerald-500"
              strokeWidth="2"
              strokeDasharray="2,2"
            />
          </g>
        )}

        {/* History points */}
        {history.slice(0, -1).map((point, i) => (
          <circle
            key={`hist-${i}`}
            cx={scales.toSvgX(point.x)}
            cy={scales.toSvgY(point.y)}
            r="4"
            className="fill-amber-400/60"
          />
        ))}

        {/* Previous point */}
        {previousPoint && (
          <circle
            cx={scales.toSvgX(previousPoint.x)}
            cy={scales.toSvgY(previousPoint.y)}
            r="6"
            className="fill-neutral-400"
          />
        )}

        {/* Current point */}
        {currentPoint && (
          <g>
            <circle
              cx={scales.toSvgX(currentPoint.x)}
              cy={scales.toSvgY(currentPoint.y)}
              r="8"
              className={`
                ${complete && converged ? 'fill-emerald-500' :
                  error ? 'fill-red-500' :
                  'fill-amber-500'}
              `}
            />
            {!complete && !error && (
              <circle
                cx={scales.toSvgX(currentPoint.x)}
                cy={scales.toSvgY(currentPoint.y)}
                r="12"
                fill="none"
                className="stroke-amber-400 animate-ping"
                strokeWidth="2"
              />
            )}
          </g>
        )}

        {/* X-intercept marker (Newton's method) */}
        {xIntercept !== undefined && zeroY && (
          <g>
            <circle
              cx={scales.toSvgX(xIntercept)}
              cy={zeroY}
              r="5"
              className="fill-neutral-500"
            />
            <line
              x1={scales.toSvgX(xIntercept)}
              y1={zeroY - 10}
              x2={scales.toSvgX(xIntercept)}
              y2={zeroY + 10}
              className="stroke-neutral-500"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Gradient arrow */}
        {showGradient && currentPoint && history.length > 0 && (
          <g>
            <defs>
              <marker
                id="gradient-arrow"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  className="fill-rose-500"
                />
              </marker>
            </defs>
            {/* Show gradient direction */}
            <line
              x1={scales.toSvgX(currentPoint.x)}
              y1={scales.toSvgY(currentPoint.y)}
              x2={scales.toSvgX(currentPoint.x) + 30}
              y2={scales.toSvgY(currentPoint.y) - (history[history.length - 1]?.gradient || 0) * 10}
              className="stroke-rose-500"
              strokeWidth="2"
              markerEnd="url(#gradient-arrow)"
            />
          </g>
        )}

        {/* Axis titles */}
        <text
          x={svgWidth / 2}
          y={svgHeight - 5}
          textAnchor="middle"
          className="text-xs fill-muted-foreground"
        >
          x
        </text>
        <text
          x={12}
          y={svgHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90, 12, ${svgHeight / 2})`}
          className="text-xs fill-muted-foreground"
        >
          f(x)
        </text>
      </svg>

      {/* Variables display */}
      {Object.keys(variables).length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs bg-muted/30 px-3 py-2 rounded-lg max-w-full">
          {Object.entries(variables).map(([key, value]) => {
            if (typeof value === 'object' || value === undefined) return null;
            return (
              <div key={key} className="flex items-center gap-1">
                <span className="text-muted-foreground">{key}:</span>
                <span className="font-mono font-medium text-foreground">
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Convergence indicator */}
      {complete && (
        <div className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          ${converged ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
            error ? 'bg-red-500/20 text-red-600 dark:text-red-400' :
            'bg-amber-500/20 text-amber-600 dark:text-amber-400'}
        `}>
          {converged ? 'Converged' : error ? 'Error' : 'Max iterations reached'}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-neutral-500"></div>
          <span>f(x)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span>Current</span>
        </div>
        {history.length > 1 && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }}></div>
            <span>Path</span>
          </div>
        )}
        {(roots.length > 0 || minimum) && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span>{roots.length > 0 ? 'Root' : 'Minimum'}</span>
          </div>
        )}
        {tangentPath && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-neutral-500" style={{ borderStyle: 'dashed' }}></div>
            <span>Tangent</span>
          </div>
        )}
      </div>
    </div>
  );
}
