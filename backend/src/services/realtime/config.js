function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const REALTIME_CONFIG = {
  MAX_SESSION_MINUTES: positiveInt(process.env.REALTIME_MAX_SESSION_MINUTES, 15),
  MAX_CONTEXT_MESSAGES: positiveInt(process.env.REALTIME_MAX_CONTEXT_MESSAGES, 15),
  MAX_REALTIME_TOKENS: positiveInt(process.env.REALTIME_MAX_TOKENS, 4000),
  IDLE_TIMEOUT_SECONDS: positiveInt(process.env.REALTIME_IDLE_TIMEOUT_SECONDS, 300),
  SUMMARY_KEEP_MESSAGES: positiveInt(process.env.REALTIME_SUMMARY_KEEP_MESSAGES, 8),
};

export function estimateRealtimeTokens(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '');
  return Math.ceil(text.length / 4);
}

export default REALTIME_CONFIG;
