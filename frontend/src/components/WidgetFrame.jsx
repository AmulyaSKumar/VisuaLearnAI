import { useMemo, useState } from "react";
const CONTROL_LABELS = {
  play: "Play",
  pause: "Pause",
  restart: "Restart",
  step: "Step",
  speed: "Speed",
  fullscreen: "Fullscreen",
};
const SPEC_VERSION = "1.0";
const RENDERER_CAPABILITIES = new Set(["timeline", "chart", "network", "flow", "matrix", "sequence", "comparison", "graph"]);

function clampPercent(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, number));
}

function safeText(value, fallback = "") {
  return String(value ?? fallback).replace(/[<>]/g, "").slice(0, 160);
}

function normalizeSpec(widget) {
  const spec = widget?.spec || {};
  const objects = Array.isArray(spec.objects) ? spec.objects.slice(0, 150) : [];
  const animations = Array.isArray(spec.animations) ? spec.animations.slice(0, 150) : [];
  const controls = Array.isArray(spec.controls) && spec.controls.length
    ? spec.controls.filter(control => CONTROL_LABELS[control]).slice(0, 6)
    : ["play", "pause", "restart", "step", "speed"];

  return {
    version: safeText(spec.version, SPEC_VERSION),
    title: safeText(spec.title || widget?.title, "Visual spec"),
    type: safeText(spec.type || widget?.widget_type, "flow"),
    explanation: safeText(spec.explanation, ""),
    scene: spec.scene || widget?.scene || null,
    objects,
    animations,
    controls,
  };
}

function FlowRenderer({ objects, activeIndex }) {
  const visible = objects.length ? objects : [
    { id: "start", label: "Start" },
    { id: "middle", label: "Process" },
    { id: "end", label: "Result" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {visible.slice(0, 9).map((object, index) => (
        <div
          key={object.id || index}
          className={`min-h-24 rounded-lg border p-4 transition-colors ${
            index === activeIndex % visible.length
              ? "border-violet-700 bg-violet-50"
              : "border-stone-200 bg-white"
          }`}
        >
          <div className="text-xs font-semibold uppercase text-violet-700">{safeText(object.type, "step")}</div>
          <div className="mt-2 text-sm font-semibold text-black">{safeText(object.label || object.name || object.id, `Item ${index + 1}`)}</div>
          {(object.description || object.value) && (
            <div className="mt-2 text-xs text-stone-600">{safeText(object.description || object.value)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function TimelineRenderer({ objects, activeIndex }) {
  return (
    <div className="space-y-3">
      {objects.slice(0, 12).map((object, index) => (
        <div key={object.id || index} className="flex items-center gap-3">
          <div className={`h-4 w-4 rounded-full ${index === activeIndex % objects.length ? "bg-violet-700" : "bg-stone-300"}`} />
          <div className="flex-1 rounded-lg border border-stone-200 bg-white p-3">
            <div className="text-sm font-semibold text-black">{safeText(object.label || object.name || object.id, `Event ${index + 1}`)}</div>
            <div className="text-xs text-stone-600">
              {safeText(object.time ?? object.arrival ?? object.start ?? object.description, "Timeline step")}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartRenderer({ objects, activeIndex }) {
  const values = objects.slice(0, 12).map((object, index) => ({
    id: object.id || index,
    label: safeText(object.label || object.name || object.id, `Item ${index + 1}`),
    value: Math.max(1, Math.min(100, Number(object.value ?? object.burst ?? object.weight ?? 20))),
  }));
  const maxValue = Math.max(...values.map(item => item.value), 1);

  return (
    <div className="space-y-3">
      {values.map((item, index) => (
        <div key={item.id} className="grid grid-cols-[110px_1fr_42px] items-center gap-3 text-sm">
          <div className="truncate text-stone-700">{item.label}</div>
          <div className="h-7 rounded-full bg-stone-100">
            <div
              className={`h-7 rounded-full ${index === activeIndex % values.length ? "bg-violet-700" : "bg-black"}`}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <div className="text-right font-semibold text-black">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function NetworkRenderer({ objects, activeIndex }) {
  const nodes = objects.filter(object => object.type !== "edge").slice(0, 20);
  const count = Math.max(nodes.length, 1);

  return (
    <div className="relative h-80 rounded-lg border border-stone-200 bg-white">
      {nodes.map((object, index) => {
        const angle = (Math.PI * 2 * index) / count;
        const x = clampPercent(object.x, 50 + Math.cos(angle) * 35);
        const y = clampPercent(object.y, 50 + Math.sin(angle) * 35);
        return (
          <div
            key={object.id || index}
            className={`absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border p-2 text-center text-[11px] font-semibold ${
              index === activeIndex % count
                ? "border-violet-700 bg-violet-100 text-violet-950"
                : "border-stone-300 bg-stone-50 text-black"
            }`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            {safeText(object.label || object.id, `N${index + 1}`)}
          </div>
        );
      })}
    </div>
  );
}

function MatrixRenderer({ objects, activeIndex }) {
  const cells = objects.slice(0, 100);
  const size = Math.ceil(Math.sqrt(Math.max(cells.length, 1)));

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
      {cells.map((object, index) => (
        <div
          key={object.id || index}
          className={`flex aspect-square items-center justify-center rounded-md border text-xs font-semibold ${
            index === activeIndex % cells.length
              ? "border-violet-700 bg-violet-100 text-violet-950"
              : "border-stone-200 bg-white text-black"
          }`}
        >
          {safeText(object.label || object.value || `${object.row ?? ""},${object.col ?? ""}`, index + 1)}
        </div>
      ))}
    </div>
  );
}

export default function WidgetFrame({ widget, onInteraction }) {
  const spec = useMemo(() => normalizeSpec(widget), [widget]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const unsupported = !RENDERER_CAPABILITIES.has(spec.type);
  const renderType = unsupported ? "flow" : spec.type;
  const renderObjects = unsupported
    ? [
        { id: "unsupported", type: "node", label: "Unsupported spec" },
        { id: "fallback", type: "node", label: "Fallback visualization" },
        { id: "safe", type: "node", label: "Renderer handled safely" },
      ]
    : spec.objects;
  const objectCount = Math.max(renderObjects.length, 1);

  const stepForward = () => {
    setActiveIndex(prev => {
      const next = (prev + 1) % objectCount;
      onInteraction?.({ widgetId: widget.id, action: "step", data: { step: next, specType: renderType, unsupported } });
      return next;
    });
  };

  const restart = () => {
    setActiveIndex(0);
    onInteraction?.({ widgetId: widget.id, action: "restart", data: { specType: renderType, unsupported } });
  };

  const renderer = (() => {
    if (renderType === "timeline" || renderType === "sequence") return <TimelineRenderer objects={renderObjects} activeIndex={activeIndex} />;
    if (renderType === "chart" || renderType === "comparison") return <ChartRenderer objects={renderObjects} activeIndex={activeIndex} />;
    if (renderType === "network" || renderType === "graph") return <NetworkRenderer objects={renderObjects} activeIndex={activeIndex} />;
    if (renderType === "matrix") return <MatrixRenderer objects={renderObjects} activeIndex={activeIndex} />;
    return <FlowRenderer objects={renderObjects} activeIndex={activeIndex} />;
  })();

  return (
    <div className="w-full overflow-hidden rounded-lg border border-stone-200 bg-[#f8f1df] text-black">
      <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold">{spec.title}</div>
          <div className="text-xs uppercase text-violet-700">{unsupported ? "unsupported_spec -> flow fallback" : `${renderType} v${spec.version}`}</div>
        </div>
        <div className="flex items-center gap-2">
          {spec.controls.includes("restart") && (
            <button className="rounded border border-stone-300 px-2 py-1 text-xs" onClick={restart}>Restart</button>
          )}
          {spec.controls.includes("step") && (
            <button className="rounded bg-violet-700 px-2 py-1 text-xs text-white" onClick={stepForward}>Step</button>
          )}
        </div>
      </div>

      <div className="p-4">{renderer}</div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 bg-white px-4 py-3 text-xs text-stone-700">
        <span>Step {activeIndex + 1} of {objectCount}</span>
        {spec.controls.includes("speed") && (
          <label className="flex items-center gap-2">
            Speed
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.5"
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
            <span>{speed}x</span>
          </label>
        )}
        {spec.explanation && <span className="max-w-xl text-stone-600">{spec.explanation}</span>}
      </div>
    </div>
  );
}
