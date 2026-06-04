import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function buildSrcDoc(bundle) {
  if (bundle?.sandbox?.srcDoc) return bundle.sandbox.srcDoc;

  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src 'none'",
    "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');

  const bridge = `
(() => {
  const CONTROL_LABELS = {
    restart: { match: /^restart$/i, label: '↻', title: 'Restart' },
    prev: { match: /^(previous|prev)$/i, label: '←', title: 'Previous' },
    next: { match: /^next$/i, label: '→', title: 'Next' },
    play: { match: /^play$/i, label: '▶', title: 'Play' },
    pause: { match: /^pause$/i, label: '⏸', title: 'Pause' }
  };
  const normalizeControlLabels = () => {
    document.querySelectorAll('button').forEach(button => {
      const text = String(button.textContent || '').trim();
      const key = button.id === 'play' && /^pause$/i.test(text) ? 'pause' : button.id;
      const config = CONTROL_LABELS[key] || Object.values(CONTROL_LABELS).find(item => item.match.test(text));
      if (!config || text === config.label) return;
      button.textContent = config.label;
      button.setAttribute('aria-label', config.title);
      button.setAttribute('title', config.title);
    });
  };
  const send = (type, payload) => {
    try { window.parent.postMessage({ source: 'visualearn-sandbox', type, payload }, '*'); } catch {}
  };
  const original = { log: console.log, warn: console.warn, error: console.error };
  for (const level of Object.keys(original)) {
    console[level] = (...args) => {
      send('console', { level, args: args.map(arg => {
        try { return typeof arg === 'object' ? JSON.stringify(arg) : String(arg); } catch { return String(arg); }
      }) });
      original[level](...args);
    };
  }
  window.addEventListener('DOMContentLoaded', () => {
    normalizeControlLabels();
    new MutationObserver(normalizeControlLabels).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  window.addEventListener('error', event => send('runtime_error', { message: event.message, lineno: event.lineno, colno: event.colno }));
  window.addEventListener('unhandledrejection', event => send('runtime_error', { message: String(event.reason || 'Unhandled rejection') }));
})();`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>${bundle?.css || ''}</style>
</head>
<body>
${bundle?.html || ''}
<script>${bridge}</script>
<script>${bundle?.js || ''}</script>
</body>
</html>`;
}

export default function SandboxSimulationFrame({ bundle, height = 700, onSandboxEvent }) {
  const srcDoc = useMemo(() => buildSrcDoc(bundle), [bundle]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === shellRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen && document.fullscreenElement !== shellRef.current) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    const node = shellRef.current;
    if (!node) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
        return;
      }

      if (node.requestFullscreen) {
        await node.requestFullscreen();
      }
      setIsFullscreen(true);
    } catch {
      setIsFullscreen(value => !value);
    }
  }, []);

  useEffect(() => {
    function handleMessage(event) {
      const data = event.data;
      if (!data || data.source !== 'visualearn-sandbox') return;
      onSandboxEvent?.(data);
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSandboxEvent]);

  return (
    <section
      ref={shellRef}
      className={`relative overflow-hidden border border-border bg-[#FAF7F2] ${
        isFullscreen ? 'fixed inset-0 z-[9999] rounded-none border-0' : 'rounded-lg'
      }`}
    >
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Open fullscreen'}
        title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white/95 text-[#111111] shadow-sm backdrop-blur hover:bg-[#f3eee7]"
      >
        {isFullscreen ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v5H3" />
            <path d="M16 3v5h5" />
            <path d="M8 21v-5H3" />
            <path d="M16 21v-5h5" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8V3h5" />
            <path d="M21 8V3h-5" />
            <path d="M3 16v5h5" />
            <path d="M21 16v5h-5" />
          </svg>
        )}
      </button>
      <iframe
        title={bundle?.title || 'Sandbox simulation'}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        className="w-full border-0 bg-[#FAF7F2]"
        style={{ height: isFullscreen ? '100dvh' : height }}
      />
    </section>
  );
}
