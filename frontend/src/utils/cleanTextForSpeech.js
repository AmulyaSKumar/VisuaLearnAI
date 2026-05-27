const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

const UI_ARTIFACT_LINES = new Set([
  'visualize',
  'quick quiz',
  'like',
  'dislike',
  'feedback',
  'play',
  'pause',
  'resume',
  'stop',
]);

export function cleanTextForSpeech(text = '') {
  return String(text || '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(^|\s)([*_]{1,3})(?=\S)/g, '$1')
    .replace(/([*_]{1,3})(?=\s|$)/g, '')
    .replace(/`{1,3}/g, '')
    .replace(/^>\s?/gm, '')
    .replace(EMOJI_PATTERN, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !UI_ARTIFACT_LINES.has(line.toLowerCase()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default cleanTextForSpeech;
