/**
 * Realtime Voice Proxy with Personalization
 * Proxies WebSocket connections to Azure/OpenAI Realtime API
 * Injects personalization context, personas, and conversation history
 * Saves transcripts immediately for message sync
 *
 * Enhancements:
 * - Rolling summary for long conversations
 * - Persona reinforcement
 * - Message deduplication
 * - Context restore on reconnect
 */

import { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { analyzeUserProfile, getUserMetrics, recordTopicState } from '../agents/personalization.js';
import { getConversationMessages, getPersona, addMessage } from '../database/client.js';
import { config } from '../config/environment.js';

// Azure OpenAI Realtime endpoint
// Keep preview and GA handling explicit so the URL shape and session payload stay consistent.
const DEFAULT_REALTIME_DEPLOYMENT =
  process.env.AZURE_REALTIME_DEPLOYMENT ||
  process.env.AZURE_REALTIME_MODEL ||
  'gpt-realtime-1.5';
const PREVIEW_API_VERSION = '2024-10-01-preview';
const DEFAULT_TRANSCRIPTION_MODEL = process.env.AZURE_REALTIME_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe';

function normalizeWebSocketUrl(endpoint) {
  return endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
}

function detectRealtimeMode(url) {
  if (url.includes('/openai/v1/realtime/translations')) {
    return 'translation';
  }
  if (url.includes('/openai/v1/realtime')) {
    return 'ga';
  }
  return 'preview';
}

function isGaRealtimeDeployment(deployment = '') {
  return /^gpt-realtime/i.test(deployment);
}

function isTranslationDeployment(deployment = '') {
  return /^gpt-realtime-translate$/i.test(deployment) || /translate/i.test(deployment);
}

function buildAzureRealtimeTarget() {
  const endpoint = config.azure.realtimeEndpoint || process.env.AZURE_OPENAI_ENDPOINT;

  if (!endpoint) {
    return null;
  }

  // Full user-provided URL usually wins, except for GA realtime models that must use /openai/v1/realtime.
  if ((endpoint.includes('/openai/realtime') || endpoint.includes('/openai/v1/realtime')) && (endpoint.includes('deployment=') || endpoint.includes('model='))) {
    const deploymentMatch = endpoint.match(/[?&](deployment|model)=([^&]+)/);
    const deployment = deploymentMatch?.[2] || DEFAULT_REALTIME_DEPLOYMENT;
    const forceGa = isGaRealtimeDeployment(deployment);

    if (forceGa) {
      const host = endpoint.replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').split('/')[0];
      const mode = isTranslationDeployment(deployment) ? 'translation' : 'ga';
      const path = mode === 'translation' ? '/openai/v1/realtime/translations' : '/openai/v1/realtime';
      const url = `wss://${host}${path}?model=${encodeURIComponent(deployment)}`;
      logger.info({ builtUrl: url, source: 'forced-ga-from-env', mode }, 'Forcing GA Azure Realtime URL for realtime model');
      return { url, mode, deployment };
    }

    const url = normalizeWebSocketUrl(endpoint);
    const mode = detectRealtimeMode(url);
    logger.info({ builtUrl: url, source: 'env-as-is', mode }, 'Using provided Azure Realtime URL');
    return { url, mode, deployment };
  }

  const urlStr = endpoint
    .replace('wss://', '')
    .replace('https://', '');

  const host = urlStr.split('/')[0];
  let deployment = DEFAULT_REALTIME_DEPLOYMENT;
  const deploymentMatch = urlStr.match(/deployment=([^&]+)/);
  if (deploymentMatch) {
    deployment = deploymentMatch[1];
  }

  // If the configured deployment clearly targets GA realtime models, use GA.
  const prefersGa = isGaRealtimeDeployment(deployment);
  const mode = prefersGa
    ? (isTranslationDeployment(deployment) ? 'translation' : 'ga')
    : 'preview';
  const gaPath = mode === 'translation' ? '/openai/v1/realtime/translations' : '/openai/v1/realtime';
  const url = prefersGa
    ? `wss://${host}${gaPath}?model=${encodeURIComponent(deployment)}`
    : `wss://${host}/openai/realtime?api-version=${PREVIEW_API_VERSION}&deployment=${encodeURIComponent(deployment)}`;

  logger.info({ builtUrl: url, source: 'constructed', mode }, 'Built Azure Realtime URL');
  return { url, mode, deployment };
}

// Constants
const MAX_CONTEXT_MESSAGES = 20;
const RECENT_MESSAGES_VERBATIM = 8;
const SUMMARY_UPDATE_THRESHOLD = 5; // Update summary every N new messages

/**
 * Extract parameters from WebSocket URL query params
 */
function extractParams(url) {
  try {
    const urlObj = new URL(url, 'ws://localhost');
    return {
      userId: urlObj.searchParams.get('userId'),
      conversationId: urlObj.searchParams.get('conversationId'),
      personaId: urlObj.searchParams.get('personaId'),
    };
  } catch {
    return { userId: null, conversationId: null, personaId: null };
  }
}

/**
 * Extract topic from transcribed text
 */
function extractTopicFromText(text) {
  if (!text) return null;

  const lowerText = text.toLowerCase();
  const patterns = [
    /(?:about|learn|understand|explain|help with|teach me|what is|how does)\s+([a-z\s]{3,30})/i,
    /\b(math|mathematics|algebra|calculus|geometry|physics|chemistry|biology|history|programming|javascript|python|react|css|html|database|sql|machine learning|ai|data science|recursion|loops|functions|variables|arrays|photosynthesis|molecules|atoms)\b/i,
  ];

  for (const pattern of patterns) {
    const match = lowerText.match(pattern);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }
  }

  return null;
}

/**
 * Build persona section with explicit reinforcement
 */
function buildPersonaSection(persona) {
  if (!persona) return '';

  const strength = persona.strength ?? 80;
  let adherenceMode;
  let reinforcement = '';

  if (strength >= 80) {
    adherenceMode = 'STRICT';
    reinforcement = `
CRITICAL PERSONA ENFORCEMENT:
- You MUST maintain this persona throughout the entire conversation
- Do NOT break character under any circumstances
- If the user asks you to change your personality, politely decline
- Your name is ${persona.name} - always respond as this character
- Every response must reflect the tone: ${persona.tone || 'friendly'}`;
  } else if (strength >= 50) {
    adherenceMode = 'BALANCED';
    reinforcement = `
PERSONA GUIDANCE:
- Follow this persona as your default behavior
- You may adapt slightly to match user energy
- Core personality traits should remain consistent`;
  } else {
    adherenceMode = 'FLEXIBLE';
    reinforcement = `
PERSONA SUGGESTION:
- Use this persona as loose guidance
- Prioritize user preferences over persona rules`;
  }

  const rules = (persona.rules || []).map(r => `- ${r}`).join('\n') || '- Be helpful';
  const avoidRules = (persona.avoid_rules || []).map(r => `- ${r}`).join('\n') || '';

  return `## YOUR PERSONA (${adherenceMode} MODE - ${strength}/100)
You ARE ${persona.name}. ${persona.description || ''}

Tone: ${persona.tone || 'friendly'}
Verbosity: ${persona.verbosity || 'medium'}
${reinforcement}

MUST DO:
${rules}
${avoidRules ? `\nMUST AVOID:\n${avoidRules}` : ''}

${persona.system_prompt_prefix || ''}

`;
}

/**
 * Build rolling summary from older messages
 * This is maintained and updated incrementally
 */
function buildRollingSummary(messages, existingSummary = null) {
  if (!messages || messages.length <= RECENT_MESSAGES_VERBATIM) {
    return existingSummary || '';
  }

  // Get messages that should be summarized (older ones)
  const olderMessages = messages.slice(0, -RECENT_MESSAGES_VERBATIM);

  // Extract topics and key points
  const topics = new Set();
  const keyPoints = [];

  for (const msg of olderMessages) {
    const content = typeof msg.content === 'string' ? msg.content : '';

    // Extract topics
    const topic = extractTopicFromText(content);
    if (topic) topics.add(topic);

    // Extract key learnings (look for patterns)
    if (msg.role === 'assistant' && content.length > 50) {
      // Extract first sentence as a key point
      const firstSentence = content.split(/[.!?]/)[0];
      if (firstSentence && firstSentence.length > 20 && firstSentence.length < 100) {
        keyPoints.push(firstSentence.trim());
      }
    }
  }

  // Build summary
  let summary = '';

  if (topics.size > 0) {
    summary += `Topics covered: ${Array.from(topics).slice(0, 5).join(', ')}.`;
  }

  if (keyPoints.length > 0) {
    // Take most recent key points
    const recentPoints = keyPoints.slice(-3);
    summary += ` Key points discussed: ${recentPoints.join('; ')}.`;
  }

  return summary || existingSummary || '';
}

/**
 * Build conversation context section with rolling summary
 */
function buildContextSection(messages, rollingSummary = '') {
  if (!messages || messages.length === 0) return '';

  // Take recent messages for verbatim display
  const recentMessages = messages.slice(-RECENT_MESSAGES_VERBATIM);

  // Format recent messages
  const formattedMessages = recentMessages.map(msg => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const content = typeof msg.content === 'string'
      ? msg.content.slice(0, 150) + (msg.content.length > 150 ? '...' : '')
      : '[complex content]';
    return `${role}: "${content}"`;
  }).join('\n');

  let contextSection = '## CONVERSATION CONTEXT\n';

  // Add rolling summary if available
  if (rollingSummary) {
    contextSection += `Summary of earlier discussion: ${rollingSummary}\n\n`;
  }

  contextSection += `Recent messages:\n${formattedMessages}\n\n`;
  contextSection += 'Continue this conversation naturally. Reference previous topics when relevant.\n\n';

  return contextSection;
}

/**
 * Build personalized voice instructions
 */
function buildPersonalizedInstructions(profile, metrics, cognitiveState, persona, messages, rollingSummary = '') {
  const parts = [];

  // 1. Persona section (highest priority, with reinforcement)
  if (persona) {
    parts.push(buildPersonaSection(persona));
  }

  // 2. Conversation context with rolling summary
  if (messages && messages.length > 0) {
    parts.push(buildContextSection(messages, rollingSummary));
  }

  // 3. Learning profile
  const dominantStyle = profile?.dominant_style || profile?.learning_style || 'visual';
  const styleScores = profile?.detected_styles || {};
  const stylePercent = Math.round((styleScores[dominantStyle] || 0.25) * 100);
  const knowledgeLevel = profile?.comprehension_level || 'intermediate';
  const pacePreference = profile?.pace_preference || 'normal';
  const weakTopics = profile?.weak_topics || [];
  const strongTopics = profile?.strong_topics || [];
  const engagementScore = metrics?.engagement?.score || 50;

  // Determine tone based on knowledge level and state
  let tone = 'friendly and clear';
  if (knowledgeLevel === 'advanced') {
    tone = 'precise and technical';
  } else if (knowledgeLevel === 'beginner' || cognitiveState === 'struggling') {
    tone = 'warm, encouraging, and simple';
  }

  // Determine pace guidance
  let paceGuidance = 'at a natural conversational pace';
  if (pacePreference === 'slow' || cognitiveState === 'confused') {
    paceGuidance = 'slowly and clearly, with pauses between concepts';
  } else if (pacePreference === 'fast' && cognitiveState !== 'struggling') {
    paceGuidance = 'efficiently, skipping obvious details';
  }

  // Build weak topics warning
  let topicsGuidance = '';
  if (weakTopics.length > 0) {
    topicsGuidance = `\nWEAK TOPICS (extra support): ${weakTopics.join(', ')}`;
  }
  if (strongTopics.length > 0) {
    topicsGuidance += `\nSTRONG TOPICS (can go faster): ${strongTopics.join(', ')}`;
  }

  // Cognitive state specific guidance
  let stateGuidance = '';
  switch (cognitiveState) {
    case 'struggling':
      stateGuidance = '\nLearner is STRUGGLING: Use simpler words, more examples, step-by-step.';
      break;
    case 'confused':
      stateGuidance = '\nLearner seems CONFUSED: Clarify, use analogies, check understanding.';
      break;
    case 'bored':
      stateGuidance = '\nLearner may be BORED: Ask challenging questions, move to advanced material.';
      break;
    case 'mastering':
      stateGuidance = '\nLearner is MASTERING: Challenge with edge cases and deeper questions.';
      break;
  }

  const learnerSection = `## LEARNER PROFILE
Learning style: ${dominantStyle} (${stylePercent}%)
Knowledge level: ${knowledgeLevel}
Engagement: ${engagementScore}%
Current state: ${cognitiveState}

COMMUNICATION:
- Speak in a ${tone} manner
- Pace: ${paceGuidance}
- Use ${dominantStyle === 'visual' ? 'descriptive imagery ("picture this")' :
        dominantStyle === 'auditory' ? 'rhythmic explanations and verbal emphasis' :
        dominantStyle === 'kinesthetic' ? '"try this" and action words' :
        'clear structured explanations'}
${topicsGuidance}${stateGuidance}

`;

  parts.push(learnerSection);

  // 4. Base voice tutor instructions
  parts.push(`## VOICE RULES
1. Keep responses concise (2-4 sentences unless explaining complex concepts)
2. Check understanding after new concepts
3. If learner struggles, simplify immediately
4. Celebrate progress briefly
5. Never be condescending
6. This is voice - be conversational, not lecture-like
7. Remember context from earlier in our conversation`);

  return parts.join('');
}

/**
 * Session state tracking with message persistence and deduplication
 */
class VoiceSession {
  constructor(userId, conversationId = null, personaId = null) {
    this.userId = userId;
    this.conversationId = conversationId;
    this.personaId = personaId;
    this.profile = null;
    this.metrics = null;
    this.persona = null;
    this.conversationMessages = [];
    this.cognitiveState = 'flow';
    this.currentTopic = null;
    this.transcripts = [];
    this.startTime = Date.now();
    this.interactionCount = 0;

    // Rolling summary for context optimization
    this.rollingSummary = '';
    this.messagesSinceSummaryUpdate = 0;

    // Message deduplication
    this.savedMessageIds = new Set();
    this.pendingTranscripts = new Map(); // item_id -> { text, role, saving: boolean }
  }

  async initialize() {
    const promises = [];

    if (this.userId) {
      promises.push(
        analyzeUserProfile(this.userId).then(p => { this.profile = p; }).catch(() => {}),
        getUserMetrics(this.userId).then(m => { this.metrics = m; }).catch(() => {})
      );
    }

    if (this.conversationId) {
      promises.push(
        getConversationMessages(this.conversationId)
          .then(msgs => {
            this.conversationMessages = msgs;
            // Build initial rolling summary
            this.rollingSummary = buildRollingSummary(msgs);
          })
          .catch(() => {})
      );
    }

    if (this.personaId) {
      promises.push(
        getPersona(this.personaId)
          .then(p => { this.persona = p; })
          .catch(() => {})
      );
    }

    await Promise.all(promises);
    return this;
  }

  /**
   * Get current instructions (for reconnection)
   */
  getCurrentInstructions() {
    return buildPersonalizedInstructions(
      this.profile,
      this.metrics,
      this.cognitiveState,
      this.persona,
      this.conversationMessages,
      this.rollingSummary
    );
  }

  updateCognitiveState(state) {
    if (['struggling', 'confused', 'flow', 'bored', 'mastering'].includes(state)) {
      this.cognitiveState = state;
    }
  }

  addTranscript(text, isUser = true) {
    this.transcripts.push({ text, isUser, timestamp: Date.now() });
    this.interactionCount++;
    this.messagesSinceSummaryUpdate++;

    // Detect topic from transcript
    const detectedTopic = extractTopicFromText(text);
    if (detectedTopic) {
      this.currentTopic = detectedTopic;
    }

    // Update rolling summary periodically
    if (this.messagesSinceSummaryUpdate >= SUMMARY_UPDATE_THRESHOLD) {
      this.updateRollingSummary();
    }
  }

  /**
   * Update rolling summary with recent transcripts
   */
  updateRollingSummary() {
    // Convert voice transcripts to message format for summary
    const voiceMessages = this.transcripts.map(t => ({
      role: t.isUser ? 'user' : 'assistant',
      content: t.text,
    }));

    // Combine with existing conversation messages
    const allMessages = [...this.conversationMessages, ...voiceMessages];

    this.rollingSummary = buildRollingSummary(allMessages, this.rollingSummary);
    this.messagesSinceSummaryUpdate = 0;

    logger.debug('Rolling summary updated', { summaryLength: this.rollingSummary.length });
  }

  /**
   * Save user message with deduplication
   * @param {string} transcript - The transcript text
   * @param {string} itemId - Unique item ID from the API for deduplication
   */
  async saveUserMessage(transcript, itemId = null) {
    if (!this.conversationId || !transcript) return null;

    // Deduplication: check if we've already saved this
    const dedupeKey = itemId || `user_${transcript.slice(0, 50)}_${Date.now()}`;
    if (this.savedMessageIds.has(dedupeKey)) {
      logger.debug('Skipping duplicate user message', { dedupeKey: dedupeKey.slice(0, 20) });
      return null;
    }

    // Check if we're already saving this
    if (this.pendingTranscripts.has(dedupeKey)) {
      return null;
    }

    this.pendingTranscripts.set(dedupeKey, { text: transcript, role: 'user', saving: true });

    try {
      const message = await addMessage(
        this.conversationId,
        'user',
        transcript,
        { source: 'voice', sessionId: this.startTime, voiceItemId: itemId }
      );

      if (message?.id) {
        this.savedMessageIds.add(dedupeKey);
        logger.debug({ messageId: message.id }, 'Voice user message saved');
      }

      this.pendingTranscripts.delete(dedupeKey);
      return message;
    } catch (err) {
      this.pendingTranscripts.delete(dedupeKey);
      logger.warn('Failed to save voice user message:', err.message);
      return null;
    }
  }

  /**
   * Save assistant message with deduplication
   * @param {string} transcript - The transcript text
   * @param {string} itemId - Unique item ID from the API for deduplication
   */
  async saveAssistantMessage(transcript, itemId = null) {
    if (!this.conversationId || !transcript) return null;

    // Deduplication
    const dedupeKey = itemId || `assistant_${transcript.slice(0, 50)}_${Date.now()}`;
    if (this.savedMessageIds.has(dedupeKey)) {
      logger.debug('Skipping duplicate assistant message', { dedupeKey: dedupeKey.slice(0, 20) });
      return null;
    }

    if (this.pendingTranscripts.has(dedupeKey)) {
      return null;
    }

    this.pendingTranscripts.set(dedupeKey, { text: transcript, role: 'assistant', saving: true });

    try {
      const message = await addMessage(
        this.conversationId,
        'assistant',
        transcript,
        { source: 'voice', sessionId: this.startTime, voiceItemId: itemId }
      );

      if (message?.id) {
        this.savedMessageIds.add(dedupeKey);
        logger.debug({ messageId: message.id }, 'Voice assistant message saved');
      }

      this.pendingTranscripts.delete(dedupeKey);
      return message;
    } catch (err) {
      this.pendingTranscripts.delete(dedupeKey);
      logger.warn('Failed to save voice assistant message:', err.message);
      return null;
    }
  }

  // Detect cognitive state from user behavior
  detectCognitiveState() {
    const recentTranscripts = this.transcripts.slice(-5);
    const userTranscripts = recentTranscripts.filter(t => t.isUser);

    // Check for confusion indicators
    const confusionPhrases = ['i don\'t understand', 'confused', 'what do you mean', 'can you explain', 'huh', 'wait'];
    const hasConfusion = userTranscripts.some(t =>
      confusionPhrases.some(phrase => t.text.toLowerCase().includes(phrase))
    );

    if (hasConfusion) {
      this.cognitiveState = 'confused';
      return 'confused';
    }

    // Check for struggle indicators
    const repeatCount = userTranscripts.filter(t =>
      this.currentTopic && t.text.toLowerCase().includes(this.currentTopic)
    ).length;

    if (repeatCount >= 3) {
      this.cognitiveState = 'struggling';
      return 'struggling';
    }

    // Check for mastery indicators
    const masteryPhrases = ['i get it', 'makes sense', 'got it', 'understood', 'clear now'];
    const hasMastery = userTranscripts.some(t =>
      masteryPhrases.some(phrase => t.text.toLowerCase().includes(phrase))
    );

    if (hasMastery) {
      this.cognitiveState = 'mastering';
      return 'mastering';
    }

    // Check for boredom
    const boredPhrases = ['boring', 'i know this', 'already know', 'too easy', 'next'];
    const isBored = userTranscripts.some(t =>
      boredPhrases.some(phrase => t.text.toLowerCase().includes(phrase))
    );

    if (isBored) {
      this.cognitiveState = 'bored';
      return 'bored';
    }

    this.cognitiveState = 'flow';
    return 'flow';
  }

  async recordState() {
    if (!this.userId || !this.currentTopic) return;

    try {
      await recordTopicState(this.userId, this.currentTopic, this.cognitiveState, {
        effectiveness: this.cognitiveState === 'mastering' ? 0.9 :
                       this.cognitiveState === 'flow' ? 0.7 :
                       this.cognitiveState === 'confused' ? 0.4 : 0.3,
        engagement: Math.min(1, this.interactionCount / 10),
      }, {
        source: 'voice',
        sessionDuration: Date.now() - this.startTime,
      });
    } catch (err) {
      logger.warn('Failed to record voice session state:', err.message);
    }
  }
}

/**
 * Create and manage realtime voice proxy connection
 * @param {WebSocket} clientWs - Client WebSocket connection
 * @param {string} requestUrl - Original request URL
 * @param {Object} user - Authenticated user from token verification
 */
export function createRealtimeProxy(clientWs, requestUrl, user = null) {
  // Extract parameters from URL
  const params = extractParams(requestUrl);

  // Use authenticated userId if available
  const userId = user?.userId || params.userId;
  const conversationId = params.conversationId;
  const personaId = params.personaId;

  const session = new VoiceSession(userId, conversationId, personaId);

  let azureWs = null;
  let isClosing = false;
  let currentItemId = null; // Track current conversation item for deduplication

  // Initialize session with personalization data
  session.initialize().then(() => {
    logger.info({
      userId: userId?.slice(0, 8),
      conversationId: conversationId?.slice(0, 8),
      hasPersona: !!session.persona,
      messageCount: session.conversationMessages.length,
      hasSummary: !!session.rollingSummary,
    }, 'Voice session initialized');

    // Connect to Azure Realtime API
    const azureTarget = buildAzureRealtimeTarget();
    const azureUrl = azureTarget?.url;
    const realtimeMode = azureTarget?.mode || 'preview';
    const realtimeDeployment = azureTarget?.deployment || DEFAULT_PREVIEW_DEPLOYMENT;
    const apiKey = config.azure.realtimeApiKey || process.env.AZURE_OPENAI_API_KEY;

    if (!azureUrl) {
      logger.error('Azure Realtime endpoint not configured');
      clientWs.send(JSON.stringify({
        type: 'error',
        error: { message: 'Voice service endpoint not configured' }
      }));
      clientWs.close();
      return;
    }

    if (!apiKey) {
      logger.error('Azure Realtime API key not set');
      clientWs.send(JSON.stringify({
        type: 'error',
        error: { message: 'Voice service not configured' }
      }));
      clientWs.close();
      return;
    }

    logger.info({ azureUrl, realtimeMode, realtimeDeployment }, 'Connecting to Azure Realtime API');

    // GA protocol: api-key header only, no OpenAI-Beta header needed
    azureWs = new WebSocket(azureUrl, {
      headers: {
        'api-key': apiKey,
      },
    });

    azureWs.on('open', () => {
      logger.info('Connected to Azure Realtime API successfully');
      clientWs.send(JSON.stringify({
        type: 'visualearn.realtime_mode',
        mode: realtimeMode,
        deployment: realtimeDeployment,
      }));
    });

    // Handle non-101 responses (auth failures, wrong endpoint, etc.)
    azureWs.on('unexpected-response', (req, res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        logger.error({
          statusCode: res.statusCode,
          statusMessage: res.statusMessage,
          headers: res.headers,
          body: body.slice(0, 500),
        }, 'Azure Realtime unexpected response');
        clientWs.send(JSON.stringify({
          type: 'error',
          error: { message: `Azure rejected connection: ${res.statusCode} ${res.statusMessage}` }
        }));
        clientWs.close();
      });
    });

    azureWs.on('message', (data) => {
      if (isClosing) return;

      try {
        const message = JSON.parse(data.toString());

        // Intercept session.created to inject personalized instructions
        if (message.type === 'session.created') {
          logger.info({ sessionId: message.session?.id }, 'Azure session created, injecting personalization');

          // Build personalized instructions with context, persona, and summary
          const instructions = session.getCurrentInstructions();

          // Keep session payload aligned with the selected Azure realtime protocol.
          const sessionPayload = realtimeMode === 'translation'
            ? {
                audio: {
                  output: {
                    language: process.env.AZURE_REALTIME_TRANSLATION_LANGUAGE || 'en',
                  },
                },
              }
            : realtimeMode === 'ga'
              ? {
                  instructions: instructions,
                  audio: {
                    input: {
                      format: 'pcm16',
                      transcription: {
                        model: DEFAULT_TRANSCRIPTION_MODEL,
                      },
                      turn_detection: {
                        type: 'server_vad',
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500,
                        create_response: true,
                      },
                    },
                    output: {
                      format: 'pcm16',
                      voice: process.env.AZURE_REALTIME_VOICE || 'alloy',
                    },
                  },
                }
              : {
                  voice: process.env.AZURE_REALTIME_VOICE || 'alloy',
                  instructions: instructions,
                  modalities: ['text', 'audio'],
                  input_audio_format: 'pcm16',
                  output_audio_format: 'pcm16',
                  input_audio_transcription: {
                    model: DEFAULT_TRANSCRIPTION_MODEL,
                  },
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                    create_response: true,
                  },
                };

          const sessionUpdate = {
            type: 'session.update',
            session: sessionPayload,
          };

          logger.debug({ sessionUpdate: JSON.stringify(sessionUpdate).slice(0, 200) }, 'Sending session.update');
          azureWs.send(JSON.stringify(sessionUpdate));

          // Also forward to client
          clientWs.send(data.toString());
          return;
        }

        // Track conversation item creation for deduplication
        if (message.type === 'conversation.item.created') {
          currentItemId = message.item?.id || null;
        }

        // Intercept transcription to track and save immediately (with deduplication)
        if (message.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = message.transcript;
          const itemId = message.item_id || currentItemId;

          if (transcript) {
            session.addTranscript(transcript, true);

            // Save user message with deduplication
            session.saveUserMessage(transcript, itemId).then(savedMsg => {
              if (savedMsg) {
                // Send message ID back to client
                clientWs.send(JSON.stringify({
                  type: 'visualearn.message_saved',
                  role: 'user',
                  messageId: savedMsg.id,
                  transcript,
                  itemId,
                }));
              }
            });

            // Detect cognitive state from conversation
            const newState = session.detectCognitiveState();
            logger.debug(`Cognitive state: ${newState}, Topic: ${session.currentTopic}`);
          }
        }

        // Track AI responses and save immediately (with deduplication)
        if (message.type === 'response.audio_transcript.done') {
          const transcript = message.transcript;
          const itemId = message.item_id || `response_${Date.now()}`;

          if (transcript) {
            session.addTranscript(transcript, false);

            // Save assistant message with deduplication
            session.saveAssistantMessage(transcript, itemId).then(savedMsg => {
              if (savedMsg) {
                // Send message ID back to client
                clientWs.send(JSON.stringify({
                  type: 'visualearn.message_saved',
                  role: 'assistant',
                  messageId: savedMsg.id,
                  transcript,
                  itemId,
                }));
              }
            });
          }
        }

        // Forward all messages to client
        clientWs.send(data.toString());

      } catch (err) {
        // Non-JSON message, forward as-is
        clientWs.send(data);
      }
    });

    azureWs.on('error', (err) => {
      logger.error({
        message: err.message,
        code: err.code,
        errno: err.errno,
        syscall: err.syscall,
        address: err.address,
      }, 'Azure Realtime WebSocket error');
      if (!isClosing) {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: { message: 'Voice service error' }
        }));
      }
    });

    azureWs.on('close', (code, reason) => {
      logger.info({ code, reason: reason?.toString() }, 'Azure Realtime connection closed');
      // Record session state before closing
      session.recordState();
      if (!isClosing) {
        clientWs.close();
      }
    });
  });

  // Forward client messages to Azure
  clientWs.on('message', (data) => {
    if (azureWs?.readyState === WebSocket.OPEN) {
      azureWs.send(data);
    }
  });

  // Handle client disconnect
  clientWs.on('close', () => {
    isClosing = true;
    logger.info('Client disconnected, closing Azure connection');
    session.recordState();
    if (azureWs?.readyState === WebSocket.OPEN) {
      azureWs.close();
    }
  });

  clientWs.on('error', (err) => {
    logger.error('Client WebSocket error:', err.message);
    isClosing = true;
    if (azureWs?.readyState === WebSocket.OPEN) {
      azureWs.close();
    }
  });

  return session;
}

export default createRealtimeProxy;
