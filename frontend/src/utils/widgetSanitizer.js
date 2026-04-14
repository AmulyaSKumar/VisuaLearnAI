/**
 * Widget Sanitizer
 * Sanitizes HTML widget code to prevent XSS attacks
 * Uses DOMPurify with strict configuration
 * @module utils/widgetSanitizer
 */

import DOMPurify from 'dompurify';

/**
 * Allowed CDN origins for external scripts
 */
const ALLOWED_SCRIPT_ORIGINS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'esm.sh',
];

/**
 * Maximum allowed widget code length
 */
const MAX_WIDGET_LENGTH = 50000;

/**
 * DOMPurify configuration for widget sanitization
 * Allows most HTML tags including SVG, but blocks dangerous elements
 */
const SANITIZE_CONFIG = {
  // Standard HTML tags - tightened for security
  ALLOWED_TAGS: [
    // Text content
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'div', 'br', 'hr',
    'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup', 'mark',
    'code', 'pre', 'blockquote', 'cite', 'q', 'abbr', 'time',
    // Lists
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    // Media (img allowed, audio/video removed for security)
    'img', 'figure', 'figcaption', 'picture', 'source',
    // Interactive (limited)
    'button', 'details', 'summary',
    // Canvas
    'canvas',
    // SVG elements
    'svg', 'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse',
    'text', 'tspan', 'textPath', 'g', 'defs', 'marker', 'use', 'symbol',
    'clipPath', 'mask', 'pattern', 'linearGradient', 'radialGradient', 'stop',
    'foreignObject', 'switch', 'desc', 'title', 'metadata',
    // Layout
    'a', 'label', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
    // Style only - scripts handled separately with CDN allowlist
    'style',
  ],

  // Standard attributes plus SVG-specific ones
  ALLOWED_ATTR: [
    // Global attributes
    'id', 'class', 'style', 'title', 'lang', 'dir', 'hidden', 'tabindex',
    'role', 'aria-*', 'data-*',
    // Link attributes
    'href', 'target', 'rel', 'download',
    // Media attributes
    'src', 'alt', 'width', 'height', 'loading', 'decoding',
    'autoplay', 'controls', 'loop', 'muted', 'poster', 'preload',
    // Table attributes
    'colspan', 'rowspan', 'scope', 'headers',
    // SVG attributes
    'viewBox', 'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'points', 'transform', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity',
    'fill', 'fill-opacity', 'fill-rule', 'opacity', 'marker-end', 'marker-start', 'marker-mid',
    'text-anchor', 'dominant-baseline', 'font-size', 'font-family', 'font-weight',
    'dx', 'dy', 'rotate', 'textLength', 'lengthAdjust',
    'preserveAspectRatio', 'xmlns', 'xmlns:xlink', 'xlink:href',
    'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform',
    'patternUnits', 'patternContentUnits', 'patternTransform',
    'clipPathUnits', 'maskUnits', 'maskContentUnits',
    // Canvas
    'getContext',
    // Other
    'type', 'value', 'name', 'disabled', 'checked', 'selected', 'readonly',
    'placeholder', 'min', 'max', 'step', 'pattern', 'required', 'multiple',
    'charset', 'http-equiv', 'content',
  ],

  // Forbid dangerous tags - extended list for security
  FORBID_TAGS: [
    'script', 'object', 'embed', 'form', 'input', 'base', 'iframe', 'frame', 'frameset',
    'meta', 'link', 'html', 'head', 'body', 'applet', 'noscript', 'plaintext',
    'audio', 'video', 'track', 'dialog', 'menu', 'menuitem', 'template', 'slot',
  ],

  // Forbid event handlers
  FORBID_ATTR: [
    'onerror', 'onload', 'onclick', 'ondblclick', 'onmousedown', 'onmouseup',
    'onmouseover', 'onmouseout', 'onmousemove', 'onmouseenter', 'onmouseleave',
    'onkeydown', 'onkeyup', 'onkeypress', 'onfocus', 'onblur', 'onchange',
    'onsubmit', 'onreset', 'onselect', 'oninput', 'oninvalid',
    'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover', 'ondragstart', 'ondrop',
    'oncopy', 'oncut', 'onpaste', 'onwheel', 'onscroll', 'ontouchstart', 'ontouchmove', 'ontouchend',
    'onanimationstart', 'onanimationend', 'onanimationiteration',
    'ontransitionend', 'onresize', 'onerror', 'onabort',
  ],

  // Allow data URIs for images only
  ALLOW_DATA_ATTR: true,
  ADD_DATA_URI_TAGS: ['img'],

  // Keep the content of style and script tags
  FORCE_BODY: false,
  WHOLE_DOCUMENT: false,

  // Custom element handling
  CUSTOM_ELEMENT_HANDLING: {
    tagNameCheck: null,
    attributeNameCheck: null,
    allowCustomizedBuiltInElements: false,
  },
};

/**
 * Check if a script src is from an allowed CDN
 * @param {string} src - Script source URL
 * @returns {boolean} True if allowed
 */
function isAllowedScriptSrc(src) {
  if (!src) return true; // Inline scripts are OK

  try {
    const url = new URL(src);
    return ALLOWED_SCRIPT_ORIGINS.some(origin => url.hostname.endsWith(origin));
  } catch {
    return false;
  }
}

/**
 * Strip disallowed script tags from HTML
 * @param {string} html - HTML string
 * @returns {string} HTML with disallowed scripts removed
 */
function stripDisallowedScripts(html) {
  // Match script tags with src attribute
  const scriptRegex = /<script[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi;

  return html.replace(scriptRegex, (match, src) => {
    if (isAllowedScriptSrc(src)) {
      return match; // Keep allowed CDN scripts
    }
    console.warn(`Blocked disallowed script source: ${src}`);
    return '<!-- blocked external script -->';
  });
}

/**
 * Strip javascript: URLs from href and src attributes
 * @param {string} html - HTML string
 * @returns {string} HTML with javascript: URLs removed
 */
function stripJavascriptUrls(html) {
  // Match href="javascript:..." or src="javascript:..."
  const jsUrlRegex = /\s(href|src)\s*=\s*["']javascript:[^"']*["']/gi;

  return html.replace(jsUrlRegex, (match, attr) => {
    console.warn(`Blocked javascript: URL in ${attr}`);
    return ` ${attr}="#"`;
  });
}

/**
 * Sanitize widget HTML code
 * @param {string} htmlString - Raw widget HTML code
 * @returns {string} Sanitized HTML safe for rendering
 * @throws {Error} If widget exceeds max length
 */
export function sanitizeWidget(htmlString) {
  if (!htmlString || typeof htmlString !== 'string') {
    return '';
  }

  // Check length limit
  if (htmlString.length > MAX_WIDGET_LENGTH) {
    throw new Error(`Widget code exceeds maximum length of ${MAX_WIDGET_LENGTH} characters`);
  }

  // Step 1: Strip disallowed external scripts
  let sanitized = stripDisallowedScripts(htmlString);

  // Step 2: Strip javascript: URLs
  sanitized = stripJavascriptUrls(sanitized);

  // Step 3: Run through DOMPurify
  // Scripts from allowed CDNs are kept via stripDisallowedScripts,
  // but DOMPurify will remove script tags. For widgets that need scripts,
  // use the WidgetRenderer which handles them in a sandboxed iframe.
  sanitized = DOMPurify.sanitize(sanitized, {
    ...SANITIZE_CONFIG,
    // Keep style tags for widget styling
    ADD_TAGS: ['style'],
    ADD_ATTR: ['type'],
  });

  return sanitized;
}

/**
 * Validate widget code before caching (backend use)
 * @param {string} widgetCode - Widget HTML code
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateWidgetCode(widgetCode) {
  if (!widgetCode || typeof widgetCode !== 'string') {
    return { valid: false, error: 'Widget code must be a non-empty string' };
  }

  if (widgetCode.length > MAX_WIDGET_LENGTH) {
    return { valid: false, error: `Widget code exceeds maximum length of ${MAX_WIDGET_LENGTH} characters` };
  }

  // Check for disallowed script sources
  const scriptSrcRegex = /<script[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi;
  let match;

  while ((match = scriptSrcRegex.exec(widgetCode)) !== null) {
    const src = match[1];
    if (!isAllowedScriptSrc(src)) {
      return { valid: false, error: `Disallowed script source: ${src}` };
    }
  }

  // Check for javascript: URLs
  if (/javascript:/i.test(widgetCode)) {
    return { valid: false, error: 'javascript: URLs are not allowed' };
  }

  return { valid: true };
}

/**
 * Create CSP meta tag for widget iframe
 * @returns {string} CSP meta tag HTML
 */
export function createCSPMetaTag() {
  const csp = [
    "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${ALLOWED_SCRIPT_ORIGINS.map(o => `https://${o}`).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join('; ');

  return `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
}

export default {
  sanitizeWidget,
  validateWidgetCode,
  createCSPMetaTag,
  MAX_WIDGET_LENGTH,
  ALLOWED_SCRIPT_ORIGINS,
};
