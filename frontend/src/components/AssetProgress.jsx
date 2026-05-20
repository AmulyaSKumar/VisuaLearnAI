/**
 * Asset Progress Component
 * Shows the progress of asset generation (widgets, images, fact-checks)
 */
export default function AssetProgress({ isStreaming, progress, assets, error }) {
  if (!isStreaming && !progress && !error) return null;

  const { widgets = [], images = [], factCheck } = assets || {};
  const totalAssets = widgets.length + images.length + (factCheck ? 1 : 0);

  return (
    <div className="w-full max-w-2xl mx-auto mb-4">
      <div className="bg-muted/30 rounded-xl border border-border/50 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isStreaming ? (
              <svg className="w-5 h-5 text-primary animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-sm font-medium text-foreground">
              {isStreaming ? 'Generating assets...' : 'Assets ready'}
            </span>
          </div>

          <span className="text-xs text-muted-foreground">
            {totalAssets} asset{totalAssets !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Progress Message */}
        {progress && (
          <p className="text-sm text-muted-foreground mb-3">{progress}</p>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-2 bg-red-500/10 text-red-500 rounded-lg text-sm mb-3">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Asset Counts */}
        <div className="flex flex-wrap gap-3">
          {/* Widgets */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-500/10 text-neutral-600 text-xs font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
          </div>

          {/* Images */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-500/10 text-neutral-600 text-xs font-medium">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {images.length} image{images.length !== 1 ? 's' : ''}
          </div>

          {/* Fact Check */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            factCheck
              ? 'bg-green-500/10 text-green-600'
              : 'bg-muted/50 text-muted-foreground'
          }`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            {factCheck ? 'Verified' : 'Verifying...'}
          </div>
        </div>
      </div>
    </div>
  );
}
