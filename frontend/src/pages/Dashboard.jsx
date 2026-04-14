import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

/**
 * Dashboard - Learning Analytics Page
 * Shows engagement, improvement, satisfaction scores and topic progress
 */
export default function Dashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch metrics and profile in parallel
        const [metricsRes, profileRes] = await Promise.all([
          fetch(`http://localhost:3001/api/user/${user.id}/metrics`),
          fetch(`http://localhost:3001/api/user/${user.id}`),
        ]);

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        }

        if (profileRes.ok) {
          const profileData = await profileRes.json();
          setProfile(profileData);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to view your dashboard</p>
          <Link to="/" className="text-primary hover:underline">Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors min-h-[44px] px-2 -ml-2">
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium hidden sm:inline">Back to Chat</span>
          </Link>
          <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">Learning Dashboard</h1>
          <div className="w-10 sm:w-24 flex-shrink-0" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
              </svg>
              <span className="text-muted-foreground">Loading your analytics...</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Score Cards */}
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Your Learning Metrics
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ScoreCard
                  title="Engagement"
                  score={metrics?.engagement?.score || 0}
                  description="How actively you're learning"
                  details={[
                    { label: "Sessions", value: metrics?.engagement?.sessionsCount || 0 },
                    { label: "Interactions", value: metrics?.engagement?.totalInteractions || 0 },
                  ]}
                />
                <ScoreCard
                  title="Improvement"
                  score={metrics?.improvement?.score || 0}
                  description="Your learning progress"
                  trend={metrics?.improvement?.followUpTrend}
                  details={[
                    { label: "Trend", value: metrics?.improvement?.followUpTrend || "stable" },
                  ]}
                />
                <ScoreCard
                  title="Satisfaction"
                  score={metrics?.satisfaction?.score || 0}
                  description="How helpful the content is"
                  details={[
                    { label: "Thumbs Up", value: metrics?.satisfaction?.thumbsUp || 0 },
                    { label: "Thumbs Down", value: metrics?.satisfaction?.thumbsDown || 0 },
                  ]}
                />
              </div>
            </section>

            {/* Overall Score */}
            <section className="bg-card border border-border rounded-xl p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-foreground">Overall Learning Score</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    Combined assessment of your learning journey
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-3xl sm:text-4xl font-bold text-primary">
                    {metrics?.overall?.score || 0}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground capitalize">
                    {metrics?.overall?.rating || "building data"}
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-4 h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full transition-all duration-500"
                  style={{ width: `${metrics?.overall?.score || 0}%` }}
                />
              </div>
            </section>

            {/* Learning Style & Topics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Learning Style */}
              <section className="bg-card border border-border rounded-xl p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Your Learning Style
                </h2>
                <LearningStyleChart styles={profile?.detected_styles} />
              </section>

              {/* Topics */}
              <section className="bg-card border border-border rounded-xl p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Topic Progress
                </h2>
                <TopicLists
                  weakTopics={profile?.weak_topics || []}
                  strongTopics={profile?.strong_topics || []}
                />
              </section>
            </div>

            {/* Recent Activity */}
            <section className="bg-card border border-border rounded-xl p-4 sm:p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 sm:mb-4">
                Quick Stats
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                <StatItem
                  label="Total Time"
                  value={formatTime(metrics?.engagement?.totalTimeSpent || 0)}
                />
                <StatItem
                  label="Avg Session"
                  value={formatTime(metrics?.engagement?.avgTimePerSession || 0)}
                />
                <StatItem
                  label="Knowledge Level"
                  value={profile?.comprehension_level || "intermediate"}
                />
                <StatItem
                  label="Confidence"
                  value={`${Math.round((profile?.confidence_score || 0.5) * 100)}%`}
                />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

// Score Card Component
function ScoreCard({ title, score, description, trend, details = [] }) {
  const getScoreColor = (s) => {
    if (s >= 70) return "text-green-500";
    if (s >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getTrendIcon = (t) => {
    if (t === "improving") return "↑";
    if (t === "declining") return "↓";
    return "→";
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-5">
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div>
          <h3 className="text-xs sm:text-sm font-medium text-foreground">{title}</h3>
        </div>
        <div className="text-right">
          <p className={`text-xl sm:text-2xl font-bold ${getScoreColor(score)}`}>{score}</p>
          {trend && (
            <span className={`text-xs ${trend === "improving" ? "text-green-500" : trend === "declining" ? "text-red-500" : "text-muted-foreground"}`}>
              {getTrendIcon(trend)} {trend}
            </span>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      {/* Details */}
      {details.length > 0 && (
        <div className="flex gap-4 text-xs">
          {details.map((d, i) => (
            <div key={i}>
              <span className="text-muted-foreground">{d.label}: </span>
              <span className="font-medium text-foreground">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Learning Style Chart
function LearningStyleChart({ styles = {} }) {
  const defaultStyles = {
    visual: 0.25,
    auditory: 0.25,
    reading: 0.25,
    kinesthetic: 0.25,
    ...styles,
  };

  const styleConfig = {
    visual: { label: "Visual", color: "bg-blue-500" },
    auditory: { label: "Auditory", color: "bg-purple-500" },
    reading: { label: "Reading", color: "bg-green-500" },
    kinesthetic: { label: "Hands-on", color: "bg-orange-500" },
  };

  const sorted = Object.entries(defaultStyles).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-3">
      {sorted.map(([style, score]) => {
        const config = styleConfig[style] || { label: style, icon: "📊", color: "bg-gray-500" };
        const percent = Math.round(score * 100);

        return (
          <div key={style}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-foreground">{config.label}</span>
              <span className="text-sm font-medium text-foreground">{percent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${config.color} rounded-full transition-all duration-500`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Topic Lists
function TopicLists({ weakTopics = [], strongTopics = [] }) {
  return (
    <div className="space-y-4">
      {/* Strong Topics */}
      <div>
        <h4 className="text-xs font-medium text-green-600 mb-2">
          Strong Topics
        </h4>
        {strongTopics.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {strongTopics.map((topic, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-medium"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No strong topics yet</p>
        )}
      </div>

      {/* Weak Topics */}
      <div>
        <h4 className="text-xs font-medium text-orange-600 mb-2">
          Needs Work
        </h4>
        {weakTopics.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {weakTopics.map((topic, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium"
              >
                {topic}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No weak topics identified</p>
        )}
      </div>
    </div>
  );
}

// Stat Item
function StatItem({ label, value }) {
  return (
    <div className="text-center p-2 sm:p-3 bg-muted/30 rounded-lg">
      <p className="text-sm sm:text-lg font-semibold text-foreground capitalize truncate">{value}</p>
      <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

// Helper function
function formatTime(ms) {
  if (!ms) return "0m";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}
