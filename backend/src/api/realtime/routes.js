/**
 * Realtime Voice API Routes
 * Handles ephemeral session token generation for Azure OpenAI Realtime API
 * @module api/realtime
 */

import express from 'express';
import { config } from '../../config/environment.js';
import { logger } from '../../utils/logger.js';
import { getConversationMessages, getPersona, getUserProfile } from '../../database/client.js';

const router = express.Router();

/**
 * Check if Azure Realtime is configured
 * Uses same fallback logic as realtime-proxy.js:
 * - Endpoint: AZURE_REALTIME_ENDPOINT or AZURE_OPENAI_ENDPOINT
 * - API Key: AZURE_REALTIME_API_KEY or AZURE_OPENAI_API_KEY
 */
function isAzureRealtimeConfigured() {
  const hasEndpoint = !!(config.azure.realtimeEndpoint || process.env.AZURE_OPENAI_ENDPOINT);
  const hasApiKey = !!(config.azure.realtimeApiKey || process.env.AZURE_OPENAI_API_KEY);
  return hasEndpoint && hasApiKey;
}

/**
 * POST /api/realtime/session
 * Returns WebSocket proxy endpoint for Azure OpenAI Realtime API
 * Azure uses our WebSocket proxy at /ws/realtime (API key is on backend)
 */
router.post('/session', async (req, res) => {
  const { conversationId, personaId } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if Azure Realtime is configured
  if (!isAzureRealtimeConfigured()) {
    logger.error('Azure Realtime API not configured');
    return res.status(503).json({
      error: 'Voice service not configured',
      details: 'Set AZURE_REALTIME_ENDPOINT/AZURE_OPENAI_ENDPOINT and AZURE_REALTIME_API_KEY/AZURE_OPENAI_API_KEY'
    });
  }

  try {
    // Fetch context info (for logging and frontend display)
    const [messages, persona] = await Promise.all([
      conversationId ? getConversationMessages(conversationId).catch(() => []) : [],
      personaId ? getPersona(personaId).catch(() => null) : null,
    ]);

    // Generate session tracking ID
    const sessionId = `voice_${userId.slice(0, 8)}_${Date.now()}`;

    logger.info({
      sessionId,
      userId: userId.slice(0, 8),
      conversationId: conversationId?.slice(0, 8),
      hasPersona: !!persona,
      messageCount: messages.length,
    }, 'Voice session created');

    // Build WebSocket proxy URL (frontend connects to our proxy, not Azure directly)
    // The proxy handles Azure authentication and personalization
    const wsProxyUrl = buildWebSocketProxyUrl(req, conversationId, personaId, userId);

    // Return session info to frontend
    res.json({
      // No clientSecret needed - our proxy handles Azure auth
      wsEndpoint: wsProxyUrl,
      expiresAt: Date.now() + 300000, // 5 min session limit
      sessionId,
      conversationId,
      // Include context metadata for frontend
      contextInfo: {
        messageCount: messages.length,
        hasPersona: !!persona,
        personaName: persona?.name || null,
      },
    });

  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Voice session creation error');
    res.status(500).json({
      error: 'Failed to create voice session',
      details: error.message
    });
  }
});

/**
 * Build WebSocket proxy URL for frontend connection
 * Frontend connects to our /ws/realtime proxy, which handles Azure auth
 * Derives host from request to work across different environments
 */
function buildWebSocketProxyUrl(req, conversationId, personaId, userId) {
  // Derive host from request headers (works for same-origin and proxied setups)
  const forwardedHost = req.get('x-forwarded-host');
  const requestHost = req.get('host');

  // Use forwarded host (behind proxy) or request host, fallback to env/localhost
  let host = forwardedHost || requestHost || process.env.BACKEND_HOST || 'localhost:3001';

  // Determine protocol: only use wss if actually behind HTTPS proxy or TLS
  // localhost always uses ws (no TLS in local dev)
  const isLocalHost = /^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$|^\[::1\](:\d+)?$/i.test(host);
  const forwardedProto = req.get('x-forwarded-proto');
  const isSecure = !isLocalHost && (forwardedProto === 'https' || req.secure);
  const protocol = isSecure ? 'wss' : 'ws';

  // Build query params for the proxy
  const params = new URLSearchParams();
  if (conversationId) params.set('conversationId', conversationId);
  if (personaId) params.set('personaId', personaId);
  if (userId) params.set('userId', userId);

  const queryString = params.toString();
  return `${protocol}://${host}/ws/realtime${queryString ? '?' + queryString : ''}`;
}

/**
 * Build session instructions with persona, context, and personalization
 */
function buildSessionInstructions(messages, persona, userProfile) {
  const parts = [];

  // 1. Persona (highest priority)
  if (persona) {
    parts.push(buildPersonaSection(persona));
  }

  // 2. Learning style personalization
  if (userProfile) {
    parts.push(buildLearningStyleSection(userProfile));
  }

  // 3. Conversation context
  if (messages.length > 0) {
    parts.push(buildContextSection(messages));
  }

  // 4. Base voice tutor instructions
  parts.push(buildBaseInstructions());

  return parts.join('\n\n');
}

/**
 * Build persona section for instructions
 */
function buildPersonaSection(persona) {
  const strength = persona.strength ?? 80;
  let adherenceMode;

  if (strength >= 80) {
    adherenceMode = 'STRICT: Maintain persona at all times, even if user requests different style.';
  } else if (strength >= 50) {
    adherenceMode = 'BALANCED: Follow persona guidelines but adapt slightly to user energy.';
  } else {
    adherenceMode = 'FLEXIBLE: Use persona as loose guidance, prioritize user preferences.';
  }

  const rules = (persona.rules || []).map(r => `- ${r}`).join('\n') || '- Be helpful and engaging';
  const avoidRules = (persona.avoid_rules || []).map(r => `- ${r}`).join('\n') || '- Nothing specific';

  return `## YOUR PERSONA
You are ${persona.name}. ${persona.description || ''}

Adherence Level: ${strength}/100 - ${adherenceMode}

Tone: ${persona.tone || 'friendly'}
Verbosity: ${persona.verbosity || 'medium'}

MUST DO:
${rules}

MUST AVOID:
${avoidRules}

${persona.system_prompt_prefix || ''}`;
}

/**
 * Build learning style section
 */
function buildLearningStyleSection(profile) {
  const style = profile.learning_style || 'visual';
  const level = profile.comprehension_level || 'intermediate';
  const pace = profile.pace_preference || 'normal';
  const styleScores = profile.detected_styles || {};
  const stylePercent = Math.round((styleScores[style] || 0.25) * 100);

  let styleGuidance;
  switch (style) {
    case 'visual':
      styleGuidance = 'Use descriptive imagery and "picture this" language. Paint mental pictures.';
      break;
    case 'auditory':
      styleGuidance = 'Use rhythmic explanations and verbal emphasis. Vary tone for key points.';
      break;
    case 'kinesthetic':
      styleGuidance = 'Use "try this" and hands-on action words. Suggest experiments.';
      break;
    default:
      styleGuidance = 'Use clear structured explanations with definitions.';
  }

  let paceGuidance;
  switch (pace) {
    case 'slow':
      paceGuidance = 'Speak slowly and clearly, with pauses between concepts.';
      break;
    case 'fast':
      paceGuidance = 'Be efficient, skip obvious details, move quickly.';
      break;
    default:
      paceGuidance = 'Use a natural conversational pace.';
  }

  return `## LEARNER PROFILE
Learning Style: ${style} (${stylePercent}% preference)
Knowledge Level: ${level}
Pace Preference: ${pace}

${styleGuidance}
${paceGuidance}`;
}

/**
 * Build conversation context section
 */
function buildContextSection(messages) {
  // Take last 20 messages max
  const recentMessages = messages.slice(-20);

  // Summarize if we have many messages
  let summary = '';
  if (messages.length > 10) {
    // Extract topics from earlier messages
    const topics = extractTopics(messages.slice(0, -10));
    if (topics.length > 0) {
      summary = `Summary: User has been discussing ${topics.join(', ')}.\n\n`;
    }
  }

  // Format recent messages
  const formattedMessages = recentMessages.slice(-10).map(msg => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const content = typeof msg.content === 'string'
      ? msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '')
      : JSON.stringify(msg.content).slice(0, 200);
    return `${role}: "${content}"`;
  }).join('\n');

  return `## CONVERSATION CONTEXT
${summary}Recent messages:
${formattedMessages}

Continue this conversation naturally. Reference previous topics when relevant.`;
}

/**
 * Extract topic keywords from messages
 */
function extractTopics(messages) {
  const topics = new Set();
  const topicPatterns = [
    /(?:about|learn|understand|explain|teach me|what is|how does)\s+([a-z\s]{3,30})/gi,
    /\b(math|algebra|calculus|geometry|physics|chemistry|biology|history|programming|javascript|python|react|css|html|database|sql|machine learning|ai|recursion|loops|functions|arrays|photosynthesis|molecules|atoms)\b/gi,
  ];

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : '';
    for (const pattern of topicPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const topic = (match[1] || match[0]).trim().toLowerCase();
        if (topic.length > 2 && topic.length < 30) {
          topics.add(topic);
        }
      }
    }
  }

  return Array.from(topics).slice(0, 5);
}

/**
 * Build base voice tutor instructions
 */
function buildBaseInstructions() {
  return `## VOICE INTERACTION GUIDELINES
You are VisuaLearn AI, an adaptive voice tutor.

RULES:
1. Keep responses concise (2-4 sentences max unless explaining complex concepts)
2. Speak naturally as if in a real conversation
3. Check understanding after explaining new concepts ("Does that make sense?")
4. If the learner seems confused, simplify immediately
5. Celebrate progress with brief positive reinforcement
6. Never be condescending or overly repetitive
7. Use verbal cues like "Let me explain..." or "Think of it this way..."

REMEMBER: This is a voice conversation. Be conversational, not lecture-like.`;
}

export default router;
