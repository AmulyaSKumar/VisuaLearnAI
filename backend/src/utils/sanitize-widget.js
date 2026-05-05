/**
 * Widget Code Sanitization Utility
 * Validates and sanitizes AI-generated widget code for security
 * @module utils/sanitize-widget
 */

import { logger } from './logger.js';

/**
 * Dangerous patterns that should be blocked in widget code
 * These patterns could be used for XSS, data exfiltration, or escaping sandbox
 *
 * NOTE: We're careful not to block legitimate library code patterns.
 * Libraries like Chart.js and Three.js may internally use some patterns
 * that look dangerous but are safe in context.
 */
const DANGEROUS_PATTERNS = [
  // Direct eval with user-controllable input
  { pattern: /eval\s*\(\s*[^)]*\+/gi, name: 'eval() with concatenation' },
  { pattern: /eval\s*\(\s*\$/gi, name: 'eval() with variable' },
  // Function constructor with string building (injection risk)
  { pattern: /new\s+Function\s*\(\s*[^)]*\+/gi, name: 'new Function() with concatenation' },
  { pattern: /Function\s*\(\s*[^)]*\+/gi, name: 'Function() with concatenation' },
  // Cookie/storage access (data theft)
  { pattern: /document\.cookie/gi, name: 'document.cookie access' },
  { pattern: /localStorage\s*\.\s*(get|set|remove)/gi, name: 'localStorage access' },
  { pattern: /sessionStorage\s*\.\s*(get|set|remove)/gi, name: 'sessionStorage access' },
  // Parent frame access (sandbox escape)
  { pattern: /window\.parent\s*\./gi, name: 'window.parent access' },
  { pattern: /window\.top\s*\./gi, name: 'window.top access' },
  { pattern: /parent\.postMessage/gi, name: 'parent.postMessage (unsafe)' },
  { pattern: /top\.postMessage/gi, name: 'top.postMessage (unsafe)' },
  { pattern: /parent\s*\[\s*["']/gi, name: 'parent bracket access' },
  // Script injection
  { pattern: /document\.write\s*\(/gi, name: 'document.write()' },
  { pattern: /document\.writeln\s*\(/gi, name: 'document.writeln()' },
  // String-based timers (code injection)
  { pattern: /setInterval\s*\(\s*["'`][^"'`]*["'`]\s*,/gi, name: 'setInterval with string code' },
  { pattern: /setTimeout\s*\(\s*["'`][^"'`]*["'`]\s*,/gi, name: 'setTimeout with string code' },
];

/**
 * Patterns that indicate potential data exfiltration attempts
 * NOTE: We allow CDN fetches for libraries, only block suspicious patterns
 */
const EXFILTRATION_PATTERNS = [
  // WebSocket to unknown hosts (real-time data exfil)
  { pattern: /new\s+WebSocket\s*\(\s*[^)]*(?!wss?:\/\/localhost)/gi, name: 'WebSocket to external host' },
  // Beacon API (fire-and-forget data sending)
  { pattern: /navigator\.sendBeacon/gi, name: 'navigator.sendBeacon' },
];

/**
 * Allowed CDN domains for external resources
 */
const ALLOWED_CDNS = [
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'd3js.org',
  'cdn.plot.ly',
];

/**
 * Check if a URL is from an allowed CDN
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is from allowed CDN
 */
function isAllowedCDN(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_CDNS.some(cdn => parsed.hostname === cdn || parsed.hostname.endsWith('.' + cdn));
  } catch {
    return false;
  }
}

/**
 * Extract all URLs from widget code
 * @param {string} code - Widget code
 * @returns {string[]} Array of URLs found
 */
function extractURLs(code) {
  const urlPattern = /https?:\/\/[^\s"'`<>)]+/gi;
  return code.match(urlPattern) || [];
}

/**
 * Sanitize widget code by detecting and blocking dangerous patterns
 * @param {string} code - Raw widget code from AI
 * @param {Object} options - Sanitization options
 * @param {boolean} options.strict - Enable strict mode (blocks more patterns)
 * @param {boolean} options.allowFetch - Allow fetch to CDNs (default: true for 3D)
 * @returns {Object} { safe: boolean, code: string, violations: string[], warnings: string[] }
 */
export function sanitizeWidgetCode(code, options = {}) {
  const { strict = false, allowFetch = true } = options;
  const violations = [];
  const warnings = [];

  if (!code || typeof code !== 'string') {
    return { safe: false, code: '', violations: ['Invalid code input'], warnings: [] };
  }

  // Check for dangerous patterns
  for (const { pattern, name } of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      violations.push(`Blocked: ${name}`);
    }
  }

  // Check for exfiltration patterns
  for (const { pattern, name } of EXFILTRATION_PATTERNS) {
    if (pattern.test(code)) {
      if (name === 'fetch() to non-CDN' && allowFetch) {
        warnings.push(`Warning: ${name} detected - verify URLs are safe`);
      } else {
        violations.push(`Blocked: ${name}`);
      }
    }
  }

  // Validate external URLs
  const urls = extractURLs(code);
  for (const url of urls) {
    // Skip data URLs and blob URLs
    if (url.startsWith('data:') || url.startsWith('blob:')) continue;

    if (!isAllowedCDN(url)) {
      // Only warn, don't block - some legitimate CDNs might not be in our list
      warnings.push(`External URL: ${url}`);
    }
  }

  // In strict mode, block any script that tries to access window properties
  if (strict) {
    const windowAccessPattern = /window\.\w+/gi;
    const matches = code.match(windowAccessPattern) || [];
    const allowedWindowProps = ['window.innerWidth', 'window.innerHeight', 'window.devicePixelRatio',
                                 'window.requestAnimationFrame', 'window.cancelAnimationFrame',
                                 'window.addEventListener', 'window.removeEventListener',
                                 'window.ResizeObserver', 'window.IntersectionObserver'];

    for (const match of matches) {
      if (!allowedWindowProps.some(allowed => match.toLowerCase() === allowed.toLowerCase())) {
        warnings.push(`Window access: ${match}`);
      }
    }
  }

  const safe = violations.length === 0;

  if (!safe) {
    logger.warn('Widget code sanitization failed', { violations, warnings });
  } else if (warnings.length > 0) {
    logger.debug('Widget code sanitization warnings', { warnings });
  }

  return {
    safe,
    code: safe ? code : '',
    violations,
    warnings,
  };
}

/**
 * Generate a safe fallback widget when sanitization fails
 * @param {string} title - Widget title
 * @param {string[]} violations - List of violations detected
 * @returns {string} Safe fallback HTML
 */
export function generateSafeFallback(title, violations = []) {
  const violationList = violations.map(v => `<li>${escapeHtml(v)}</li>`).join('');

  return `
<div style="padding: 24px; text-align: center; background: var(--color-card); border-radius: 12px; border: 1px solid var(--color-border);">
  <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
  <h3 style="margin: 0 0 8px 0; color: var(--color-foreground); font-size: 16px;">
    Visualization Unavailable
  </h3>
  <p style="margin: 0 0 16px 0; color: var(--color-muted-foreground); font-size: 14px;">
    This visualization couldn't be displayed safely.
  </p>
  ${violations.length > 0 ? `
  <details style="text-align: left; margin-top: 16px;">
    <summary style="cursor: pointer; color: var(--color-muted-foreground); font-size: 12px;">Technical details</summary>
    <ul style="margin: 8px 0 0 0; padding-left: 20px; color: var(--color-muted-foreground); font-size: 11px;">
      ${violationList}
    </ul>
  </details>
  ` : ''}
</div>`;
}

/**
 * Escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, char => escapeMap[char]);
}

/**
 * Validate 3D widget code has required safety features
 * @param {string} code - Widget code
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export function validate3DWidgetSafety(code) {
  const missing = [];

  // Check for WebGL error handling
  if (code.includes('THREE.') && !code.includes('getContext')) {
    missing.push('WebGL context check');
  }

  // Check for try-catch around renderer creation
  if (code.includes('WebGLRenderer') && !code.includes('try')) {
    missing.push('Error handling for WebGLRenderer');
  }

  // Check for cleanup function
  if (code.includes('THREE.') && !code.includes('dispose')) {
    missing.push('Resource cleanup (dispose)');
  }

  // Check for animation loop control
  if (code.includes('requestAnimationFrame') && !code.includes('cancelAnimationFrame')) {
    missing.push('Animation cleanup (cancelAnimationFrame)');
  }

  // Check for resize handling
  if (code.includes('WebGLRenderer') && !code.includes("window.addEventListener('resize'")) {
    missing.push('Resize handling');
  }

  // Check for at least one initial render
  if (code.includes('WebGLRenderer') && !code.includes('renderer.render(scene, camera)')) {
    missing.push('Initial render call');
  }

  // Check for animation bootstrap or explicit controls-driven rendering
  const hasAnimationBootstrap = code.includes('animate();') || code.includes('tick();');
  const hasControlsReRender = code.includes("controls.addEventListener('change'") || code.includes('controls.addEventListener("change"');
  if (!hasAnimationBootstrap && !hasControlsReRender) {
    missing.push('Animation bootstrap or controls render hook');
  }

  // Check for minimum visible geometry density
  const visibleGeometryCount = (code.match(/new\s+THREE\.(Mesh|Line|Points)\s*\(/g) || []).length;
  if (visibleGeometryCount < 3) {
    missing.push('Minimum visible geometry (3 meshes)');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Inject WebGL detection and error handling wrapper into 3D widget code
 * @param {string} code - Original widget code
 * @returns {string} Code with safety wrapper
 */
export function inject3DSafetyWrapper(code) {
  const webglCheck = `
(function() {
  var canvas = document.createElement('canvas');
  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    var container = document.getElementById('container') || document.body;
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--color-muted-foreground);"><p style="font-size:48px;margin-bottom:16px;">⚠️</p><p style="font-size:14px;margin:0;">3D visualization not supported</p><p style="font-size:12px;margin-top:8px;opacity:0.7;">Your browser does not support WebGL.</p></div>';
    return;
  }
})();
`;

  // Insert WebGL check at the start of the first script block
  const scriptStartIndex = code.indexOf('<script>');
  if (scriptStartIndex === -1) {
    return code;
  }

  const insertIndex = scriptStartIndex + '<script>'.length;
  return code.slice(0, insertIndex) + webglCheck + code.slice(insertIndex);
}

export default {
  sanitizeWidgetCode,
  generateSafeFallback,
  validate3DWidgetSafety,
  inject3DSafetyWrapper,
};
