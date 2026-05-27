import { randomUUID } from 'crypto';
import {
  addMessage,
  createConversation,
  getConversationMessages,
  supabase,
} from '../../database/client.js';
import { createTextCompletion } from '../openai/azure-client.js';
import {
  buildRealtimeContext,
  buildRealtimeContextFromSession,
  buildRealtimeInstructions,
} from './contextBuilder.js';
import { REALTIME_CONFIG, estimateRealtimeTokens } from './config.js';
import realtimeClient from './realtimeClient.js';

const sessions = new Map();
const SESSION_TTL_MS = REALTIME_CONFIG.MAX_SESSION_MINUTES * 60 * 1000;
const IDLE_TIMEOUT_MS = REALTIME_CONFIG.IDLE_TIMEOUT_SECONDS * 1000;

function nowIso() {
  return new Date().toISOString();
}

function normalizeMode(mode) {
  return mode === 'learning' ? 'learning' : 'chat';
}

function trimRecent(messages = []) {
  return messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .slice(-REALTIME_CONFIG.MAX_CONTEXT_MESSAGES);
}

async function assertConversationAccess(conversationId, userId) {
  if (!conversationId) return null;

  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (error || !data) {
    const notFound = new Error('Conversation not found.');
    notFound.status = 404;
    throw notFound;
  }

  if (data.user_id !== userId) {
    const forbidden = new Error('Access denied to conversation.');
    forbidden.status = 403;
    throw forbidden;
  }

  return data;
}

export class RealtimeSessionManager {
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
      const createdAt = session.createdAtMs || 0;
      const lastActivity = session.lastActivityMs || session.lastSeenAt || 0;
      if (createdAt + SESSION_TTL_MS < now || lastActivity + IDLE_TIMEOUT_MS < now) {
        sessions.delete(sessionId);
      }
    }
  }

  getSession(sessionId, userId = null) {
    const session = sessions.get(sessionId);
    if (!session) return null;
    if (userId && session.userId !== userId) return null;
    if (this.isExpired(session)) {
      sessions.delete(sessionId);
      return null;
    }
    session.lastSeenAt = Date.now();
    return session;
  }

  getSessionByConversation(conversationId, userId = null) {
    if (!conversationId) return null;

    for (const [sessionId, session] of sessions.entries()) {
      if (session.conversationId !== conversationId) continue;
      if (userId && session.userId !== userId) continue;
      if (this.isExpired(session)) {
        sessions.delete(sessionId);
        continue;
      }

      session.lastSeenAt = Date.now();
      return session;
    }

    return null;
  }

  isExpired(session) {
    const now = Date.now();
    return (
      (session.createdAtMs || 0) + SESSION_TTL_MS < now ||
      (session.lastActivityMs || session.lastSeenAt || 0) + IDLE_TIMEOUT_MS < now
    );
  }

  deleteSession(sessionId, userId = null) {
    const session = this.getSession(sessionId, userId);
    if (!session) return false;
    return sessions.delete(sessionId);
  }

  async createSession({
    userId,
    conversationId = null,
    mode = 'chat',
    personaId = null,
    preferences = {},
    activeTopic = null,
    documentId = null,
    createIfMissing = false,
  }) {
    this.cleanupExpiredSessions();

    let activeConversationId = conversationId;
    if (activeConversationId) {
      await assertConversationAccess(activeConversationId, userId);
    } else if (createIfMissing) {
      const conversation = await createConversation(
        userId,
        mode === 'learning' ? 'Learning Conversation' : 'Voice Conversation',
        { mode: normalizeMode(mode), source: 'realtime' },
      );
      activeConversationId = conversation.id;
    }

    const restoredSession = this.getSessionByConversation(activeConversationId, userId);
    if (restoredSession) {
      restoredSession.mode = normalizeMode(mode || restoredSession.mode);
      restoredSession.preferences = preferences || restoredSession.preferences || {};
      restoredSession.activeTopic = activeTopic || restoredSession.activeTopic;
      restoredSession.lastSeenAt = Date.now();
      restoredSession.updatedAt = nowIso();
      return restoredSession;
    }

    const dbMessages = activeConversationId
      ? await getConversationMessages(activeConversationId).catch(() => [])
      : [];

    const context = await buildRealtimeContext({
      userId,
      conversationId: activeConversationId,
      mode: normalizeMode(mode),
      personaId,
      preferences,
      activeTopic,
      documentId,
    });
    const instructions = buildRealtimeInstructions(context);

    let azureSession = null;
    if (realtimeClient.isConfigured()) {
      azureSession = await realtimeClient.createSession({
        instructions,
        modalities: ['text', 'audio'],
      }).catch(error => ({
        error: error.message,
        unavailable: true,
      }));
    }

    const now = Date.now();
    const session = {
      sessionId: randomUUID(),
      userId,
      conversationId: activeConversationId,
      mode: normalizeMode(mode),
      recentMessages: trimRecent(dbMessages),
      persona: context.persona,
      userProfile: context.userProfile,
      preferences,
      activeTopic: context.topicContext || activeTopic,
      learningContext: context.learningContext,
      documentContext: context.documentContext,
      conversationContext: context.conversationContext,
      contextSummary: null,
      azureSession,
      instructions,
      createdAt: nowIso(),
      createdAtMs: now,
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
      ttl: REALTIME_CONFIG.MAX_SESSION_MINUTES * 60,
      updatedAt: nowIso(),
      lastActivity: nowIso(),
      lastActivityMs: now,
      lastSeenAt: now,
    };

    sessions.set(session.sessionId, session);
    return session;
  }

  async rebuildSession({ sessionId, userId, currentText = '', updates = {} }) {
    const session = this.getSession(sessionId, userId);
    if (!session) {
      const error = new Error('Realtime session not found.');
      error.status = 404;
      throw error;
    }

    const context = await buildRealtimeContext({
      userId,
      conversationId: session.conversationId,
      mode: updates.mode || session.mode,
      currentText,
      personaId: updates.personaId || session.persona?.id || null,
      preferences: updates.preferences || session.preferences || {},
      activeTopic: updates.activeTopic || session.activeTopic,
      documentId: updates.documentId || session.documentContext?.documentId || null,
    });

    session.mode = normalizeMode(updates.mode || session.mode);
    session.preferences = updates.preferences || session.preferences;
    session.activeTopic = context.topicContext || session.activeTopic;
    session.persona = context.persona;
    session.userProfile = context.userProfile;
    session.learningContext = context.learningContext;
    session.documentContext = context.documentContext;
    session.conversationContext = context.conversationContext;
    session.recentMessages = trimRecent(context.conversationHistory);
    session.contextSummary = context.contextSummary || session.contextSummary || null;
    session.instructions = buildRealtimeInstructions(context);
    session.updatedAt = nowIso();
    session.lastActivity = nowIso();
    session.lastActivityMs = Date.now();
    session.lastSeenAt = Date.now();

    return session;
  }

  getTurnContext({ sessionId, userId, currentText = '', updates = {} }) {
    const session = this.getSession(sessionId, userId);
    if (!session) {
      const error = new Error('Realtime session not found or expired.');
      error.status = 404;
      throw error;
    }

    session.mode = normalizeMode(updates.mode || session.mode);
    session.preferences = updates.preferences || session.preferences;

    const context = buildRealtimeContextFromSession(session, { currentText, updates });
    session.activeTopic = context.topicContext || session.activeTopic;
    session.learningContext = context.learningContext;
    session.conversationContext = context.conversationContext;
    session.instructions = buildRealtimeInstructions(context);
    session.updatedAt = nowIso();
    session.lastActivity = nowIso();
    session.lastActivityMs = Date.now();

    return { session, context };
  }

  estimateSessionTokens(session, context = null) {
    const payload = {
      summary: session.contextSummary || '',
      instructions: session.instructions || '',
      messages: context?.conversationHistory || session.recentMessages || [],
    };
    return estimateRealtimeTokens(payload);
  }

  async enforceTokenBudget(session) {
    const tokenEstimate = this.estimateSessionTokens(session);
    if (tokenEstimate <= REALTIME_CONFIG.MAX_REALTIME_TOKENS) {
      return { summarized: false, tokenEstimate };
    }

    const messages = session.recentMessages || [];
    const keepCount = Math.min(REALTIME_CONFIG.SUMMARY_KEEP_MESSAGES, messages.length);
    const olderMessages = messages.slice(0, Math.max(0, messages.length - keepCount));
    const latestMessages = messages.slice(-keepCount);

    if (olderMessages.length === 0) {
      session.recentMessages = trimRecent(latestMessages);
      return { summarized: false, tokenEstimate: this.estimateSessionTokens(session), trimmed: true };
    }

    try {
      const previousSummary = session.contextSummary
        ? `Existing summary:\n${session.contextSummary}\n\n`
        : '';
      const summary = await createTextCompletion({
        system: 'Summarize this tutoring conversation for future context. Preserve active topic, unresolved learner goals, artifacts generated/requested, document references, and preferences. Be concise.',
        messages: [{
          role: 'user',
          content: `${previousSummary}Messages:\n${olderMessages.map(message => `${message.role}: ${message.content}`).join('\n')}`,
        }],
        maxTokens: 700,
      });

      session.contextSummary = summary.trim();
      session.recentMessages = trimRecent(latestMessages);
      session.instructions = buildRealtimeInstructions(buildRealtimeContextFromSession(session));
      return { summarized: true, tokenEstimate: this.estimateSessionTokens(session) };
    } catch (error) {
      session.recentMessages = trimRecent(latestMessages);
      session.instructions = buildRealtimeInstructions(buildRealtimeContextFromSession(session));
      return {
        summarized: false,
        trimmed: true,
        error: error.message,
        tokenEstimate: this.estimateSessionTokens(session),
      };
    }
  }

  appendMessage(sessionId, message) {
    const session = sessions.get(sessionId);
    if (!session) return null;

    session.recentMessages = trimRecent([
      ...(session.recentMessages || []),
      {
        id: message.id || randomUUID(),
        role: message.role,
        content: message.content || '',
        metadata: message.metadata || {},
        created_at: message.created_at || nowIso(),
      },
    ]);
    session.updatedAt = nowIso();
    session.lastActivity = nowIso();
    session.lastActivityMs = Date.now();
    session.lastSeenAt = Date.now();
    return session;
  }

  async persistTurn({ sessionId, userText, assistantText, assistantMetadata = {}, userMetadata = {} }) {
    const session = this.getSession(sessionId);
    if (!session?.conversationId) {
      const error = new Error('Realtime session does not have a conversation.');
      error.status = 400;
      throw error;
    }

    const userMessage = await addMessage(session.conversationId, 'user', userText, userMetadata);
    this.appendMessage(sessionId, userMessage);

    const assistantMessage = await addMessage(
      session.conversationId,
      'assistant',
      assistantText || '',
      assistantMetadata,
    );
    this.appendMessage(sessionId, assistantMessage);
    await this.enforceTokenBudget(session);

    return { userMessage, assistantMessage };
  }

  async appendTemporaryTurn({ sessionId, userText, assistantText, assistantMetadata = {}, userMetadata = {} }) {
    const session = this.getSession(sessionId);
    if (!session) {
      const error = new Error('Realtime session not found or expired.');
      error.status = 404;
      throw error;
    }

    const userMessage = {
      id: `rt_user_${randomUUID()}`,
      role: 'user',
      content: userText,
      metadata: { ...userMetadata, temporary: true },
      created_at: nowIso(),
    };
    const assistantMessage = {
      id: `rt_assistant_${randomUUID()}`,
      role: 'assistant',
      content: assistantText || '',
      metadata: { ...assistantMetadata, temporary: true },
      created_at: nowIso(),
    };

    this.appendMessage(sessionId, userMessage);
    this.appendMessage(sessionId, assistantMessage);
    await this.enforceTokenBudget(session);

    return { userMessage, assistantMessage };
  }

  async saveSummary({ sessionId, userId }) {
    const session = this.getSession(sessionId, userId);
    if (!session?.conversationId) {
      const error = new Error('Cannot save summary without an active conversation.');
      error.status = 400;
      throw error;
    }

    const transcript = [
      session.contextSummary ? `Previous summary:\n${session.contextSummary}` : null,
      ...(session.recentMessages || []).map(message => `${message.role}: ${message.content}`),
    ].filter(Boolean).join('\n');

    const summary = await createTextCompletion({
      system: 'Create a concise chat note from this temporary voice session. Do not include raw transcript. Preserve the learning topic, key explanation points, decisions, and any follow-up actions.',
      messages: [{ role: 'user', content: transcript }],
      maxTokens: 800,
    });

    return addMessage(session.conversationId, 'assistant', summary.trim(), {
      realtimeSummary: true,
      realtimeSessionId: session.sessionId,
      mode: session.mode,
      activeTopic: session.activeTopic,
    });
  }
}

export const realtimeSessionManager = new RealtimeSessionManager();

export default realtimeSessionManager;
