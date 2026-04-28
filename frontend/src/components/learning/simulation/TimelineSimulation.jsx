import { useMemo } from 'react';

/**
 * TimelineSimulation - Visualizes CPU Scheduling algorithms
 * Supports: FCFS, SJF, Round Robin
 * Shows Gantt chart timeline and process queue
 */
export default function TimelineSimulation({ step }) {
  const state = step?.state || {};
  const highlights = step?.highlights || {};

  // Get scheduling data
  const processes = state.processes || [];
  const timeline = state.timeline || [];
  const currentTime = state.currentTime || 0;
  const quantum = state.quantum;
  const readyQueue = state.readyQueue || [];
  const variables = state.variables || {};

  // Highlights
  const {
    running,
    completed: completedId,
    idle,
    queue = [],
    preempted,
    selected,
    stats,
    complete
  } = highlights;

  // Process colors
  const processColors = useMemo(() => {
    const colors = [
      'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-purple-500',
      'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500'
    ];
    const colorMap = {};
    processes.forEach((p, i) => {
      colorMap[p.id] = colors[i % colors.length];
    });
    return colorMap;
  }, [processes]);

  // Calculate timeline width
  const maxTime = Math.max(currentTime, ...timeline.map(t => t.end || 0), 20);
  const timeScale = Math.min(20, 400 / maxTime); // pixels per time unit

  // Render Gantt chart
  const renderGanttChart = () => (
    <div className="w-full overflow-x-auto">
      <div className="min-w-fit">
        {/* Time axis */}
        <div className="flex items-end mb-1 ml-12">
          {Array.from({ length: maxTime + 1 }, (_, t) => (
            <div
              key={t}
              className="text-[10px] text-muted-foreground font-mono"
              style={{ width: timeScale, textAlign: 'left' }}
            >
              {t % Math.ceil(maxTime / 10) === 0 || t === maxTime ? t : ''}
            </div>
          ))}
        </div>

        {/* Timeline bar */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-10">CPU:</span>
          <div
            className="relative h-10 bg-muted/30 rounded border border-border"
            style={{ width: maxTime * timeScale }}
          >
            {timeline.map((segment, i) => (
              <div
                key={i}
                className={`
                  absolute top-0 h-full flex items-center justify-center
                  text-xs font-medium text-white rounded-sm
                  ${segment.type === 'idle' ? 'bg-slate-400 dark:bg-slate-600' : processColors[segment.process]}
                  ${segment.process === running ? 'ring-2 ring-white animate-pulse' : ''}
                `}
                style={{
                  left: segment.start * timeScale,
                  width: (segment.end - segment.start) * timeScale - 1
                }}
                title={segment.type === 'idle' ? `Idle: ${segment.start}-${segment.end}` : `${segment.process}: ${segment.start}-${segment.end}`}
              >
                {(segment.end - segment.start) * timeScale > 20 && (
                  segment.type === 'idle' ? 'idle' : segment.process
                )}
              </div>
            ))}

            {/* Current time marker */}
            <div
              className="absolute top-0 w-0.5 h-full bg-red-500"
              style={{ left: currentTime * timeScale }}
            />
          </div>
        </div>

        {/* Current time indicator */}
        <div className="flex items-center gap-2 mt-1">
          <span className="w-10"></span>
          <div
            className="text-[10px] text-red-500 font-mono"
            style={{ marginLeft: currentTime * timeScale - 5 }}
          >
            t={currentTime}
          </div>
        </div>
      </div>
    </div>
  );

  // Render process table
  const renderProcessTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="py-1 px-2 text-left text-muted-foreground">Process</th>
            <th className="py-1 px-2 text-center text-muted-foreground">Arrival</th>
            <th className="py-1 px-2 text-center text-muted-foreground">Burst</th>
            {quantum && <th className="py-1 px-2 text-center text-muted-foreground">Remaining</th>}
            <th className="py-1 px-2 text-center text-muted-foreground">Status</th>
            {processes.some(p => p.finish !== undefined) && (
              <>
                <th className="py-1 px-2 text-center text-muted-foreground">Finish</th>
                <th className="py-1 px-2 text-center text-muted-foreground">TAT</th>
                <th className="py-1 px-2 text-center text-muted-foreground">WT</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {processes.map((p) => (
            <tr
              key={p.id}
              className={`
                border-b border-border/50 transition-colors
                ${p.id === running ? 'bg-amber-500/20' : ''}
                ${p.id === completedId ? 'bg-emerald-500/20' : ''}
                ${p.id === preempted ? 'bg-purple-500/20' : ''}
              `}
            >
              <td className="py-1 px-2">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${processColors[p.id]}`}></div>
                  <span className="font-medium">{p.id}</span>
                </div>
              </td>
              <td className="py-1 px-2 text-center font-mono">{p.arrival}</td>
              <td className="py-1 px-2 text-center font-mono">{p.burst}</td>
              {quantum && (
                <td className="py-1 px-2 text-center font-mono">
                  {p.remaining !== undefined ? p.remaining : p.burst}
                </td>
              )}
              <td className="py-1 px-2 text-center">
                <span className={`
                  px-1.5 py-0.5 rounded text-[10px] font-medium
                  ${p.status === 'running' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                    p.status === 'completed' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                    p.status === 'ready' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' :
                    'bg-muted text-muted-foreground'}
                `}>
                  {p.status || 'waiting'}
                </span>
              </td>
              {processes.some(pr => pr.finish !== undefined) && (
                <>
                  <td className="py-1 px-2 text-center font-mono">{p.finish ?? '-'}</td>
                  <td className="py-1 px-2 text-center font-mono">{p.turnaround ?? '-'}</td>
                  <td className="py-1 px-2 text-center font-mono">{p.waiting ?? '-'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Render ready queue
  const renderReadyQueue = () => {
    const queueToShow = readyQueue.length > 0 ? readyQueue : queue;
    if (queueToShow.length === 0) return null;

    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Ready Queue:</span>
        <div className="flex gap-1">
          {queueToShow.map((pid, i) => (
            <div
              key={i}
              className={`
                px-2 py-1 rounded text-xs font-medium text-white
                ${processColors[pid]}
              `}
            >
              {pid}
            </div>
          ))}
        </div>
        {queueToShow.length === 0 && (
          <span className="text-xs text-muted-foreground italic">empty</span>
        )}
      </div>
    );
  };

  if (!processes.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>No scheduling data available</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Gantt Chart */}
      <div className="p-3 bg-muted/20 rounded-lg">
        {renderGanttChart()}
      </div>

      {/* Ready Queue */}
      {renderReadyQueue()}

      {/* Process Table */}
      <div className="p-3 bg-muted/20 rounded-lg">
        {renderProcessTable()}
      </div>

      {/* Statistics */}
      {complete && stats && (
        <div className="flex flex-wrap items-center justify-center gap-4 p-3 bg-emerald-500/10 rounded-lg">
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {typeof stats.avgTurnaround === 'number' ? stats.avgTurnaround.toFixed(2) : stats.avgTurnaround}
            </div>
            <div className="text-xs text-muted-foreground">Avg Turnaround</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {typeof stats.avgWaiting === 'number' ? stats.avgWaiting.toFixed(2) : stats.avgWaiting}
            </div>
            <div className="text-xs text-muted-foreground">Avg Waiting</div>
          </div>
          {quantum && (
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{quantum}</div>
              <div className="text-xs text-muted-foreground">Time Quantum</div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
        {Object.entries(processColors).slice(0, processes.length).map(([pid, color]) => (
          <div key={pid} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${color}`}></div>
            <span>{pid}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-400"></div>
          <span>Idle</span>
        </div>
      </div>
    </div>
  );
}
