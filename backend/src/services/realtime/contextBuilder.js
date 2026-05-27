import { analyzeUserProfile } from '../../agents/personalization.js';
import {
  getConversationMessages,
  getConversationResources,
  getPersona,
  getUserDefaultPersona,
  getDefaultSystemPersona,
  getUserProfile,
} from '../../database/client.js';
import {
  getDocument,
  retrieveChunks,
  formatChunksAsContext,
} from '../rag/index.js';
import { REALTIME_CONFIG } from './config.js';

const DEFAULT_HISTORY_LIMIT = REALTIME_CONFIG.MAX_CONTEXT_MESSAGES;
const TOPIC_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'compare', 'explain', 'for', 'generate',
  'how', 'in', 'is', 'it', 'me', 'of', 'show', 'teach', 'the', 'this', 'to',
  'visualize', 'what', 'with',
]);

function normalizeMessage(message) {
  return {
    id: message.id,
    role: message.role,
    content: message.content || '',
    metadata: message.metadata || {},
    created_at: message.created_at,
  };
}

function trimHistory(messages = [], limit = DEFAULT_HISTORY_LIMIT) {
  return messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .slice(-limit)
    .map(normalizeMessage);
}

function getTopicTokens(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !TOPIC_STOP_WORDS.has(token));
}

function inferTopicFromText(text = '') {
  const patterns = [
    /(?:teach me|teach|explain|learn|about|understand|visualize|quiz me on|quiz me|flashcards for|mind map for)\s+(.+)/i,
    /(?:what is|how does|how do)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = String(text).match(pattern);
    if (match?.[1]) {
      return match[1].replace(/[?.!]+$/g, '').trim().slice(0, 120);
    }
  }

  const tokens = getTopicTokens(text);
  return tokens.length ? tokens.slice(0, 6).join(' ') : null;
}

export function inferActiveTopic({ currentText, recentMessages, resources, fallbackTopic }) {
  const explicitTopic = inferTopicFromText(currentText);
  if (explicitTopic && getTopicTokens(explicitTopic).length > 0) return explicitTopic;

  const latestResource = [...(resources || [])]
    .reverse()
    .find(resource => resource.topic || resource.content?.topic || resource.content?.title);
  if (latestResource) {
    return latestResource.topic || latestResource.content?.topic || latestResource.content?.title;
  }

  const latestUserMessage = [...(recentMessages || [])]
    .reverse()
    .find(message => message.role === 'user' && inferTopicFromText(message.content));

  return inferTopicFromText(latestUserMessage?.content) || fallbackTopic || null;
}

async function resolvePersona(personaId, userId) {
  if (personaId) {
    const persona = await getPersona(personaId);
    if (persona) return persona;
  }

  if (userId) {
    const userDefault = await getUserDefaultPersona(userId).catch(() => null);
    if (userDefault) return userDefault;
  }

  return getDefaultSystemPersona().catch(() => null);
}

async function buildDocumentContext({ documentId, userId, query }) {
  if (!documentId) return null;

  const document = await getDocument(documentId);
  if (!document || document.user_id !== userId || document.status !== 'ready') {
    return {
      documentId,
      available: false,
      reason: !document ? 'not_found' : document.user_id !== userId ? 'forbidden' : document.status,
    };
  }

  const chunks = await retrieveChunks(documentId, query || document.original_name || '', 5).catch(() => []);
  return {
    documentId,
    name: document.original_name,
    available: chunks.length > 0,
    chunks,
    formatted: chunks.length > 0 ? formatChunksAsContext(chunks) : '',
  };
}

export async function buildRealtimeContext({
  userId,
  conversationId,
  mode = 'chat',
  currentText = '',
  personaId = null,
  preferences = {},
  activeTopic = null,
  documentId = null,
  historyLimit = DEFAULT_HISTORY_LIMIT,
}) {
  const [messages, resources, persona, userProfile, personalizationProfile] = await Promise.all([
    conversationId ? getConversationMessages(conversationId).catch(() => []) : Promise.resolve([]),
    conversationId ? getConversationResources(conversationId).catch(() => []) : Promise.resolve([]),
    resolvePersona(personaId, userId),
    userId ? getUserProfile(userId).catch(() => null) : Promise.resolve(null),
    userId ? analyzeUserProfile(userId).catch(() => null) : Promise.resolve(null),
  ]);

  const recentMessages = trimHistory(messages, historyLimit);
  const topicContext = inferActiveTopic({
    currentText,
    recentMessages,
    resources,
    fallbackTopic: activeTopic,
  });
  const selectedDocumentId =
    documentId ||
    [...recentMessages].reverse().find(message => message.metadata?.documentId)?.metadata?.documentId ||
    null;
  const documentContext = await buildDocumentContext({
    documentId: selectedDocumentId,
    userId,
    query: currentText || topicContext,
  });

  const previousArtifacts = resources.map(resource => ({
    id: resource.id,
    type: resource.resource_type,
    topic: resource.topic,
    updated_at: resource.updated_at || resource.created_at,
  }));

  return {
    conversationHistory: recentMessages,
    persona,
    learningPreferences: preferences,
    documentContext,
    topicContext,
    userProfile: userProfile || personalizationProfile || null,
    learningContext: {
      mode,
      activeLearningTopic: topicContext,
      previousArtifacts,
      selectedMode: mode,
    },
    conversationContext: {
      previousMessages: recentMessages,
      currentTopic: topicContext,
      previousArtifacts,
      activeDocument: documentContext,
      selectedMode: mode,
    },
  };
}

export function buildRealtimeContextFromSession(session, {
  currentText = '',
  updates = {},
} = {}) {
  const recentMessages = trimHistory(
    session.recentMessages || [],
    REALTIME_CONFIG.MAX_CONTEXT_MESSAGES,
  );
  const previousArtifacts = session.learningContext?.previousArtifacts || [];
  const topicContext = inferActiveTopic({
    currentText,
    recentMessages,
    resources: previousArtifacts.map(artifact => ({
      topic: artifact.topic,
      resource_type: artifact.type,
      updated_at: artifact.updated_at,
    })),
    fallbackTopic: updates.activeTopic || session.activeTopic,
  });
  const mode = updates.mode || session.mode || 'chat';
  const preferences = updates.preferences || session.preferences || {};
  const documentContext = session.documentContext || null;

  return {
    conversationHistory: recentMessages,
    contextSummary: session.contextSummary || null,
    persona: session.persona,
    learningPreferences: preferences,
    documentContext,
    topicContext,
    userProfile: session.userProfile || null,
    learningContext: {
      ...(session.learningContext || {}),
      mode,
      activeLearningTopic: topicContext,
      previousArtifacts,
      selectedMode: mode,
    },
    conversationContext: {
      previousMessages: recentMessages,
      currentTopic: topicContext,
      previousArtifacts,
      activeDocument: documentContext,
      selectedMode: mode,
    },
  };
}

export function buildRealtimeInstructions(context) {
  const persona = context.persona;
  const history = context.conversationHistory || [];
  const contextSummary = context.contextSummary;
  const topic = context.topicContext || 'the current learner request';
  const preferences = context.learningPreferences || {};
  const userProfile = context.userProfile || {};
  const documentContext = context.documentContext;
  const mode = context.learningContext?.mode || 'chat';

  const personaBlock = persona
    ? [
        `Persona: ${persona.name}`,
        persona.system_prompt_prefix,
        persona.tone ? `Tone: ${persona.tone}` : null,
        persona.verbosity ? `Verbosity: ${persona.verbosity}` : null,
        Array.isArray(persona.rules) && persona.rules.length ? `Rules: ${persona.rules.join('; ')}` : null,
        Array.isArray(persona.avoid_rules) && persona.avoid_rules.length ? `Avoid: ${persona.avoid_rules.join('; ')}` : null,
      ].filter(Boolean).join('\n')
    : 'Persona: Friendly tutor';

  const historyBlock = history
    .slice(-12)
    .map(message => `${message.role}: ${message.content}`)
    .join('\n');

  const documentBlock = documentContext?.available
    ? `\n\nDocument context from "${documentContext.name}":\n${documentContext.formatted}`
    : documentContext
      ? '\n\nA document is selected, but no relevant document excerpts are available for this turn.'
      : '';

  const modeInstructions = mode === 'learning'
    ? [
        'Learning Mode rules:',
        '- Keep the active learning topic across follow-ups.',
        '- Resolve "this", "visualize it", "quiz me", and "make flashcards" against the active topic.',
        '- Do not replace Learn, Quiz, Flashcards, Mind Map, or Simulation systems. When a learning artifact is requested, acknowledge the request briefly so the orchestrator can generate it.',
        '- Do not use generic chatbot filler such as "Oh yeah", "No worries", "Of course", "I can help you with", "If you want", "Glad to help", "Happy to help", or "Let me know".',
      ].join('\n')
    : [
        'Chat Mode rules:',
        '- Be concise and direct.',
        '- Use recent conversation history to answer follow-ups without asking the learner to repeat context.',
        '- Do not use generic chatbot filler such as "Oh yeah", "No worries", "Of course", "I can help you with", "If you want", "Glad to help", "Happy to help", or "Let me know".',
      ].join('\n');

  return [
    personaBlock,
    modeInstructions,
    `Active topic: ${topic}`,
    `Learning preferences: ${JSON.stringify(preferences || {})}`,
    `User profile: ${JSON.stringify({
      learning_style: userProfile.learning_style,
      comprehension_level: userProfile.comprehension_level,
      pace_preference: userProfile.pace_preference,
    })}`,
    contextSummary ? `Conversation summary so far:\n${contextSummary}` : null,
    historyBlock ? `Recent conversation:\n${historyBlock}` : null,
    documentBlock,
  ].filter(Boolean).join('\n\n');
}

export function resolveLearningIntent(text = '') {
  const value = String(text).toLowerCase();
  if (/\b(quiz|test me|question me)\b/.test(value)) {
    return { artifact: 'quiz', contentType: 'quiz' };
  }
  if (/\b(flashcard|flashcards|cards)\b/.test(value)) {
    return { artifact: 'flashcards', contentType: 'flashcards-mindmap' };
  }
  if (/\b(mind\s*map|mindmap|map this)\b/.test(value)) {
    return { artifact: 'mindmap', contentType: 'flashcards-mindmap' };
  }
  if (/\b(visuali[sz]e|simulation|animate|show visualization|show visualisation)\b/.test(value)) {
    return { artifact: 'simulation', contentType: 'learn' };
  }
  if (/\b(teach|learn|explain|deep dive|lesson)\b/.test(value)) {
    return { artifact: 'learn', contentType: 'learn' };
  }
  return { artifact: null, contentType: null };
}
