import useVideoGeneration from "../../hooks/useVideoGeneration";

const STATUS_LABELS = {
  queued: "Queued",
  running: "Generating",
  done: "Ready",
  failed: "Failed",
};

export default function VideoGenerationView({
  topic,
  accessToken,
  video = null,
  autoStart = false,
  options = {},
}) {
  const {
    job,
    jobId,
    status,
    error,
    progress,
    videoUrl,
    isCreating,
    isRunning,
    start,
  } = useVideoGeneration({
    topic,
    accessToken,
    initialVideo: video,
    autoStart,
    options,
  });

  const currentStatus = status || (isCreating ? "queued" : null);
  const title = job?.topic || topic || "Educational video";

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Video Generation</p>
          <h3 className="truncate text-base font-semibold text-foreground">{title}</h3>
          {jobId && <p className="mt-1 truncate text-xs text-muted-foreground">Job: {jobId}</p>}
        </div>

        {!jobId && !isCreating && (
          <button
            type="button"
            onClick={() => start()}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background transition hover:bg-foreground/90"
          >
            Generate video
          </button>
        )}
      </div>

      <div className="space-y-4 p-4">
        {(isCreating || isRunning || currentStatus) && currentStatus !== "done" && (
          <div className="rounded-lg border border-border bg-background/60 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                {STATUS_LABELS[currentStatus] || "Preparing"}
              </span>
              <span className="text-xs text-muted-foreground">{Math.round(progress || 0)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all duration-700"
                style={{ width: `${Math.max(6, Math.min(100, progress || 6))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Video generation can take a few minutes. This panel will update automatically.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {videoUrl && (
          <video
            key={videoUrl}
            controls
            playsInline
            className="aspect-video w-full rounded-lg bg-black"
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        )}
      </div>
    </div>
  );
}
