/**
 * Markdown rendering utility
 * Parses markdown-like content into rendered HTML
 */

// Inline formatting: bold, italic, code
function inlineFormat(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted text-primary px-1.5 py-0.5 rounded text-[13px] font-mono">$1</code>');
}

/**
 * Convert markdown text to HTML string
 * @param {string} text - Markdown text to render
 * @returns {string} - HTML string
 */
export function renderMarkdown(text) {
  if (!text || typeof text !== 'string') return '';

  const lines = text.split('\n');
  const htmlParts = [];
  let inList = false;
  let listItems = [];

  const flushList = () => {
    if (listItems.length > 0) {
      htmlParts.push(`<ul class="mb-4 pl-4 space-y-1">${listItems.join('')}</ul>`);
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Escape HTML entities
    line = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Headers
    if (line.startsWith('### ')) {
      flushList();
      const heading = inlineFormat(line.slice(4));
      htmlParts.push(`<h4 class="text-sm font-semibold text-foreground mt-5 mb-2">${heading}</h4>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      const heading = inlineFormat(line.slice(3));
      htmlParts.push(`<h3 class="text-base font-semibold text-foreground mt-6 mb-2">${heading}</h3>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      const heading = inlineFormat(line.slice(2));
      htmlParts.push(`<h2 class="text-lg font-bold text-foreground mt-6 mb-3">${heading}</h2>`);
      continue;
    }

    // Bullet lists
    if (line.match(/^[-•*]\s/)) {
      inList = true;
      const item = inlineFormat(line.replace(/^[-•*]\s/, ''));
      listItems.push(`<li class="text-[15px] leading-relaxed text-foreground/90">${item}</li>`);
      continue;
    }

    // Numbered lists
    if (line.match(/^\d+\.\s/)) {
      inList = true;
      const item = inlineFormat(line.replace(/^\d+\.\s/, ''));
      listItems.push(`<li class="text-[15px] leading-relaxed text-foreground/90 list-decimal">${item}</li>`);
      continue;
    }

    // Empty lines
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    htmlParts.push(`<p class="mb-3 text-[15px] leading-relaxed text-foreground/90">${inlineFormat(line)}</p>`);
  }

  flushList();
  return htmlParts.join('');
}

/**
 * Safely render content that might be JSON or markdown
 * @param {any} content - Content to render (string, object, or array)
 * @returns {string} - Human-readable text or HTML
 */
export function safeRenderContent(content) {
  if (!content) return '';

  // If it's a string, check if it looks like JSON
  if (typeof content === 'string') {
    // Check if string looks like JSON
    const trimmed = content.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        // If it parsed successfully, extract readable content
        return extractReadableContent(parsed);
      } catch {
        // Not valid JSON, render as markdown
        return renderMarkdown(content);
      }
    }
    return renderMarkdown(content);
  }

  // If it's an object or array, extract readable content
  if (typeof content === 'object') {
    return extractReadableContent(content);
  }

  return String(content);
}

/**
 * Extract human-readable content from parsed JSON
 * @param {any} data - Parsed JSON data
 * @returns {string} - Human-readable text
 */
function extractReadableContent(data) {
  if (Array.isArray(data)) {
    // For arrays, map each item
    return data.map((item, i) => {
      if (typeof item === 'string') return `${i + 1}. ${item}`;
      if (typeof item === 'object' && item !== null) {
        // Try common text fields
        return item.text || item.content || item.description || item.title || item.summary || JSON.stringify(item);
      }
      return String(item);
    }).join('\n');
  }

  if (typeof data === 'object' && data !== null) {
    // For objects, try to find text content
    const textFields = ['text', 'content', 'description', 'summary', 'message'];
    for (const field of textFields) {
      if (data[field] && typeof data[field] === 'string') {
        return renderMarkdown(data[field]);
      }
    }

    // If it has keyTakeaways or similar array fields, render those
    if (Array.isArray(data.keyTakeaways)) {
      return data.keyTakeaways.map((t, i) => `${i + 1}. ${t}`).join('\n');
    }

    // Last resort: stringify nicely
    return JSON.stringify(data, null, 2);
  }

  return String(data);
}

export default renderMarkdown;
