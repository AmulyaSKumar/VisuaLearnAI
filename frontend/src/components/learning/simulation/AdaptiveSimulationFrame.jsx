import { useMemo } from 'react';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeColor(value, fallback = '#111827') {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
}

function primitiveMap(primitives) {
  return new Map((primitives || []).map((primitive) => [primitive.id, primitive]));
}

function isActive(primitive, activeIds) {
  return activeIds.has(primitive.id);
}

function renderEdge(primitive, primitivesById, activeIds) {
  const from = primitivesById.get(primitive.from);
  const to = primitivesById.get(primitive.to);
  if (!from || !to) return '';

  const active = isActive(primitive, activeIds) || isActive(from, activeIds) || isActive(to, activeIds);
  const x1 = safeNumber(from.x, 10);
  const y1 = safeNumber(from.y, 10);
  const x2 = safeNumber(to.x, 90);
  const y2 = safeNumber(to.y, 90);
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2 - 2;

  return `
    <g class="${active ? 'active' : ''}">
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${active ? '#4c1d95' : '#6b7280'}" stroke-width="${active ? '1.6' : '0.9'}" marker-end="url(#arrow)" opacity="${active ? '0.95' : '0.55'}" />
      ${primitive.label ? `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="3" fill="#111827">${escapeHtml(primitive.label)}</text>` : ''}
    </g>
  `;
}

function renderNode(primitive, activeIds) {
  const active = isActive(primitive, activeIds);
  const x = safeNumber(primitive.x, 50);
  const y = safeNumber(primitive.y, 50);
  const radius = Math.max(4, Math.min(10, safeNumber(primitive.w, 12) / 1.6));
  const fill = active ? '#4c1d95' : safeColor(primitive.color, '#111827');

  return `
    <g class="primitive node ${active ? 'active' : ''}">
      <circle cx="${x}" cy="${y}" r="${radius + (active ? 3 : 1.5)}" fill="${active ? '#ede9fe' : '#f3f4f6'}" stroke="${fill}" stroke-width="${active ? '0.8' : '0.4'}" />
      <circle cx="${x}" cy="${y}" r="${radius}" fill="${fill}" opacity="0.96" />
      <text x="${x}" y="${y + radius + 6}" text-anchor="middle" font-size="4" fill="#111827" font-weight="700">${escapeHtml(primitive.label)}</text>
    </g>
  `;
}

function renderBar(primitive, activeIds) {
  const active = isActive(primitive, activeIds);
  const x = safeNumber(primitive.x, 10);
  const value = Math.max(4, safeNumber(primitive.value, 50));
  const width = Math.max(4, safeNumber(primitive.w, 10));
  const height = Math.min(72, value * 0.68);
  const y = 88 - height;
  const fill = active ? '#4c1d95' : safeColor(primitive.color, '#111827');

  return `
    <g class="primitive bar ${active ? 'active' : ''}">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="1.5" fill="${fill}" opacity="${active ? '0.98' : '0.78'}" />
      <text x="${x + width / 2}" y="95" text-anchor="middle" font-size="3.5" fill="#111827" font-weight="${active ? '700' : '500'}">${escapeHtml(primitive.label)}</text>
    </g>
  `;
}

function renderText(primitive, activeIds) {
  const active = isActive(primitive, activeIds);
  return `
    <g class="primitive text ${active ? 'active' : ''}">
      <rect x="${safeNumber(primitive.x, 8)}" y="${safeNumber(primitive.y, 8)}" width="${safeNumber(primitive.w, 28)}" height="${safeNumber(primitive.h, 10)}" rx="2" fill="${active ? '#ede9fe' : '#ffffff'}" stroke="${active ? '#4c1d95' : '#111827'}" stroke-width="0.35" />
      <text x="${safeNumber(primitive.x, 8) + 2}" y="${safeNumber(primitive.y, 8) + safeNumber(primitive.h, 10) / 2 + 1.4}" font-size="3.5" fill="#111827" font-weight="${active ? '700' : '500'}">${escapeHtml(primitive.label)}</text>
    </g>
  `;
}

function renderFlowBox(primitive, activeIds) {
  const active = isActive(primitive, activeIds);
  return `
    <g class="primitive flow ${active ? 'active' : ''}">
      <rect x="${safeNumber(primitive.x, 10)}" y="${safeNumber(primitive.y, 10)}" width="${safeNumber(primitive.w, 20)}" height="${safeNumber(primitive.h, 10)}" rx="3" fill="${active ? '#4c1d95' : '#ffffff'}" stroke="#4c1d95" stroke-width="${active ? '0.8' : '0.45'}" />
      <text x="${safeNumber(primitive.x, 10) + safeNumber(primitive.w, 20) / 2}" y="${safeNumber(primitive.y, 10) + safeNumber(primitive.h, 10) / 2 + 1.3}" text-anchor="middle" font-size="3.3" fill="${active ? '#ffffff' : '#111827'}" font-weight="700">${escapeHtml(primitive.label)}</text>
    </g>
  `;
}

function renderMatrixCell(primitive, activeIds) {
  const active = isActive(primitive, activeIds);
  const size = Math.max(6, Math.min(12, safeNumber(primitive.w, 9)));
  const x = 18 + safeNumber(primitive.col, 0) * (size + 1.5);
  const y = 18 + safeNumber(primitive.row, 0) * (size + 1.5);

  return `
    <g class="primitive matrix ${active ? 'active' : ''}">
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="1.4" fill="${active ? '#ede9fe' : '#ffffff'}" stroke="${active ? '#4c1d95' : '#111827'}" stroke-width="${active ? '0.8' : '0.35'}" />
      <text x="${x + size / 2}" y="${y + size / 2 + 1.4}" text-anchor="middle" font-size="${Math.max(2.8, size * 0.34)}" fill="#111827" font-weight="${active ? '700' : '500'}">${escapeHtml(primitive.label)}</text>
    </g>
  `;
}

function renderTimelineEvent(primitive, activeIds) {
  const active = isActive(primitive, activeIds);
  const x = safeNumber(primitive.x, 10);
  const y = safeNumber(primitive.y, 50);

  return `
    <g class="primitive timeline ${active ? 'active' : ''}">
      <circle cx="${x}" cy="${y}" r="${active ? 3.5 : 2.4}" fill="${active ? '#4c1d95' : '#6b7280'}" />
      <text x="${x}" y="${y + 8}" text-anchor="middle" font-size="3.2" fill="#111827" font-weight="${active ? '700' : '500'}">${escapeHtml(primitive.label)}</text>
    </g>
  `;
}

function renderPrimitive(primitive, primitivesById, activeIds) {
  switch (primitive.type) {
    case 'edge':
      return renderEdge(primitive, primitivesById, activeIds);
    case 'bar':
      return renderBar(primitive, activeIds);
    case 'text':
      return renderText(primitive, activeIds);
    case 'matrixCell':
      return renderMatrixCell(primitive, activeIds);
    case 'timelineEvent':
      return renderTimelineEvent(primitive, activeIds);
    case 'flowBox':
      return renderFlowBox(primitive, activeIds);
    case 'node':
    default:
      return renderNode(primitive, activeIds);
  }
}

function renderGuideLines(simulation) {
  if (simulation.layout === 'timeline') {
    return '<line x1="8" y1="50" x2="92" y2="50" stroke="#111827" stroke-width="0.6" opacity="0.28" />';
  }
  if (simulation.layout === 'matrix') {
    return '<rect x="15" y="15" width="70" height="70" rx="3" fill="#fffaf0" stroke="#111827" stroke-width="0.35" opacity="0.55" />';
  }
  return '';
}

function buildHtml(simulation, currentStep) {
  const steps = Array.isArray(simulation?.steps) ? simulation.steps : [];
  const primitives = Array.isArray(simulation?.primitives) ? simulation.primitives : [];
  const step = steps[currentStep] || steps[0] || {};
  const activeIds = new Set(step.activePrimitiveIds || []);
  const primitivesById = primitiveMap(primitives);
  const edges = primitives.filter((primitive) => primitive.type === 'edge');
  const nonEdges = primitives.filter((primitive) => primitive.type !== 'edge');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f8f1df;
      color: #111827;
      overflow: hidden;
    }
    main { height: 100vh; padding: 12px; }
    .stage {
      width: 100%;
      height: 100%;
      border: 1px solid rgba(17,24,39,0.12);
      border-radius: 12px;
      background: linear-gradient(180deg, #fffdf7 0%, #fff8e8 100%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.9);
      overflow: hidden;
    }
    svg { width: 100%; height: 100%; display: block; }
    .primitive { animation: enter 360ms ease both; transform-origin: center; }
    .primitive.active { animation: enter 360ms ease both, pulse 1200ms ease-in-out infinite; }
    @keyframes enter {
      from { opacity: 0; transform: translateY(5px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes pulse {
      0%, 100% { filter: drop-shadow(0 0 0 rgba(76,29,149,0)); }
      50% { filter: drop-shadow(0 0 4px rgba(76,29,149,0.35)); }
    }
  </style>
</head>
<body>
  <main>
    <section class="stage" aria-label="${escapeHtml(simulation?.type || 'Adaptive simulation')}">
      <svg viewBox="0 0 100 100" role="img">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280"></path>
          </marker>
        </defs>
        <rect x="2" y="2" width="96" height="96" rx="5" fill="#fffaf0" />
        ${renderGuideLines(simulation)}
        ${edges.map((primitive) => renderPrimitive(primitive, primitivesById, activeIds)).join('')}
        ${nonEdges.map((primitive) => renderPrimitive(primitive, primitivesById, activeIds)).join('')}
      </svg>
    </section>
  </main>
</body>
</html>`;
}

export default function AdaptiveSimulationFrame({ simulation, currentStep }) {
  const html = useMemo(() => buildHtml(simulation, currentStep), [simulation, currentStep]);

  return (
    <iframe
      title={simulation?.type || 'Adaptive simulation'}
      srcDoc={html}
      sandbox=""
      className="h-[420px] w-full border-0 bg-[#f8f1df]"
    />
  );
}
