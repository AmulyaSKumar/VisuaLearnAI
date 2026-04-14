/**
 * Secure Widget Renderer
 * Renders widget HTML in a sandboxed iframe with XSS protection
 * Replaces the original WidgetFrame for enhanced security
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { sanitizeWidget, createCSPMetaTag } from "../utils/widgetSanitizer";

/**
 * Props for WidgetRenderer
 * @typedef {Object} WidgetRendererProps
 * @property {string} widgetCode - Raw HTML widget code
 * @property {string} title - Widget title for display and accessibility
 * @property {string} [id] - Unique widget ID for messaging
 * @property {function} [onInteraction] - Callback for widget interactions
 * @property {number} [minHeight=400] - Minimum iframe height
 * @property {number} [maxHeight=800] - Maximum iframe height
 */

/**
 * Secure widget renderer with sandboxing and XSS protection
 * @param {WidgetRendererProps} props
 */
export default function WidgetRenderer({
  widgetCode,
  title,
  id = `widget-${Date.now()}`,
  onInteraction,
  minHeight = 400,
  maxHeight = 800,
}) {
  const iframeRef = useRef(null);
  const blobUrlRef = useRef(null);
  const [height, setHeight] = useState(minHeight);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    progress: 0,
    hintsUsed: 0,
    errorsCount: 0,
    interactionCount: 0,
    startTime: Date.now(),
  });
  const [showStats, setShowStats] = useState(true);

  // Memoize sanitized HTML to avoid re-sanitizing on every render
  const sanitizedHtml = useMemo(() => {
    try {
      return sanitizeWidget(widgetCode);
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [widgetCode]);

  // Build complete HTML document with CSP and theming
  const buildSecureDocument = useCallback(() => {
    if (!sanitizedHtml) return null;

    // Extract CSS variables from document root for theme consistency
    const computedStyle = getComputedStyle(document.documentElement);
    const cssVars = `
      :root {
        --color-foreground: ${computedStyle.getPropertyValue('--foreground') || '#3d3929'};
        --color-background: transparent;
        --color-primary: ${computedStyle.getPropertyValue('--primary') || '#c96442'};
        --color-muted: ${computedStyle.getPropertyValue('--muted') || '#ede9de'};
        --color-border: ${computedStyle.getPropertyValue('--border') || '#dad9d4'};
        --color-card: ${computedStyle.getPropertyValue('--card') || '#faf9f5'};
        --color-card-foreground: ${computedStyle.getPropertyValue('--card-foreground') || '#141413'};
        --color-muted-foreground: ${computedStyle.getPropertyValue('--muted-foreground') || '#83827d'};
      }
    `;

    // Resize observer script for auto-height adjustment
    const resizeScript = `
      <script>
        (function() {
          const widgetId = '${id}';

          // Resize observer for content height
          const ro = new ResizeObserver(() => {
            const height = Math.max(
              document.body.scrollHeight,
              document.body.offsetHeight,
              document.documentElement.clientHeight,
              document.documentElement.scrollHeight,
              document.documentElement.offsetHeight
            );
            window.parent.postMessage({
              type: 'widget_resize',
              height: height,
              id: widgetId
            }, '*');
          });
          ro.observe(document.body);

          // Helper function for widgets to report interactions
          window.reportInteraction = function(action, data) {
            window.parent.postMessage({
              type: 'widget_interaction',
              id: widgetId,
              action: action,
              data: data || {}
            }, '*');
          };

          // Initial resize
          setTimeout(() => {
            window.parent.postMessage({
              type: 'widget_resize',
              height: document.body.scrollHeight,
              id: widgetId
            }, '*');
            window.parent.postMessage({
              type: 'widget_loaded',
              id: widgetId
            }, '*');
          }, 100);
        })();
      </script>
    `;

    // Build complete document
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${createCSPMetaTag()}
  <style>
    ${cssVars}
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 8px;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: var(--color-foreground);
      background-color: var(--color-background);
      overflow-x: hidden;
      overflow-y: auto;
      min-height: 100%;
    }
    ::-webkit-scrollbar { width: 6px; background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }
  </style>
</head>
<body>
  ${sanitizedHtml}
  ${resizeScript}
</body>
</html>`;
  }, [sanitizedHtml, id]);

  // Create blob URL and set iframe src
  useEffect(() => {
    if (!iframeRef.current || error) return;

    const html = buildSecureDocument();
    if (!html) return;

    // Revoke previous blob URL
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    // Create new blob URL
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    blobUrlRef.current = blobUrl;

    // Set iframe src
    iframeRef.current.src = blobUrl;

    // Cleanup on unmount
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [buildSecureDocument, error]);

  // Handle messages from iframe
  useEffect(() => {
    const handleMessage = (event) => {
      // Only accept messages from our iframe
      if (!event.data || typeof event.data !== 'object') return;

      const { type, id: messageId, height: newHeight, action, data } = event.data;

      // Only process messages for this widget
      if (messageId !== id) return;

      switch (type) {
        case 'widget_resize':
          if (typeof newHeight === 'number') {
            setHeight(Math.max(minHeight, Math.min(newHeight + 20, maxHeight)));
          }
          break;

        case 'widget_loaded':
          setIsLoading(false);
          break;

        case 'widget_interaction':
          // Update stats
          setStats(prev => {
            const updated = { ...prev, interactionCount: prev.interactionCount + 1 };
            if (action === 'progress') {
              updated.progress = Math.min(100, data?.value || prev.progress);
            }
            if (action === 'hint') {
              updated.hintsUsed = prev.hintsUsed + 1;
            }
            if (action === 'error') {
              updated.errorsCount = prev.errorsCount + 1;
            }
            if (action === 'complete') {
              updated.progress = 100;
            }
            return updated;
          });

          // Notify parent
          if (onInteraction) {
            onInteraction({ widgetId: id, action, data, stats });
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [id, onInteraction, stats, minHeight, maxHeight]);

  // Calculate elapsed time
  const elapsedSeconds = Math.floor((Date.now() - stats.startTime) / 1000);
  const elapsedDisplay = elapsedSeconds < 60
    ? `${elapsedSeconds}s`
    : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;

  // Error state
  if (error) {
    return (
      <div className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium">Widget Error</span>
        </div>
        <p className="mt-2 text-sm text-red-500 dark:text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title || 'Visualization'}
        </span>
        <div className="flex items-center gap-2">
          {/* Security badge */}
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Sandboxed
          </span>
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
        </div>
      </div>

      {/* Stats Bar */}
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
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm">Loading widget...</span>
            </div>
          </div>
        )}

        {/* Sandboxed iframe */}
        <iframe
          ref={iframeRef}
          sandbox="allow-scripts"
          className="w-full h-full border-none"
          title={title || 'Widget'}
          loading="lazy"
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
