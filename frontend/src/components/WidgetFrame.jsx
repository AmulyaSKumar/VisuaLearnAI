import { useEffect, useRef, useState, useCallback } from "react";

export default function WidgetFrame({ widget, onInteraction }) {
  const iframeRef = useRef(null);
  const [height, setHeight] = useState(400);
  const [stats, setStats] = useState({
    progress: 0,
    hintsUsed: 0,
    errorsCount: 0,
    interactionCount: 0,
    startTime: Date.now(),
  });
  const [showStats, setShowStats] = useState(true);

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

    // A small script to send the content height to the parent window so we can auto-resize the iframe
    const resizeScript = `
      <script>
        const ro = new ResizeObserver(() => {
          window.parent.postMessage({ type: 'resize', height: document.documentElement.scrollHeight, id: '${widget.id}' }, '*');
        });
        ro.observe(document.body);
      </script>
    `;

    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          ${styleBlock}
        </head>
        <body>
          ${widget.code}
          ${resizeScript}
        </body>
      </html>
    `;

    iframeRef.current.srcdoc = fullHTML;
  }, [widget.code, widget.id]);

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
    <div className="w-full bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Header with title and controls */}
      <div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{widget.title || 'Visualization'}</span>
        <div className="flex items-center gap-2">
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
          {/* Expand Button */}
          <button className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:bg-border/50 hover:text-foreground transition-colors">
            <svg width="12" height="12" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 2C2.44772 2 2 2.44772 2 3V12C2 12.5523 2.44772 13 3 13H12C12.5523 13 13 12.5523 13 12V8.5C13 8.22386 13.2239 8 13.5 8C13.7761 8 14 8.22386 14 8.5V12C14 13.1046 13.1046 14 12 14H3C1.89543 14 1 13.1046 1 12V3C1 1.89543 1.89543 1 3 1H6.5C6.77614 1 7 1.22386 7 1.5C7 1.77614 6.77614 2 6.5 2H3ZM12.8536 2.85355L14.3536 1.35355C14.5488 1.15829 14.5488 0.841709 14.3536 0.646447C14.1583 0.451184 13.8417 0.451184 13.6464 0.646447L12.1464 2.14645L10.8536 0.853553C10.5386 0.538571 10 0.761654 10 1.20711V5C10 5.27614 10.2239 5.5 10.5 5.5H14.2929C14.7383 5.5 14.9614 4.96143 14.6464 4.64645L12.8536 2.85355Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
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
      <div className="p-4 relative" style={{ height: `${height}px` }}>
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts allow-popups"
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
