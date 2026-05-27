const GENERIC_RESPONSE_PATTERNS = [
  /^\s*(?:oh yeah|no worries|of course|sure|absolutely|happy to help|glad to help)[,!.:\s-]*/i,
  /^\s*(?:i can help you with|i'll help you with|let's learn about|let's dive into)[^.\n]*[.\n]*/i,
  /(?:\n|\s)*(?:if you want|would you like|i can also help|i can also explain|i can help with|happy to help|glad to help|let me know|want me to|do you want me to)[\s\S]*$/i,
];

const VISIBLE_SPEC_PATTERNS = [
  /```(?:json|js|javascript)?\s*[\s\S]*?"spec_type"\s*:\s*"[^"]+"[\s\S]*?```/gi,
  /to=show_widget[\s\S]*?"spec_type"\s*:\s*"[^"]+"[\s\S]*$/gi,
  /^\s*\{[\s\S]*?"spec_type"\s*:\s*"[^"]+"[\s\S]*?\}\s*$/gi,
  /^\s*\{[\s\S]*?"objects"\s*:\s*\[[\s\S]*?\][\s\S]*?\}\s*$/gi,
  /^\s*\{[\s\S]*?"widget_code"\s*:\s*[\s\S]*?\}\s*$/gi,
];

function stripVisibleToolLeak(value = '') {
  const output = String(value || '');
  const hasWidgetLeak = /to=show_widget/i.test(output);
  const hasVisualSpec = /"spec_type"\s*:/.test(output) && /"objects"\s*:/.test(output);

  if (hasWidgetLeak && hasVisualSpec) {
    const leakStart = output.search(/to=show_widget/i);
    const prefix = leakStart > 0 ? output.slice(0, leakStart).trim() : '';
    return prefix.length > 0 && prefix.length < 220 ? prefix : '';
  }

  if (hasVisualSpec && /^\s*[\[{]/.test(output.trim())) {
    return '';
  }

  return output;
}

export function sanitizeAssistantResponse(text = '') {
  let output = stripVisibleToolLeak(text);
  for (const pattern of VISIBLE_SPEC_PATTERNS) {
    output = output.replace(pattern, '');
  }
  for (const pattern of GENERIC_RESPONSE_PATTERNS) {
    output = output.replace(pattern, '');
  }
  return output.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export default sanitizeAssistantResponse;
