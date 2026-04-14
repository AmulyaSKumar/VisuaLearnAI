/**
 * Realtime Voice Proxy with Personalization
 * Proxies WebSocket connections to Azure/OpenAI Realtime API
 * Injects personalization context for adaptive voice tutoring
 */

import { WebSocket } from 'ws';
import { logger } from '../utils/logger.js';
import { analyzeUserProfile, getUserMetrics, recordTopicState, adaptivePolicy, getTopicHistory } from '../agents/personalization.js';
import { config } from '../config/environment.js';

// Azure OpenAI Realtime endpoint
const AZURE_REALTIME_URL = process.env.AZURE_OPENAI_REALTIME_URL ||
  `wss://${process.env.AZURE_OPENAI_ENDPOINT?.replace('https://', '')}/openai/realtime?api-version=2024-10-01-preview&deployment=gpt-realtime-1.5`;

/**
 * Extract userId from WebSocket URL query params
 */
function extractUserId(url) {
  try {
    const urlObj = new URL(url, 'ws://localhost');
    return urlObj.searchParams.get('userId');
  } catch {
    return null;
  }
}

/**
 * Extract topic from transcribed text
 */
function extractTopicFromText(text) {
  if (!text) return null;

  const lowerText = text.toLowerCase();

  // Topic extraction patterns
  const patterns = [
    /(?:about|learn|understand|explain|help with|teach me|what is|how does)\s+([a-z\s]{3,30})/i,
    /\b(math|mathematics|algebra|calculus|geometry|physics|chemistry|biology|history|programming|javascript|python|react|css|html|database|sql|machine learning|ai|data science|recursion|loops|functions|variables|arrays)\b/i,
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
 * Build personalized voice instructions
 */
function buildPersonalizedInstructions(profile, metrics, cognitiveState) {
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
    topicsGuidance = `\n\nIMPORTANT WEAK TOPICS (provide extra support): ${weakTopics.join(', ')}`;
  }
  if (strongTopics.length > 0) {
    topicsGuidance += `\n\nSTRONG TOPICS (can go faster): ${strongTopics.join(', ')}`;
  }

  // Cognitive state specific guidance
  let stateGuidance = '';
  switch (cognitiveState) {
    case 'struggling':
      stateGuidance = '\n\nThe learner is STRUGGLING. Use maximum support: simpler words, more examples, step-by-step explanations. Be patient and encouraging.';
      break;
    case 'confused':
      stateGuidance = '\n\nThe learner seems CONFUSED. Clarify misconceptions, use analogies, and check understanding frequently. Ask "Does that make sense?" after key points.';
      break;
    case 'bored':
      stateGuidance = '\n\nThe learner may be BORED. Increase engagement: ask challenging questions, introduce interesting facts, or offer to move to more advanced material.';
      break;
    case 'mastering':
      stateGuidance = '\n\nThe learner is MASTERING this topic. Challenge them with edge cases, deeper questions, or connections to advanced concepts.';
      break;
    case 'flow':
    default:
      stateGuidance = '\n\nThe learner is in good FLOW. Maintain current approach and keep momentum.';
      break;
  }

  return `You are VisuaLearn AI, an adaptive voice tutor that personalizes explanations in real-time.

LEARNER PROFILE:
- Learning style: ${dominantStyle} (${stylePercent}% preference)
- Knowledge level: ${knowledgeLevel}
- Engagement: ${engagementScore}%
- Current state: ${cognitiveState}

COMMUNICATION STYLE:
- Speak in a ${tone} manner
- Pace: ${paceGuidance}
- Use ${dominantStyle === 'visual' ? 'descriptive imagery and "picture this" language' :
        dominantStyle === 'auditory' ? 'rhythmic explanations and verbal emphasis' :
        dominantStyle === 'kinesthetic' ? '"try this" and hands-on action words' :
        'clear structured explanations with definitions'}
${topicsGuidance}
${stateGuidance}

RULES:
1. Keep responses concise (2-4 sentences max unless explaining complex concepts)
2. Always check understanding after explaining new concepts
3. If the learner struggles, simplify immediately
4. Celebrate progress with brief positive reinforcement
5. Never be condescending or overly repetitive`;
}

/**
 * Session state tracking
 */
class VoiceSession {
  constructor(userId) {
    this.userId = userId;
    this.profile = null;
    this.metrics = null;
    this.cognitiveState = 'flow';
    this.currentTopic = null;
    this.transcripts = [];
    this.startTime = Date.now();
    this.interactionCount = 0;
  }

  async initialize() {
    if (this.userId) {
      this.profile = await analyzeUserProfile(this.userId);
      this.metrics = await getUserMetrics(this.userId);
    }
    return this;
  }

  updateCognitiveState(state) {
    if (['struggling', 'confused', 'flow', 'bored', 'mastering'].includes(state)) {
      this.cognitiveState = state;
    }
  }

  addTranscript(text, isUser = true) {
    this.transcripts.push({ text, isUser, timestamp: Date.now() });
    this.interactionCount++;

    // Detect topic from transcript
    const detectedTopic = extractTopicFromText(text);
    if (detectedTopic) {
      this.currentTopic = detectedTopic;
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

    // Check for struggle indicators (repeated questions on same topic)
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
  // Use authenticated userId if available, otherwise extract from URL
  const userId = user?.userId || extractUserId(requestUrl);
  const session = new VoiceSession(userId);

  let azureWs = null;
  let isClosing = false;

  // Initialize session with personalization data
  session.initialize().then(() => {
    logger.info(`🎙️ Voice session initialized for user: ${userId || 'anonymous'}`);

    // Connect to Azure Realtime API
    const azureUrl = AZURE_REALTIME_URL;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;

    if (!apiKey) {
      logger.error('AZURE_OPENAI_API_KEY not set');
      clientWs.send(JSON.stringify({
        type: 'error',
        error: { message: 'Voice service not configured' }
      }));
      return;
    }

    azureWs = new WebSocket(azureUrl, {
      headers: {
        'api-key': apiKey,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    azureWs.on('open', () => {
      logger.info('🎙️ Connected to Azure Realtime API');
    });

    azureWs.on('message', (data) => {
      if (isClosing) return;

      try {
        const message = JSON.parse(data.toString());

        // Intercept session.created to inject personalized instructions
        if (message.type === 'session.created') {
          logger.info('🎙️ Azure session created, injecting personalization');

          // Build personalized instructions
          const instructions = buildPersonalizedInstructions(
            session.profile,
            session.metrics,
            session.cognitiveState
          );

          // Send session.update with personalized instructions
          const sessionUpdate = {
            type: 'session.update',
            session: {
              voice: 'alloy',
              instructions: instructions,
              modalities: ['text', 'audio'],
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              input_audio_transcription: { model: 'whisper-1' },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                create_response: true,
              },
            },
          };

          azureWs.send(JSON.stringify(sessionUpdate));

          // Also forward to client
          clientWs.send(data.toString());
          return;
        }

        // Intercept transcription to track conversation and detect state
        if (message.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = message.transcript;
          if (transcript) {
            session.addTranscript(transcript, true);

            // Detect cognitive state from conversation
            const newState = session.detectCognitiveState();
            logger.debug(`🎙️ Cognitive state: ${newState}, Topic: ${session.currentTopic}`);

            // If state changed significantly, could send updated instructions
            // (for now, just track it)
          }
        }

        // Track AI responses
        if (message.type === 'response.audio_transcript.done') {
          const transcript = message.transcript;
          if (transcript) {
            session.addTranscript(transcript, false);
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
      logger.error('Azure Realtime error:', err.message);
      if (!isClosing) {
        clientWs.send(JSON.stringify({
          type: 'error',
          error: { message: 'Voice service error' }
        }));
      }
    });

    azureWs.on('close', () => {
      logger.info('🎙️ Azure Realtime connection closed');
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
    logger.info('🎙️ Client disconnected, closing Azure connection');
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
