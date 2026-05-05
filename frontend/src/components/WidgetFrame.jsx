import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Detect if widget code is a 3D visualization
 * @param {string} code - Widget HTML code
 * @param {string} widgetType - Explicit widget type from API
 * @returns {boolean}
 */
function is3DWidget(code, widgetType) {
  if (widgetType === '3d') return true;
  if (!code) return false;
  const lowerCode = code.toLowerCase();
  return lowerCode.includes('three.js') ||
         lowerCode.includes('three.min.js') ||
         lowerCode.includes('three.module.js') ||
         lowerCode.includes('webglrenderer') ||
         lowerCode.includes('three.scene') ||
         lowerCode.includes('new three.');
}

/**
 * Generate CSP meta tag for widget security
 */
function getCSPMeta() {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://d3js.org https://cdn.plot.ly; style-src 'unsafe-inline'; img-src 'self' data: blob:;">`;
}

export default function WidgetFrame({ widget, onInteraction }) {
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const [height, setHeight] = useState(400);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [stats, setStats] = useState({
    progress: 0,
    hintsUsed: 0,
    errorsCount: 0,
    interactionCount: 0,
    startTime: Date.now(),
  });
  const [showStats, setShowStats] = useState(true);

  // Detect if this is a 3D widget
  const is3D = is3DWidget(widget?.code, widget?.widget_type);

  // Visibility observer for 3D widgets - pause when not visible
  useEffect(() => {
    if (!containerRef.current || !is3D) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting);
        // Send visibility status to iframe
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'visibility_change', visible: entry.isIntersecting, id: widget.id },
            '*'
          );
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [is3D, widget.id]);

  // Send pause/resume commands to iframe
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: isPaused ? 'pause_animation' : 'resume_animation', id: widget.id },
      '*'
    );
  }, [isPaused, widget.id]);

  // Handle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }, [isFullscreen]);

  // Track fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!iframeRef.current || !widget?.code) return;

    // We extract the current CSS variables from the document root
    // to inject them into the iframe, so the widget matches our exact theme!
    const styleBlock = `
      <style>
        :root {
          --color-foreground: ${getComputedStyle(document.documentElement).getPropertyValue('--foreground') || '#3d3929'};
          --color-background: transparent;
          --color-primary: ${getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#c96442'};
          --color-muted: ${getComputedStyle(document.documentElement).getPropertyValue('--muted') || '#ede9de'};
          --color-border: ${getComputedStyle(document.documentElement).getPropertyValue('--border') || '#dad9d4'};
          --color-card: ${getComputedStyle(document.documentElement).getPropertyValue('--card') || '#faf9f5'};
          --color-card-foreground: ${getComputedStyle(document.documentElement).getPropertyValue('--card-foreground') || '#141413'};
          --color-muted-foreground: ${getComputedStyle(document.documentElement).getPropertyValue('--muted-foreground') || '#83827d'};
        }
        body {
          margin: 0;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          color: var(--color-foreground);
          background-color: var(--color-background);
          overflow-y: hidden;
        }
        /* Make scrollbars invisible but keep scrolling */
        ::-webkit-scrollbar { width: 0px; background: transparent; }
      </style>
    `;

    // Script to handle resize and parent communication
    const resizeScript = `
      <script>
        const ro = new ResizeObserver(() => {
          window.parent.postMessage({ type: 'resize', height: document.documentElement.scrollHeight, id: '${widget.id}' }, '*');
        });
        ro.observe(document.body);
      </script>
    `;

    // For 3D widgets: add visibility and pause handling
    const visibilityScript = is3D ? `
      <script>
        window._visualearn3DPaused = false;
        window._visualearn3DVisible = true;
        window.addEventListener('message', function(e) {
          if (e.data?.id !== '${widget.id}') return;
          if (e.data?.type === 'visibility_change') {
            window._visualearn3DVisible = e.data.visible;
          }
          if (e.data?.type === 'pause_animation') {
            window._visualearn3DPaused = true;
          }
          if (e.data?.type === 'resume_animation') {
            window._visualearn3DPaused = false;
          }
          if (e.data?.type === 'cleanup') {
            window.dispatchEvent(new Event('beforeunload'));
          }
        });
      </script>
    ` : '';

    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          ${getCSPMeta()}
          ${styleBlock}
        </head>
        <body>
          ${visibilityScript}
          ${widget.code}
          ${resizeScript}
        </body>
      </html>
    `;

    iframeRef.current.srcdoc = fullHTML;

    // Cleanup on unmount - send cleanup message to iframe
    return () => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'cleanup', id: widget.id }, '*');
      }
    };
  }, [widget.code, widget.id, is3D]);

  useEffect(() => {
    const handleMessage = (e) => {
      if (iframeRef.current && e.source === iframeRef.current.contentWindow) {
        if (e.data?.type === 'widget_analytics') {
          const analytics = e.data.data || {};
          setStats(prev => ({
            ...prev,
            progress: Math.max(prev.progress, Math.round((analytics.completionRate || 0) * 100)),
            hintsUsed: analytics.hintsUsed ?? prev.hintsUsed,
            errorsCount: analytics.errorsCount ?? prev.errorsCount,
            interactionCount: analytics.interactions ?? prev.interactionCount,
          }));

          if (onInteraction) {
            onInteraction({
              widgetId: widget.id,
              action: 'widget_analytics',
              data: analytics,
              stats,
              decisionId: widget.decisionId || null,
              selectedAction: widget.selectedAction || null,
              topicKey: widget.topicKey || null,
            });
          }
          return;
        }

        const interactionType = e.data?.type;
        const isInteractionEvent = interactionType && interactionType !== 'resize';
        if (isInteractionEvent && interactionType !== 'widget_analytics') {
          const mappedAction = interactionType;
          setStats(prev => {
            const updated = { ...prev, interactionCount: prev.interactionCount + 1 };
            if (mappedAction === 'hint_used') updated.hintsUsed = prev.hintsUsed + 1;
            if (mappedAction === 'quiz_answer' && e.data?.correct === false) updated.errorsCount = prev.errorsCount + 1;
            if (mappedAction === 'step_change' && e.data?.to) {
              updated.progress = Math.max(prev.progress, Math.min(99, Math.round((e.data.to / 7) * 100)));
            }
            return updated;
          });

          if (onInteraction) {
            onInteraction({
              widgetId: widget.id,
              action: mappedAction,
              data: e.data,
              stats,
              decisionId: widget.decisionId || null,
              selectedAction: widget.selectedAction || null,
              topicKey: widget.topicKey || null,
            });
          }
          return;
        }
      }

      if (e.data?.type === 'resize' && e.data?.id === widget.id) {
        setHeight(Math.max(400, Math.min(e.data.height + 20, 800))); // Min 400px, Max 800px
      }
      // Handle widget interaction messages
      if (e.data?.type === 'widget_interaction' && e.data?.id === widget.id) {
        const { action, data } = e.data;
        setStats(prev => {
          const updated = { ...prev, interactionCount: prev.interactionCount + 1 };
          if (action === 'progress') updated.progress = Math.min(100, data.value || prev.progress);
          if (action === 'hint') updated.hintsUsed = prev.hintsUsed + 1;
          if (action === 'error') updated.errorsCount = prev.errorsCount + 1;
          if (action === 'complete') updated.progress = 100;
          return updated;
        });
        // Notify parent
        if (onInteraction) {
          onInteraction({
            widgetId: widget.id,
            action,
            data,
            stats,
            decisionId: widget.decisionId || null,
            selectedAction: widget.selectedAction || null,
            topicKey: widget.topicKey || null,
          });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [widget.id, onInteraction, stats]);

  // Calculate elapsed time
  const elapsedSeconds = Math.floor((Date.now() - stats.startTime) / 1000);
  const elapsedDisplay = elapsedSeconds < 60 ? `${elapsedSeconds}s` : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;

  return (
    <div ref={containerRef} className={`w-full bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      {/* Header with title and controls */}
      <div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{widget.title || 'Visualization'}</span>
          {is3D && (
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">3D</span>
          )}
          {is3D && !isVisible && (
            <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded">Paused</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Pause Button (3D only) */}
          {is3D && (
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                isPaused ? 'bg-orange-500/20 text-orange-500' : 'text-muted-foreground hover:bg-border/50 hover:text-foreground'
              }`}
              title={isPaused ? 'Resume animation' : 'Pause animation'}
            >
              {isPaused ? (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              )}
            </button>
          )}
          {/* Toggle Stats Button */}
          <button
            onClick={() => setShowStats(!showStats)}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
              showStats ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-border/50 hover:text-foreground'
            }`}
            title="Toggle stats"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
          </button>
          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
              isFullscreen ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-border/50 hover:text-foreground'
            }`}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2C2.44772 2 2 2.44772 2 3V12C2 12.5523 2.44772 13 3 13H12C12.5523 13 13 12.5523 13 12V8.5C13 8.22386 13.2239 8 13.5 8C13.7761 8 14 8.22386 14 8.5V12C14 13.1046 13.1046 14 12 14H3C1.89543 14 1 13.1046 1 12V3C1 1.89543 1.89543 1 3 1H6.5C6.77614 1 7 1.22386 7 1.5C7 1.77614 6.77614 2 6.5 2H3ZM12.8536 2.85355L14.3536 1.35355C14.5488 1.15829 14.5488 0.841709 14.3536 0.646447C14.1583 0.451184 13.8417 0.451184 13.6464 0.646447L12.1464 2.14645L10.8536 0.853553C10.5386 0.538571 10 0.761654 10 1.20711V5C10 5.27614 10.2239 5.5 10.5 5.5H14.2929C14.7383 5.5 14.9614 4.96143 14.6464 4.64645L12.8536 2.85355Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
            )}
          </button>
        </div>
      </div>

      {/* Stats Overlay Bar */}
      {showStats && (
        <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center gap-4 text-xs">
          {/* Progress */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-muted-foreground">Progress:</span>
            <div className="flex-1 max-w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  stats.progress >= 100 ? 'bg-green-500' : 'bg-primary'
                }`}
                style={{ width: `${stats.progress}%` }}
              />
            </div>
            <span className="font-medium text-foreground">{stats.progress}%</span>
          </div>
          {/* Hints */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Hints:</span>
            <span className={`font-medium ${stats.hintsUsed > 2 ? 'text-orange-500' : 'text-foreground'}`}>
              {stats.hintsUsed}
            </span>
          </div>
          {/* Errors */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Errors:</span>
            <span className={`font-medium ${stats.errorsCount > 3 ? 'text-red-500' : 'text-foreground'}`}>
              {stats.errorsCount}
            </span>
          </div>
          {/* Time */}
          <div className="flex items-center gap-1 text-muted-foreground">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>{elapsedDisplay}</span>
          </div>
        </div>
      )}

      {/* Widget Content */}
      <div className="p-4 relative" style={{ height: isFullscreen ? 'calc(100vh - 120px)' : `${height}px` }}>
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          className="w-full h-full border-none"
          title={widget.title}
        />
        {/* Completion Badge */}
        {stats.progress >= 100 && (
          <div className="absolute top-6 right-6 px-3 py-1.5 bg-green-500 text-white rounded-full text-xs font-medium flex items-center gap-1.5 shadow-lg animate-in zoom-in duration-200">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Complete!
          </div>
        )}
      </div>
    </div>
  );
}
