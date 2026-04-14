export const DEFAULT_CONVERSATION_TITLE = 'New Conversation';
export const MAX_CONVERSATION_TITLE_LENGTH = 80;

export function normalizeConversationTitle(title) {
  if (typeof title !== 'string') {
    return '';
  }

  return title.trim().replace(/\s+/g, ' ').slice(0, MAX_CONVERSATION_TITLE_LENGTH);
}

export function generateConversationTitle(firstUserMessage) {
  const normalizedMessage = normalizeConversationTitle(firstUserMessage);

  if (!normalizedMessage) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  const words = normalizedMessage.split(/\s+/);
  const shortTitle = words.slice(0, 6).join(' ');
  const title = words.length > 6 ? `${shortTitle}...` : shortTitle;

  return title.slice(0, MAX_CONVERSATION_TITLE_LENGTH);
}

export function shouldAutoGenerateConversationTitle(title) {
  const normalizedTitle = normalizeConversationTitle(title);
  return !normalizedTitle || normalizedTitle === DEFAULT_CONVERSATION_TITLE;
}

export function sortConversations(conversations) {
  return [...conversations].sort((left, right) => {
    const leftDate = left.updated_at || left.created_at || '';
    const rightDate = right.updated_at || right.created_at || '';
    return rightDate.localeCompare(leftDate);
  });
}
