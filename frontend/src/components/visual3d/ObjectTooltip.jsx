export default function ObjectTooltip({ object, hoveredObject, onClose }) {
  const target = object || hoveredObject;
  if (!target) return null;
  const expanded = Boolean(object);

  return (
    <div
      className={`absolute right-3 top-3 z-20 w-[min(310px,calc(100%-1.5rem))] rounded-xl border border-white/10 bg-slate-950/70 text-sm text-slate-100 shadow-2xl backdrop-blur-xl transition-all duration-200 ${
        expanded ? 'p-4 opacity-100' : 'p-3 opacity-90'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-cyan-50">{target.name}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-300">{target.description}</p>
        </div>
        {expanded && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close object details"
            title="Close"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {expanded && Array.isArray(target.facts) && target.facts.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200">Key facts</p>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200">
            {target.facts.slice(0, 4).map((fact, index) => (
              <li key={`${target.id}-fact-${index}`}>- {fact}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
