import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toPng, toSvg } from 'html-to-image';

const PRIMARY = '#2F2A7F';
const SECONDARY = '#4B5563';
const LINE = '#D8DADF';
const TEXT = '#171717';
const MUTED = '#6B7280';

const ROOT = { width: 250, minHeight: 220 };
const BRANCH = { width: 210, minHeight: 72 };
const DETAIL = { width: 220, minHeight: 48 };
const LAYOUT = {
  marginX: 88,
  marginY: 96,
  rootX: 190,
  branchX: 560,
  detailX: 955,
  siblingGap: 48,
  detailGap: 20,
};

function text(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(item => text(item)).filter(Boolean).join(', ');
  for (const key of ['label', 'title', 'name', 'text', 'content', 'description', 'value']) {
    if (typeof value?.[key] === 'string') return value[key];
  }
  return fallback;
}

function shortText(value, max = 88) {
  const raw = text(value).replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  return raw.length > max ? `${raw.slice(0, max - 1).trim()}...` : raw;
}

function estimateLines(value, charsPerLine) {
  return Math.max(1, Math.ceil(text(value).length / charsPerLine));
}

function nodeHeight(label, base, charsPerLine, maxExtra = 64) {
  return base + Math.min(maxExtra, (estimateLines(label, charsPerLine) - 1) * 18);
}

function getBranchChildren(branch) {
  const children = branch?.children || branch?.items || branch?.nodes || branch?.details || [];
  return Array.isArray(children) ? children : [];
}

function normalizeMindMap(mindmap, topic) {
  const root = text(mindmap?.central || mindmap?.root || mindmap?.topic || topic, 'Learning Topic');
  const rawBranches = Array.isArray(mindmap?.branches) ? mindmap.branches : [];
  const fallbackBranches = ['Definition', 'Working', 'Example', 'Complexity', 'Applications', 'Code', 'Quiz', 'Simulation'];

  const branches = (rawBranches.length ? rawBranches : fallbackBranches.map(label => ({ label })))
    .slice(0, 8)
    .map((branch, index) => ({
      id: text(branch?.id, `branch-${index}`),
      label: shortText(branch?.label || branch?.title || branch, 46) || fallbackBranches[index] || `Concept ${index + 1}`,
      children: getBranchChildren(branch)
        .slice(0, 5)
        .map((child, childIndex) => ({
          id: text(child?.id, `${index}-${childIndex}`),
          label: shortText(child?.label || child?.title || child, 86) || `Detail ${childIndex + 1}`,
        })),
    }));

  return {
    root,
    description: shortText(mindmap?.description || mindmap?.summary || `A focused map for understanding ${root}.`, 88),
    difficulty: text(mindmap?.difficulty || mindmap?.level || mindmap?.complexity, 'Adaptive'),
    branches,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildLayout(map, expandedNodes) {
  const branches = map.branches.map(branch => {
    const branchHeight = nodeHeight(branch.label, BRANCH.minHeight, 22, 36);
    const details = expandedNodes.has(branch.id)
      ? branch.children.map(child => ({
        ...child,
        height: nodeHeight(child.label, DETAIL.minHeight, 30, 46),
      }))
      : [];
    const detailsHeight = details.length
      ? details.reduce((sum, child) => sum + child.height, 0) + (details.length - 1) * LAYOUT.detailGap
      : 0;
    return {
      ...branch,
      height: branchHeight,
      details,
      subtreeHeight: Math.max(branchHeight, detailsHeight),
    };
  });

  const totalHeight = Math.max(
    ROOT.minHeight + LAYOUT.marginY * 2,
    branches.reduce((sum, branch) => sum + branch.subtreeHeight, 0)
      + Math.max(0, branches.length - 1) * LAYOUT.siblingGap
      + LAYOUT.marginY * 2,
  );

  let cursor = LAYOUT.marginY + (totalHeight - (branches.reduce((sum, branch) => sum + branch.subtreeHeight, 0) + Math.max(0, branches.length - 1) * LAYOUT.siblingGap)) / 2;

  const positionedBranches = branches.map(branch => {
    const centerY = cursor + branch.subtreeHeight / 2;
    let detailCursor = centerY - (
      branch.details.reduce((sum, child) => sum + child.height, 0)
      + Math.max(0, branch.details.length - 1) * LAYOUT.detailGap
    ) / 2;

    const details = branch.details.map(child => {
      const positioned = {
        ...child,
        x: LAYOUT.detailX,
        y: detailCursor + child.height / 2,
      };
      detailCursor += child.height + LAYOUT.detailGap;
      return positioned;
    });

    cursor += branch.subtreeHeight + LAYOUT.siblingGap;
    return {
      ...branch,
      x: LAYOUT.branchX,
      y: centerY,
      details,
    };
  });

  const width = LAYOUT.detailX + DETAIL.width / 2 + LAYOUT.marginX;
  const root = { x: LAYOUT.rootX, y: totalHeight / 2 };
  return { width, height: totalHeight, root, branches: positionedBranches };
}

function ToolButton({ title, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-[#343434] transition hover:bg-[#F1F0EC]"
      aria-label={title}
      title={title}
    >
      {children}
    </button>
  );
}

function FullscreenIcon({ isFullscreen }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {isFullscreen ? (
        <>
          <path d="M8 3v5H3" />
          <path d="M16 3v5h5" />
          <path d="M8 21v-5H3" />
          <path d="M16 21v-5h5" />
        </>
      ) : (
        <>
          <path d="M3 8V3h5" />
          <path d="M21 8V3h-5" />
          <path d="M3 16v5h5" />
          <path d="M21 16v5h-5" />
        </>
      )}
    </svg>
  );
}

export default function MindMapView({ mindmap, topic }) {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasHeight, setCanvasHeight] = useState(680);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 900, height: 680 });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const viewportRef = useRef(null);
  const mapRef = useRef(null);
  const resizeRef = useRef({ startY: 0, startHeight: 680 });
  const panRef = useRef({ startX: 0, startY: 0, x: 0, y: 0, dragging: false });

  const map = useMemo(() => normalizeMindMap(mindmap, topic), [mindmap, topic]);
  const layout = useMemo(() => buildLayout(map, expandedNodes), [map, expandedNodes]);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;
    const update = () => setViewportSize({
      width: node.clientWidth || 900,
      height: node.clientHeight || 680,
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isFullscreen, canvasHeight]);

  const fitToScreen = useCallback(() => {
    const widthScale = (viewportSize.width - 90) / layout.width;
    const heightScale = (viewportSize.height - 90) / layout.height;
    const nextZoom = clamp(Math.min(widthScale, heightScale), 0.42, 1.1);
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({
      x: Math.round((viewportSize.width - layout.width * nextZoom) / 2),
      y: Math.round((viewportSize.height - layout.height * nextZoom) / 2),
    });
  }, [layout.height, layout.width, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    fitToScreen();
  }, [fitToScreen]);

  if (!mindmap && !topic) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
        <p>Mind map not available</p>
      </div>
    );
  }

  const toggleNode = (node) => {
    setSelectedNode(current => (current?.id === node.id ? null : node));
    setExpandedNodes(previous => {
      const next = new Set(previous);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  const beginResize = (event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { startY: event.clientY, startHeight: canvasHeight };
    const handleMove = (moveEvent) => {
      const delta = moveEvent.clientY - resizeRef.current.startY;
      setCanvasHeight(clamp(resizeRef.current.startHeight + delta, 520, 1100));
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const beginPan = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: pan.x,
      y: pan.y,
      dragging: true,
    };
    const handleMove = (moveEvent) => {
      if (!panRef.current.dragging) return;
      setPan({
        x: panRef.current.x + moveEvent.clientX - panRef.current.startX,
        y: panRef.current.y + moveEvent.clientY - panRef.current.startY,
      });
    };
    const handleUp = () => {
      panRef.current.dragging = false;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const setZoomBy = (delta) => {
    setZoom(value => clamp(Number((value + delta).toFixed(2)), 0.35, 1.7));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 36, y: Math.max(24, (viewportSize.height - layout.height) / 2) });
  };

  const exportCanvas = async (type) => {
    if (!mapRef.current) return;
    setShowExportMenu(false);
    const filename = `mind-map-${shortText(map.root, 28).toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'export'}`;
    if (type === 'svg') {
      const dataUrl = await toSvg(mapRef.current, { backgroundColor: '#F7F5F0' });
      downloadDataUrl(dataUrl, `${filename}.svg`);
      return;
    }
    const dataUrl = await toPng(mapRef.current, {
      backgroundColor: '#F7F5F0',
      pixelRatio: 2,
    });
    if (type === 'png') {
      downloadDataUrl(dataUrl, `${filename}.png`);
      return;
    }
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (popup) {
      popup.document.write(`<html><head><title>${filename}</title></head><body style="margin:0;background:#fff;"><img src="${dataUrl}" style="width:100%;height:auto;" onload="window.print()"/></body></html>`);
      popup.document.close();
    }
  };

  const shellClassName = isFullscreen
    ? 'fixed inset-0 z-[9999] overflow-auto bg-[#F7F5F0] p-3 sm:p-6'
    : 'w-full';
  const effectiveHeight = isFullscreen ? 'calc(100dvh - 3rem)' : `${canvasHeight}px`;
  const miniWidth = 190;
  const miniHeight = 126;
  const miniScale = Math.min(miniWidth / layout.width, miniHeight / layout.height);
  const visibleRect = {
    x: clamp((-pan.x / zoom) * miniScale, 0, miniWidth),
    y: clamp((-pan.y / zoom) * miniScale, 0, miniHeight),
    width: clamp((viewportSize.width / zoom) * miniScale, 18, miniWidth),
    height: clamp((viewportSize.height / zoom) * miniScale, 18, miniHeight),
  };

  return (
    <div className={shellClassName}>
      <div
        ref={viewportRef}
        className="relative mx-auto w-full max-w-7xl overflow-hidden rounded-[28px] border border-[#E3E0D8] bg-[#F7F5F0] shadow-[0_22px_60px_rgba(15,23,42,0.08)]"
        style={{
          height: effectiveHeight,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(17, 24, 39, 0.055) 1px, transparent 0)',
          backgroundSize: '26px 26px',
        }}
      >
        <div className="absolute right-4 top-4 z-40 flex items-center gap-1 rounded-full border border-[#D8D5CD] bg-white/90 p-1 shadow-sm">
          <ToolButton title="Zoom out" onClick={() => setZoomBy(-0.1)}>−</ToolButton>
          <ToolButton title="Zoom in" onClick={() => setZoomBy(0.1)}>+</ToolButton>
          <ToolButton title="Fit to screen" onClick={fitToScreen}>⌂</ToolButton>
          <ToolButton title="Reset view" onClick={resetView}>↺</ToolButton>
          <div className="relative">
            <ToolButton title="Export" onClick={() => setShowExportMenu(value => !value)}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            </ToolButton>
            {showExportMenu && (
              <div className="absolute right-0 top-10 z-50 w-36 rounded-xl border border-[#D8D5CD] bg-white p-1 text-xs shadow-xl">
                {['png', 'pdf', 'svg'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => exportCanvas(type)}
                    className="block w-full rounded-lg px-3 py-2 text-left font-medium uppercase text-[#343434] hover:bg-[#F1F0EC]"
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ToolButton title={isFullscreen ? 'Exit full screen' : 'Full screen'} onClick={() => setIsFullscreen(value => !value)}>
            {isFullscreen ? '⤡' : '⤢'}
          </ToolButton>
        </div>

        <div className="absolute inset-0 cursor-grab overflow-hidden active:cursor-grabbing" onPointerDown={beginPan}>
          <div
            ref={mapRef}
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${layout.width} ${layout.height}`}>
              {layout.branches.map(node => {
                const active = selectedNode?.id === node.id || expandedNodes.has(node.id);
                return (
                  <g key={node.id}>
                    <path
                      d={`M${layout.root.x + ROOT.width / 2 - 8} ${layout.root.y} C${layout.root.x + 190} ${layout.root.y}, ${node.x - 140} ${node.y}, ${node.x - BRANCH.width / 2} ${node.y}`}
                      stroke={active ? SECONDARY : LINE}
                      strokeWidth={active ? 2.3 : 1.3}
                      strokeOpacity={active ? 0.78 : 0.82}
                      fill="none"
                      strokeLinecap="round"
                    />
                    {expandedNodes.has(node.id) && node.details.map(child => (
                      <path
                        key={child.id}
                        d={`M${node.x + BRANCH.width / 2} ${node.y} C${node.x + 150} ${node.y}, ${child.x - 120} ${child.y}, ${child.x - DETAIL.width / 2} ${child.y}`}
                        stroke={LINE}
                        strokeWidth="1"
                        strokeOpacity="0.8"
                        fill="none"
                        strokeLinecap="round"
                      />
                    ))}
                  </g>
                );
              })}
            </svg>

            <div
              className="absolute z-20 flex w-[250px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-[42px] border border-white bg-white px-6 py-7 text-center shadow-[0_22px_58px_rgba(47,42,127,0.18)] ring-1 ring-[#E5E3DD]"
              style={{ left: layout.root.x, top: layout.root.y, minHeight: ROOT.minHeight }}
            >
              <h3 className="max-w-[190px] text-xl font-semibold leading-tight" style={{ color: TEXT }}>{map.root}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{map.description}</p>
              <div className="mt-4 rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: 'rgba(47, 42, 127, 0.18)', background: 'rgba(47, 42, 127, 0.06)', color: PRIMARY }}>
                {map.difficulty}
              </div>
            </div>

            {layout.branches.map(node => {
              const isExpanded = expandedNodes.has(node.id);
              const active = selectedNode?.id === node.id;
              return (
                <div key={node.id}>
                  <button
                    type="button"
                    onPointerDown={event => event.stopPropagation()}
                    onClick={() => toggleNode(node)}
                    className="absolute z-20 flex min-h-[72px] w-[210px] -translate-x-1/2 -translate-y-1/2 items-center justify-between gap-3 rounded-2xl border bg-white/94 px-4 py-3 text-left text-sm font-medium leading-snug shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur transition duration-300 hover:shadow-[0_16px_38px_rgba(15,23,42,0.11)]"
                    style={{
                      left: node.x,
                      top: node.y,
                      borderColor: active ? SECONDARY : '#E0DED8',
                      color: active ? TEXT : '#303030',
                    }}
                    aria-expanded={isExpanded}
                  >
                    <span className="min-w-0 whitespace-normal break-words">{node.label}</span>
                    {node.children.length > 0 && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#D8D5CD] text-sm leading-none">
                        {isExpanded ? '−' : '+'}
                      </span>
                    )}
                  </button>

                  {isExpanded && node.details.map(child => (
                    <div
                      key={child.id}
                      className="absolute z-10 flex min-h-[48px] w-[220px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border border-[#E3E0D8] bg-white/90 px-3 py-2 text-center text-xs font-medium leading-snug text-[#3E3E3E] shadow-[0_10px_24px_rgba(15,23,42,0.07)] backdrop-blur transition-all duration-300"
                      style={{ left: child.x, top: child.y }}
                    >
                      <span className="whitespace-normal break-words">{child.label}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-4 right-4 z-40 rounded-2xl border border-[#D8D5CD] bg-white/88 p-2 shadow-lg backdrop-blur">
          <div
            className="relative overflow-hidden rounded-xl bg-[#F2F1ED]"
            style={{ width: miniWidth, height: miniHeight }}
            onPointerDown={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              const moveTo = (clientX, clientY) => {
                const x = clamp((clientX - rect.left) / miniScale - viewportSize.width / (2 * zoom), 0, layout.width);
                const y = clamp((clientY - rect.top) / miniScale - viewportSize.height / (2 * zoom), 0, layout.height);
                setPan({ x: -x * zoom, y: -y * zoom });
              };
              moveTo(event.clientX, event.clientY);
              const move = moveEvent => moveTo(moveEvent.clientX, moveEvent.clientY);
              const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
            }}
          >
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${miniWidth} ${miniHeight}`}>
              <rect x="0" y="0" width={miniWidth} height={miniHeight} fill="#F2F1ED" />
              <rect x={layout.root.x * miniScale - 8} y={layout.root.y * miniScale - 8} width="16" height="16" rx="5" fill={PRIMARY} opacity="0.55" />
              {layout.branches.map(node => (
                <rect key={node.id} x={node.x * miniScale - 9} y={node.y * miniScale - 4} width="18" height="8" rx="3" fill="#A3A3A3" />
              ))}
              <rect
                x={visibleRect.x}
                y={visibleRect.y}
                width={visibleRect.width}
                height={visibleRect.height}
                rx="4"
                fill="none"
                stroke={SECONDARY}
                strokeWidth="1.5"
              />
            </svg>
          </div>
        </div>

        {!isFullscreen && (
          <button type="button" onPointerDown={beginResize} className="absolute bottom-3 left-3 z-40 flex h-8 w-8 cursor-ns-resize flex-col items-center justify-center gap-0.5 rounded-full border border-[#D8D5CD] bg-white/90 shadow-sm transition hover:bg-white" aria-label="Resize mind map" title="Drag to resize">
            <span className="h-px w-3 rounded-full bg-[#8B8B8B]" />
            <span className="h-px w-3 rounded-full bg-[#8B8B8B]" />
          </button>
        )}
      </div>
    </div>
  );
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
