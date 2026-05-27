const REDACTED_KEYS = new Set(['apiKey', 'audio', 'token']);

function redactString(value) {
  return String(value)
    .replace(/([?&](?:api-key|token|access_token)=)[^&\s]+/gi, '$1[redacted]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]');
}

function redact(value) {
  if (typeof value === 'string') return redactString(value);
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (REDACTED_KEYS.has(key)) return [key, '[redacted]'];
      if (typeof entryValue === 'string') return [key, redactString(entryValue)];
      if (entryValue && typeof entryValue === 'object') return [key, redact(entryValue)];
      return [key, entryValue];
    }),
  );
}

export function traceRealtime({
  stage,
  success = true,
  payload = null,
  error = null,
  duration = null,
}) {
  console.log({
    ts: new Date().toISOString(),
    stage,
    success,
    duration,
    error,
    payload: redact(payload),
  });
}

export default traceRealtime;
