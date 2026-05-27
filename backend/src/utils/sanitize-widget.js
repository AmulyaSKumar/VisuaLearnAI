const BLOCKED_PATTERNS = [
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /\bimport\s+/i,
  /\brequire\s*\(/i,
  /\beval\s*\(/i,
  /\bnew\s+Function\b/i,
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\bWebSocket\b/i,
  /\blocalStorage\b/i,
  /\bsessionStorage\b/i,
  /\bdocument\.cookie\b/i,
];

export function sanitizeWidgetCode(code) {
  const text = String(code || '');
  const violations = BLOCKED_PATTERNS
    .filter(pattern => pattern.test(text))
    .map(pattern => pattern.source);

  return {
    safe: violations.length === 0,
    violations,
    warnings: [],
    code: text,
  };
}

export function generateSafeFallback(title = 'Visualization', violations = []) {
  const safeTitle = String(title || 'Visualization').replace(/[<>]/g, '');
  const reason = violations.length ? 'The generated widget used unsupported browser capabilities.' : 'The generated widget could not be displayed safely.';
  return `<div style="padding:20px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-card);color:var(--color-foreground);">
  <h3 style="margin:0 0 8px;color:var(--color-primary);font-size:16px;">${safeTitle}</h3>
  <p style="margin:0;color:var(--color-muted-foreground);font-size:14px;">${reason}</p>
</div>`;
}
