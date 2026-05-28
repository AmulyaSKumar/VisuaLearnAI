export default function SceneControls({
  playing,
  speed,
  onTogglePlay,
  onRestart,
  onSpeedChange,
  onFullscreen,
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 justify-center">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-950/65 px-3 py-2 shadow-2xl backdrop-blur-xl">
        <button
          type="button"
          onClick={onRestart}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/8 text-slate-100 transition hover:bg-white/15 hover:text-cyan-200"
          title="Restart"
          aria-label="Restart"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 3v6h6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          className="grid h-10 w-10 place-items-center rounded-full bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-200"
          title={playing ? 'Pause' : 'Play'}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <label className="sr-only" htmlFor="visual3d-speed">
          Speed
        </label>
        <select
          id="visual3d-speed"
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
          className="h-9 rounded-full border border-white/10 bg-slate-900/90 px-3 text-sm font-medium text-slate-100 outline-none transition hover:bg-slate-800"
          title="Animation speed"
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={1.5}>1.5x</option>
          <option value={2}>2x</option>
        </select>
        <button
          type="button"
          onClick={onFullscreen}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/8 text-slate-100 transition hover:bg-white/15 hover:text-cyan-200"
          title="Fullscreen"
          aria-label="Fullscreen"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H3v5M21 8V3h-5M16 21h5v-5M3 16v5h5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
