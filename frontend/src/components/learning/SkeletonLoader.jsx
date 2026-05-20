// Skeleton components for loading states

function SkeletonPulse({ className = '' }) {
  return (
    <div className={`animate-pulse bg-muted/50 rounded ${className}`} />
  );
}

export function LearnSkeleton() {
  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[500px] border border-border rounded-lg overflow-hidden bg-card">
      {/* Sidebar Skeleton */}
      <div className="w-72 border-r border-border bg-muted/30 flex flex-col">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-border">
          <SkeletonPulse className="h-4 w-20 mb-1" />
          <SkeletonPulse className="h-3 w-16" />
        </div>

        {/* Progress */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <SkeletonPulse className="h-3 w-14" />
            <SkeletonPulse className="h-3 w-8" />
          </div>
          <SkeletonPulse className="h-1 w-full rounded-full" />
        </div>

        {/* Concept List */}
        <div className="flex-1 overflow-hidden p-2 space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-3 rounded-lg">
              <div className="flex items-start gap-2">
                <SkeletonPulse className="w-5 h-5 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonPulse className="h-4 w-full" />
                  <SkeletonPulse className="h-3 w-3/4" />
                  <div className="flex items-center gap-2">
                    <SkeletonPulse className="h-4 w-16 rounded" />
                    <SkeletonPulse className="h-3 w-10" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="flex-1 p-6 space-y-6">
        {/* Overview Banner */}
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <SkeletonPulse className="h-4 w-24 mb-2" />
          <SkeletonPulse className="h-3 w-full mb-1" />
          <SkeletonPulse className="h-3 w-5/6" />
        </div>

        {/* Header */}
        <div className="border-b border-border pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <SkeletonPulse className="h-6 w-48" />
              <SkeletonPulse className="h-4 w-64" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonPulse className="h-6 w-20 rounded" />
              <SkeletonPulse className="h-6 w-16 rounded" />
            </div>
          </div>
        </div>

        {/* Content Blocks */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-border/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <SkeletonPulse className="h-5 w-5 rounded" />
                <SkeletonPulse className="h-3 w-20" />
              </div>
              <SkeletonPulse className="h-4 w-full mb-2" />
              <SkeletonPulse className="h-4 w-full mb-2" />
              <SkeletonPulse className="h-4 w-3/4" />
            </div>
          ))}
        </div>

        {/* Mark Complete Button */}
        <div className="pt-4 border-t border-border">
          <SkeletonPulse className="h-10 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function FlashcardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <SkeletonPulse className="flex-1 h-2 rounded-full" />
        <SkeletonPulse className="h-4 w-16" />
      </div>

      {/* Mastery Progress */}
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <SkeletonPulse className="h-4 w-28" />
          <SkeletonPulse className="h-4 w-10" />
        </div>
        <SkeletonPulse className="h-1.5 w-full rounded-full" />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-4">
        <SkeletonPulse className="h-4 w-20" />
        <SkeletonPulse className="h-4 w-20" />
      </div>

      {/* Card */}
      <div className="h-64 border border-border rounded-2xl p-6 flex flex-col items-center justify-center">
        <SkeletonPulse className="h-6 w-3/4 mb-4" />
        <SkeletonPulse className="h-4 w-32" />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <SkeletonPulse className="w-11 h-11 rounded-lg" />
        <div className="flex gap-2">
          <SkeletonPulse className="w-28 h-11 rounded-lg" />
          <SkeletonPulse className="w-24 h-11 rounded-lg" />
        </div>
        <SkeletonPulse className="w-11 h-11 rounded-lg" />
      </div>
    </div>
  );
}

export function QuizSkeleton() {
  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <SkeletonPulse className="flex-1 h-2 rounded-full" />
        <SkeletonPulse className="h-4 w-28" />
      </div>

      {/* Question */}
      <div className="bg-muted/30 rounded-xl p-6">
        <SkeletonPulse className="h-6 w-full mb-2" />
        <SkeletonPulse className="h-6 w-3/4" />
      </div>

      {/* Options */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl border-2 border-border">
            <div className="flex items-center gap-3">
              <SkeletonPulse className="w-8 h-8 rounded-full flex-shrink-0" />
              <SkeletonPulse className="h-5 flex-1" />
            </div>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <div className="flex justify-end">
        <SkeletonPulse className="w-32 h-10 rounded-lg" />
      </div>
    </div>
  );
}

export function MindMapSkeleton() {
  return (
    <div className="space-y-4">
      {/* Info */}
      <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-2">
        <SkeletonPulse className="w-4 h-4 rounded" />
        <SkeletonPulse className="h-4 flex-1" />
      </div>

      {/* Mind Map Container */}
      <div className="h-[500px] border border-border rounded-xl overflow-hidden bg-background p-8">
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Central Node */}
          <SkeletonPulse className="w-24 h-24 rounded-full absolute" />

          {/* Branch Lines and Nodes */}
          {[0, 1, 2, 3].map((i) => {
            const angle = (i * 90 - 45) * (Math.PI / 180);
            const x = Math.cos(angle) * 150;
            const y = Math.sin(angle) * 150;
            return (
              <div
                key={i}
                className="absolute"
                style={{
                  transform: `translate(${x}px, ${y}px)`
                }}
              >
                <SkeletonPulse className="w-20 h-12 rounded-lg" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <SkeletonPulse className="w-4 h-4 rounded-full" />
          <SkeletonPulse className="w-16 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonPulse className="w-4 h-4 rounded" />
          <SkeletonPulse className="w-16 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <SkeletonPulse className="w-4 h-4 rounded" />
          <SkeletonPulse className="w-16 h-4" />
        </div>
      </div>
    </div>
  );
}

export function ExamplesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Game CTA Skeleton */}
      <div className="bg-gradient-to-r from-neutral-500/5 to-neutral-500/5 border border-neutral-500/10 rounded-xl p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SkeletonPulse className="w-8 h-8 rounded" />
            <div className="space-y-1">
              <SkeletonPulse className="h-5 w-32" />
              <SkeletonPulse className="h-4 w-48" />
            </div>
          </div>
          <SkeletonPulse className="w-24 h-10 rounded-lg" />
        </div>
      </div>

      {/* Example Cards Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <SkeletonPulse className="w-10 h-10 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <SkeletonPulse className="h-5 w-48" />
                <SkeletonPulse className="h-4 w-full" />
                <SkeletonPulse className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default {
  LearnSkeleton,
  FlashcardSkeleton,
  QuizSkeleton,
  MindMapSkeleton,
  ExamplesSkeleton
};
