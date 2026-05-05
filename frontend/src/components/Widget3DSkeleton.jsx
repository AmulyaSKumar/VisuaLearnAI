/**
 * Skeleton loading placeholder for 3D widget generation
 * Shows while 3D visualization is being generated
 */
export default function Widget3DSkeleton({ topic }) {
  return (
    <div className="w-full bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-pulse">
      {/* Header skeleton */}
      <div className="bg-muted px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-24 bg-border rounded" />
          <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">3D</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-border rounded" />
          <div className="w-6 h-6 bg-border rounded" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="p-4 h-[400px] flex flex-col items-center justify-center gap-4">
        {/* 3D cube animation placeholder */}
        <div className="relative w-24 h-24">
          {/* Rotating cube effect */}
          <div
            className="absolute inset-0 border-2 border-primary/30 rounded-lg"
            style={{
              animation: 'spin3d 3s linear infinite',
              transformStyle: 'preserve-3d',
            }}
          />
          <div
            className="absolute inset-2 border-2 border-primary/20 rounded-lg"
            style={{
              animation: 'spin3d 3s linear infinite reverse',
              animationDelay: '0.5s',
              transformStyle: 'preserve-3d',
            }}
          />
          <div
            className="absolute inset-4 border-2 border-primary/10 rounded-lg"
            style={{
              animation: 'spin3d 3s linear infinite',
              animationDelay: '1s',
              transformStyle: 'preserve-3d',
            }}
          />
        </div>

        {/* Loading text */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Generating 3D visualization</p>
          {topic && (
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs truncate">
              {topic}
            </p>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex gap-1">
          <div
            className="w-2 h-2 rounded-full bg-primary/40"
            style={{ animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0s' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-primary/40"
            style={{ animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0.2s' }}
          />
          <div
            className="w-2 h-2 rounded-full bg-primary/40"
            style={{ animation: 'bounce 1.4s infinite ease-in-out', animationDelay: '0.4s' }}
          />
        </div>
      </div>

      {/* Inline styles for animations */}
      <style>{`
        @keyframes spin3d {
          0% { transform: rotateX(0deg) rotateY(0deg); }
          100% { transform: rotateX(360deg) rotateY(360deg); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
