import { useState, useEffect } from "react";

export default function WidgetLoading({ toolName }) {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState("");
  const [messageIndex, setMessageIndex] = useState(0);

  const messages = [
    "Designing the visualization…",
    "Writing interactive code…",
    "Adding chart elements…",
    "Polishing the details…",
    "Almost there…",
  ];

  // Animate progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev; // Cap at 90% until actually done
        return prev + Math.random() * 8 + 2;
      });
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Cycle loading messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % messages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? "" : prev + ".");
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-2xl my-4">
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-muted px-4 py-2.5 border-b border-border flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary/40 animate-pulse" />
            <div className="w-2.5 h-2.5 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: "0.2s" }} />
            <div className="w-2.5 h-2.5 rounded-full bg-primary/20 animate-pulse" style={{ animationDelay: "0.4s" }} />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
            Building Visualization
          </span>
        </div>

        {/* Loading Content */}
        <div className="p-6 space-y-5">
          {/* Skeleton chart area */}
          <div className="relative">
            <div className="flex items-end gap-2 h-32">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-muted rounded-t animate-pulse"
                  style={{
                    height: `${30 + Math.random() * 70}%`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: "1.5s",
                  }}
                />
              ))}
            </div>
            <div className="h-px bg-border mt-1" />
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">
                {messages[messageIndex]}{dots}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {Math.min(Math.round(progress), 90)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(progress, 90)}%` }}
              />
            </div>
          </div>

          {/* Skeleton controls */}
          <div className="flex gap-3">
            <div className="h-8 bg-muted rounded-md flex-1 animate-pulse" style={{ animationDelay: "0.1s" }} />
            <div className="h-8 bg-muted rounded-md flex-1 animate-pulse" style={{ animationDelay: "0.3s" }} />
            <div className="h-8 bg-muted rounded-md w-20 animate-pulse" style={{ animationDelay: "0.5s" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
