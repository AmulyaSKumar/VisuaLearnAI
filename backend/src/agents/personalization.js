/**
 * Personalization Agent (Day 2)
 * Detects learning style and personalizes content based on user behavior
 * @module agents/personalization
 */

import { BaseAgent } from './base-agent.js';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { supabase } from '../database/client.js';

export class PersonalizationAgent extends BaseAgent {
  constructor() {
    super(
      'personalization',
      'Detects learning style and personalizes content based on user interactions',
      '1.0.0'
    );
  }

  /**
   * Analyze user behavior and detect learning style
   * @param {Object} input - { userId: string, interactions?: Array, topicsOfInterest?: Array }
   * @param {Object} context - { userProfile?: Object }
   * @returns {Object} Updated profile with detected learning style and preferences
   */
  async execute(input, context = {}) {
    this.validateInput(input, ['userId']);

    const {
      userId,
      interactions = [],
      topicsOfInterest = [],
      strugglingTopics = [],
    } = input;
    const { userProfile = {} } = context;

    logger.info('Personalization: Analyzing user behavior', { userId });

    try {
      // Analyze interactions and detect learning style (with decay from previous scores)
      const previousScores = userProfile.styleScores || null;
      const styleAnalysis = this._analyzeInteractions(interactions, previousScores);

      // Detect comprehension level from interactions
      const comprehensionLevel = this._assessComprehensionLevel(interactions);

      // Get personalization recommendations from Claude
      const recommendations = await this._getRecommendationsFromClaude({
        userId,
        styleAnalysis,
        topicsOfInterest,
        strugglingTopics,
        comprehensionLevel,
        currentProfile: userProfile,
      });

      // Build updated profile
      const updatedProfile = {
        ...userProfile,
        primaryStyle: styleAnalysis.primaryStyle,
        styleScores: styleAnalysis.scores,
        comprehension: {
          currentLevel: comprehensionLevel,
          bySubject: recommendations.subjectLevels || {},
        },
        language: {
          preferred: userProfile.language?.preferred || 'en',
          autoTranslate: false,
        },
        engagement: {
          topicsOfInterest,
          strugglingTopics,
          pacePref: recommendations.pacePref || 'normal',
        },
        personalizationUpdatedAt: new Date().toISOString(),
      };

      logger.info('Personalization: Analysis complete', {
        userId,
        style: styleAnalysis.primaryStyle,
        level: comprehensionLevel,
      });

      return {
        userId,
        profile: updatedProfile,
        recommendations: {
          contentType: recommendations.contentType,
          examples: recommendations.examples,
          visualizations: recommendations.visualizations,
          pace: recommendations.pacePref,
        },
        analysisDetails: {
          styleScores: styleAnalysis.scores,
          interactionCount: interactions.length,
          topicsCount: topicsOfInterest.length,
        },
      };
    } catch (error) {
      logger.error('Personalization: Analysis failed', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Analyze user interactions to detect learning style
   * VARK model: Visual, Auditory, Reading/Writing, Kinesthetic
   * @param {Array} interactions - user interactions to analyze
   * @param {Object|null} previousScores - previous style scores for decay calculation
   */
  _analyzeInteractions(interactions = [], previousScores = null) {
    const DECAY_RATE = 0.05; // 5% decay per update cycle
    const RECENCY_THRESHOLD = 10; // Last 10 interactions get 2x weight

    // Initialize scores with decay from previous scores
    let scores = {
      visual: 0,
      auditory: 0,
      reading: 0,
      kinesthetic: 0,
    };

    // Apply 5% decay to previous scores if they exist
    if (previousScores) {
      Object.keys(scores).forEach(style => {
        if (previousScores[style]) {
          scores[style] = previousScores[style] * (1 - DECAY_RATE);
        }
      });
    }

    if (!interactions || interactions.length === 0) {
      // If no interactions but have previous scores, normalize and return
      if (previousScores) {
        const total = Object.values(scores).reduce((a, b) => a + b, 0);
        if (total > 0) {
          Object.keys(scores).forEach(style => {
            scores[style] = scores[style] / total;
          });
        } else {
          scores = { visual: 0.25, auditory: 0.25, reading: 0.25, kinesthetic: 0.25 };
        }
        const [primaryStyle] = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
        return {
          dominant_style: primaryStyle,
          scores,
          primaryStyle,
          confidence: 0,
        };
      }
      // Default equal distribution for new users
      return {
        dominant_style: 'visual',
        scores: { visual: 0.25, auditory: 0.25, reading: 0.25, kinesthetic: 0.25 },
        primaryStyle: 'visual',
        confidence: 0,
      };
    }

    // Analyze interaction patterns with recency weighting
    const totalInteractions = interactions.length;
    interactions.forEach((interaction, index) => {
      if (!interaction.type) return;

      // Recency weighting: last 10 interactions get 2x weight
      const isRecent = index >= totalInteractions - RECENCY_THRESHOLD;
      const weight = isRecent ? 2 : 1;
      const baseScore = 2 * weight; // Base +2 multiplied by recency weight

      switch (interaction.type.toLowerCase()) {
        case 'widget':
        case 'visualization':
        case 'image':
        case 'diagram':
        case 'chart':
          scores.visual += baseScore;
          break;

        case 'audio':
        case 'video':
        case 'voice':
          scores.auditory += baseScore;
          break;

        case 'text':
        case 'article':
        case 'reading':
          scores.reading += baseScore;
          break;

        case 'interactive':
        case 'simulation':
        case 'practice':
        case 'experiment':
          scores.kinesthetic += baseScore;
          break;
      }
    });

    // Normalize scores to sum = 1.0
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const normalized = {};
    Object.keys(scores).forEach(style => {
      normalized[style] = total > 0 ? scores[style] / total : 0.25;
    });

    // Determine primary/dominant style
    const [dominantStyle] = Object.entries(normalized).sort(([, a], [, b]) => b - a)[0];

    // Calculate confidence (how dominant is primary style)
    const sortedScores = Object.values(normalized).sort((a, b) => b - a);
    const secondaryScore = sortedScores[1];
    const confidence = Math.max(0, (normalized[dominantStyle] - secondaryScore) * 100);

    return {
      dominant_style: dominantStyle,
      scores: normalized,
      primaryStyle: dominantStyle, // Maintain backwards compatibility
      confidence,
    };
  }

  /**
   * Assess comprehension level based on interactions and topics
   */
  _assessComprehensionLevel(interactions = []) {
    if (!interactions || interactions.length === 0) {
      return 'intermediate';
    }

    // Simple heuristic: more interactions = higher comprehension attempt
    // This would be replaced with actual Claude analysis
    const interactionCount = interactions.length;

    if (interactionCount < 3) return 'beginner';
    if (interactionCount < 10) return 'intermediate';
    return 'advanced';
  }

  /**
   * Get personalization recommendations from Claude
   */
  async _getRecommendationsFromClaude(analysisData) {
    try {
      const { Anthropic } = await import('@anthropic-ai/sdk');

      const client = new Anthropic({
        apiKey: config.anthropic.apiKey,
        baseURL: config.anthropic.baseUrl,
      });

      const prompt = this._buildPersonalizationPrompt(analysisData);

      // Use fast model (haiku) for personalization - quick recommendation generation
      const message = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseText = message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Return sensible defaults if parsing fails
        return {
          contentType: 'mixed',
          examples: true,
          visualizations: true,
          pacePref: 'normal',
          subjectLevels: {},
        };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      logger.warn('Personalization: Claude recommendation failed, using defaults', {
        error: error.message,
      });

      // Return sensible defaults
      return {
        contentType: 'mixed',
        examples: true,
        visualizations: true,
        pacePref: 'normal',
        subjectLevels: {},
      };
    }
  }

  /**
   * Build prompt for Claude to generate personalization recommendations
   */
  _buildPersonalizationPrompt(analysisData) {
    const {
      styleAnalysis,
      topicsOfInterest,
      strugglingTopics,
      comprehensionLevel,
      currentProfile,
    } = analysisData;

    return `You are a learning personalization expert. Based on user behavior, provide recommendations for personalized learning content.

USER LEARNING PROFILE:
- Primary Learning Style: ${styleAnalysis.primaryStyle} (${(styleAnalysis.scores[styleAnalysis.primaryStyle] * 100).toFixed(0)}% confidence)
- Style Distribution: Visual ${(styleAnalysis.scores.visual * 100).toFixed(0)}%, Auditory ${(styleAnalysis.scores.auditory * 100).toFixed(0)}%, Reading ${(styleAnalysis.scores.reading * 100).toFixed(0)}%, Kinesthetic ${(styleAnalysis.scores.kinesthetic * 100).toFixed(0)}%
- Comprehension Level: ${comprehensionLevel}
- Topics of Interest: ${topicsOfInterest.join(', ') || 'none yet'}
- Struggling Topics: ${strugglingTopics.join(', ') || 'none'}

Provide recommendations in JSON format:
{
  "contentType": "which content format to prioritize (visual, auditory, text, interactive, mixed)",
  "examples": "should we include real-world examples (true/false)",
  "visualizations": "should we generate interactive visualizations (true/false)",
  "pacePref": "recommended pace (slow, normal, fast)",
  "subjectLevels": {
    "topic_name": "beginner/intermediate/advanced"
  }
}

Be concise and practical in your recommendations.`;
  }

  /**
   * Lifecycle hook: Validate user ID
   */
  async beforeExecute(input, context) {
    logger.debug(`[${this.name}] Starting personalization analysis...`, {
      userId: input.userId,
    });
    return { input, context };
  }

  /**
   * Lifecycle hook: Validate profile quality
   */
  async afterExecute(result, context) {
    const profile = result.profile;

    // Ensure required fields
    if (!profile.primaryStyle || !profile.styleScores) {
      throw new Error('Invalid profile: missing style information');
    }

    logger.info(`[${this.name}] Profile validation passed`, {
      style: profile.primaryStyle,
    });

    return result;
  }
}

export default PersonalizationAgent;

// =============================================================================
// LIGHTWEIGHT HELPER FUNCTIONS (for direct use in chat pipeline)
// =============================================================================

/**
 * Fetch and analyze user profile from Supabase (fast, no LLM)
 * @param {string} userId
 * @param {Array} interactions - optional recent interactions for confidence calculation
 * @returns {Promise<Object>} { scores, dominant_style, confidence_score, learning_style, knowledge_level, preferences, styleScores }
 */
export async function analyzeUserProfile(userId, interactions = []) {
  if (!userId) {
    return getDefaultProfile();
  }

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return getDefaultProfile();
    }

    // Parse detected_styles (stored as JSONB)
    const styleScores = data.detected_styles || {
      visual: 0.25,
      auditory: 0.25,
      reading: 0.25,
      kinesthetic: 0.25,
    };

    // Determine primary/dominant style
    const primaryStyle = Object.entries(styleScores)
      .sort(([, a], [, b]) => b - a)[0][0];

    // Calculate confidence score from stored value or interactions
    let confidenceScore = data.confidence_score ?? 0.0;
    if (interactions.length > 0) {
      confidenceScore = calculateConfidenceScore(interactions, styleScores);
    }

    return {
      dominant_style: primaryStyle,
      scores: styleScores,
      confidence_score: confidenceScore,
      learning_style: primaryStyle, // Backwards compatibility
      knowledge_level: data.comprehension_level || 'intermediate',
      preferences: {
        pace: data.pace_preference || 'normal',
        language: data.preferred_language || 'en',
        detailLevel: data.pace_preference === 'fast' ? 'concise' : 'detailed',
      },
      styleScores, // Backwards compatibility
      raw: data,
    };
  } catch (err) {
    logger.warn('analyzeUserProfile failed, using defaults', { userId, error: err.message });
    return getDefaultProfile();
  }
}

/**
 * Default profile for anonymous/new users
 */
function getDefaultProfile() {
  const defaultScores = {
    visual: 0.25,
    auditory: 0.25,
    reading: 0.25,
    kinesthetic: 0.25,
  };
  return {
    dominant_style: 'visual',
    scores: defaultScores,
    confidence_score: 0.0,
    learning_style: 'visual', // Backwards compatibility
    knowledge_level: 'intermediate',
    preferences: {
      pace: 'normal',
      language: 'en',
      detailLevel: 'detailed',
    },
    styleScores: defaultScores, // Backwards compatibility
    raw: null,
  };
}

/**
 * Calculate confidence score based on interaction consistency
 * @param {Array} interactions - last N interactions to analyze
 * @param {Object} scores - current style scores
 * @returns {number} confidence score between 0 and 1
 */
function calculateConfidenceScore(interactions = [], scores = {}) {
  if (!interactions || interactions.length < 3) {
    return 0.0; // Not enough data
  }

  const dominantStyle = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  if (!dominantStyle) return 0.0;

  // Map interaction types to learning styles
  const typeToStyle = {
    widget: 'visual',
    visualization: 'visual',
    image: 'visual',
    diagram: 'visual',
    chart: 'visual',
    audio: 'auditory',
    video: 'auditory',
    voice: 'auditory',
    text: 'reading',
    article: 'reading',
    reading: 'reading',
    interactive: 'kinesthetic',
    simulation: 'kinesthetic',
    practice: 'kinesthetic',
    experiment: 'kinesthetic',
  };

  // Analyze last 10 interactions for consistency
  const recentInteractions = interactions.slice(-10);
  let consistentCount = 0;
  let conflictingCount = 0;

  recentInteractions.forEach(interaction => {
    const type = (interaction.type || '').toLowerCase();
    const mappedStyle = typeToStyle[type];

    if (mappedStyle === dominantStyle) {
      consistentCount++;
    } else if (mappedStyle && mappedStyle !== dominantStyle) {
      conflictingCount++;
    }
  });

  // Calculate confidence: consistent behavior increases, conflicting decreases
  const totalMapped = consistentCount + conflictingCount;
  if (totalMapped === 0) return 0.0;

  // Base confidence from consistency ratio
  let confidence = consistentCount / totalMapped;

  // Penalize for conflicting signals
  if (conflictingCount > consistentCount) {
    confidence *= 0.5; // Halve confidence if more conflicts than consistents
  }

  // Boost if very consistent (>80% consistent)
  if (totalMapped >= 5 && (consistentCount / totalMapped) > 0.8) {
    confidence = Math.min(1.0, confidence * 1.2);
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Adjust user profile based on negative feedback signals
 * Detects: quick skips, ignored widgets, repeated confusion
 * @param {Object} profile - current user profile
 * @param {Object} feedbackSignals - { responseTime, widgetInteracted, messageContent, previousMessages }
 * @returns {Object} adjusted profile with modified scores
 */
export function adjustProfileFromFeedback(profile, feedbackSignals = {}) {
  const {
    responseTime = null,     // ms since response shown
    widgetInteracted = true, // did user interact with widget?
    messageContent = '',     // user's message content
    previousMessages = [],   // recent messages for pattern detection
  } = feedbackSignals;

  const QUICK_SKIP_THRESHOLD = 2000; // 2 seconds
  const WEIGHT_REDUCTION = 0.05;     // 5% reduction per negative signal

  const scores = { ...(profile?.scores || profile?.styleScores || {
    visual: 0.25,
    auditory: 0.25,
    reading: 0.25,
    kinesthetic: 0.25,
  })};
  const dominantStyle = profile?.dominant_style || 'visual';

  let negativeSignals = 0;
  let adjustmentReason = [];

  // Signal 1: Quick skip (user didn't engage with response)
  if (responseTime !== null && responseTime < QUICK_SKIP_THRESHOLD) {
    negativeSignals++;
    adjustmentReason.push('quick_skip');
  }

  // Signal 2: Widget ignored (visual content not interacted with)
  if (widgetInteracted === false && dominantStyle === 'visual') {
    negativeSignals++;
    adjustmentReason.push('widget_ignored');
  }

  // Signal 3: Repeated confusion phrases
  const confusionPhrases = [
    "i don't understand",
    "i dont understand",
    "confused",
    "what do you mean",
    "can you explain",
    "still don't get",
    "makes no sense",
    "too complicated",
    "too complex",
  ];
  const lowerContent = messageContent.toLowerCase();
  const hasConfusion = confusionPhrases.some(phrase => lowerContent.includes(phrase));

  // Check if confusion is repeated (appears in recent messages too)
  const recentConfusion = previousMessages.filter(msg => {
    const text = (msg.content || '').toLowerCase();
    return confusionPhrases.some(phrase => text.includes(phrase));
  }).length;

  if (hasConfusion && recentConfusion >= 1) {
    negativeSignals++;
    adjustmentReason.push('repeated_confusion');
  }

  // Apply adjustments if negative signals detected
  if (negativeSignals > 0) {
    // Reduce dominant style weight
    const reduction = WEIGHT_REDUCTION * negativeSignals;
    scores[dominantStyle] = Math.max(0.1, scores[dominantStyle] - reduction);

    // Redistribute to other styles proportionally
    const otherStyles = Object.keys(scores).filter(s => s !== dominantStyle);
    const redistributeEach = reduction / otherStyles.length;
    otherStyles.forEach(style => {
      scores[style] = Math.min(0.9, scores[style] + redistributeEach);
    });

    // Normalize to sum = 1
    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    Object.keys(scores).forEach(style => {
      scores[style] = scores[style] / total;
    });

    // Recalculate dominant style after adjustment
    const newDominant = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0][0];

    logger.debug('Adjusted profile from feedback', {
      negativeSignals,
      reasons: adjustmentReason,
      oldDominant: dominantStyle,
      newDominant,
    });

    return {
      ...profile,
      scores,
      styleScores: scores,
      dominant_style: newDominant,
      learning_style: newDominant,
      _feedbackAdjustment: {
        applied: true,
        signals: negativeSignals,
        reasons: adjustmentReason,
      },
    };
  }

  // No adjustment needed
  return {
    ...profile,
    _feedbackAdjustment: {
      applied: false,
      signals: 0,
      reasons: [],
    },
  };
}

/**
 * Detect knowledge level from message history (fast heuristic)
 * @param {Array} messages - conversation messages
 * @returns {'beginner' | 'intermediate' | 'advanced'}
 */
export function detectKnowledgeLevel(messages = []) {
  if (!messages || messages.length === 0) return 'intermediate';

  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) return 'intermediate';

  // Heuristics based on message patterns
  let score = 0;
  const advancedKeywords = /\b(algorithm|complexity|architecture|optimization|async|concurrent|distributed|api|sdk|framework|microservice|kubernetes|docker|cicd|tcp|http|sql|nosql|regex|recursion|polymorphism|inheritance|abstraction)\b/i;
  const beginnerKeywords = /\b(what is|how do i|explain|simple|basic|beginner|help me understand|i don't understand|confused)\b/i;

  userMessages.forEach(msg => {
    const text = msg.content || msg.text || '';

    // Check for technical terms
    if (advancedKeywords.test(text)) score += 2;

    // Check for beginner indicators
    if (beginnerKeywords.test(text)) score -= 1;

    // Longer, structured questions suggest higher level
    if (text.length > 200) score += 1;

    // Code blocks suggest technical user
    if (text.includes('```') || text.includes('function') || text.includes('const ')) score += 2;
  });

  // Normalize
  const avgScore = score / userMessages.length;

  if (avgScore >= 1.5) return 'advanced';
  if (avgScore <= -0.5) return 'beginner';
  return 'intermediate';
}

/**
 * Detect query type from user message
 * @param {string} query - user query text
 * @returns {'definition'|'conceptual'|'advanced'|'general'}
 */
function detectQueryType(query = '') {
  const lowerQuery = query.toLowerCase().trim();

  // Definition-based queries
  const definitionPatterns = [
    /^what is\b/,
    /^what's\b/,
    /^define\b/,
    /^meaning of\b/,
    /^definition of\b/,
    /\bwhat does .+ mean\b/,
  ];
  if (definitionPatterns.some(pattern => pattern.test(lowerQuery))) {
    return 'definition';
  }

  // Conceptual queries (how/why)
  const conceptualPatterns = [
    /^how does\b/,
    /^how do\b/,
    /^how can\b/,
    /^why does\b/,
    /^why do\b/,
    /^why is\b/,
    /^explain how\b/,
    /^explain why\b/,
  ];
  if (conceptualPatterns.some(pattern => pattern.test(lowerQuery))) {
    return 'conceptual';
  }

  // Advanced queries (technical depth indicators)
  const advancedKeywords = /\b(implement|architecture|optimize|algorithm|complexity|performance|scalability|design pattern|trade-off|benchmark|internals|under the hood|deep dive)\b/i;
  if (advancedKeywords.test(lowerQuery)) {
    return 'advanced';
  }

  return 'general';
}

/**
 * Convert user profile into actionable personalization decisions
 * Used in chat pipeline to customize LLM behavior
 * Now context-aware based on query type, confidence score, and evaluation metrics
 * @param {Object} profile - User profile from analyzeUserProfile()
 * @param {string} userQuery - The user's query for context-aware decisions
 * @param {Object} metrics - Optional evaluation metrics { engagement, improvement, satisfaction }
 * @returns {{force_visual: boolean, response_length: 'short'|'medium'|'long', explanation_style: 'simple'|'detailed'|'technical', interaction_mode: 'static'|'interactive', personalization_strength: 'full'|'reduced'|'minimal', add_examples: boolean, preferred_agents: string[]}}
 */
export function getPersonalizationStrategy(profile, userQuery = '', metrics = null) {
  const scores = profile?.scores || profile?.styleScores || {
    visual: 0.25,
    auditory: 0.25,
    reading: 0.25,
    kinesthetic: 0.25,
  };
  const knowledgeLevel = profile?.knowledge_level || 'intermediate';
  const confidenceScore = profile?.confidence_score ?? 0.5;

  // Extract metric scores (default to neutral 50 if not provided)
  const engagementScore = metrics?.engagement?.score ?? 50;
  const improvementScore = metrics?.improvement?.score ?? 50;
  const satisfactionScore = metrics?.satisfaction?.score ?? 50;

  // Detect query type for context-aware decisions
  const queryType = detectQueryType(userQuery);

  // Determine personalization strength based on confidence
  let personalization_strength = 'full';
  if (confidenceScore < 0.4) {
    personalization_strength = 'reduced';
  }
  if (confidenceScore < 0.2) {
    personalization_strength = 'minimal';
  }

  // Base force_visual decision: IF visual > 0.6 → true
  let force_visual = scores.visual > 0.6;

  // Context-aware override: Definition queries should NOT force visual
  if (queryType === 'definition') {
    force_visual = false;
  }

  // Reduce visual forcing if low confidence
  if (personalization_strength !== 'full' && force_visual) {
    force_visual = scores.visual > 0.75; // Raise threshold for low confidence
  }

  // Determine interaction_mode: IF kinesthetic > 0.5 → interactive
  let interaction_mode = scores.kinesthetic > 0.5 ? 'interactive' : 'static';

  // Conceptual queries can allow visual/interactive
  if (queryType === 'conceptual' && scores.kinesthetic > 0.3) {
    interaction_mode = 'interactive';
  }

  // Reduce interactivity for definition queries
  if (queryType === 'definition') {
    interaction_mode = 'static';
  }

  // === METRICS-BASED ADAPTATIONS ===

  // LOW ENGAGEMENT (<40): Reduce response length, increase interactivity
  if (engagementScore < 40) {
    interaction_mode = 'interactive'; // Force interactive to boost engagement
    // Response length will be adjusted below
  }

  // Determine explanation_style based on knowledge level
  let explanation_style;
  if (knowledgeLevel === 'beginner') {
    explanation_style = 'simple';
  } else if (knowledgeLevel === 'advanced') {
    explanation_style = 'technical';
  } else {
    explanation_style = 'detailed';
  }

  // LOW IMPROVEMENT (<50): Simplify explanations
  let add_examples = false;
  if (improvementScore < 50) {
    if (explanation_style === 'technical') {
      explanation_style = 'detailed';
    }
    add_examples = true; // Add more examples to help understanding
  }

  // LOW SATISFACTION (<50): Reduce complexity, avoid advanced explanations
  if (satisfactionScore < 50) {
    if (explanation_style === 'technical') {
      explanation_style = 'detailed';
    }
    if (explanation_style === 'detailed' && knowledgeLevel !== 'advanced') {
      explanation_style = 'simple';
    }
    add_examples = true;
  }

  // Advanced queries: reduce simplification regardless of profile
  if (queryType === 'advanced') {
    if (explanation_style === 'simple') {
      explanation_style = 'detailed';
    }
  }

  // Low confidence: don't over-simplify or over-complicate
  if (personalization_strength === 'minimal') {
    explanation_style = 'detailed'; // Safe default
  }

  // Determine response_length: IF reading > 0.5 → long
  let response_length;
  if (scores.reading > 0.5) {
    response_length = 'long';
  } else if (scores.visual > 0.5 || scores.kinesthetic > 0.5) {
    response_length = 'short';
  } else {
    response_length = 'medium';
  }

  // LOW ENGAGEMENT: Override to shorter responses
  if (engagementScore < 40 && response_length === 'long') {
    response_length = 'medium';
  }

  // Advanced queries may need more detail
  if (queryType === 'advanced' && response_length === 'short') {
    response_length = 'medium';
  }

  // === AGENT ORCHESTRATION ===
  // Determine preferred agents based on learning style and confidence
  const preferred_agents = determinePreferredAgents(scores, confidenceScore, engagementScore);

  return {
    force_visual,
    response_length,
    explanation_style,
    interaction_mode,
    personalization_strength,
    add_examples,
    preferred_agents,
    _context: {
      queryType,
      confidenceScore,
      metrics: {
        engagement: engagementScore,
        improvement: improvementScore,
        satisfaction: satisfactionScore,
      },
    },
  };
}

/**
 * Determine preferred agents based on learning style and confidence
 * @param {Object} scores - Learning style scores
 * @param {number} confidenceScore - Profile confidence (0-1)
 * @param {number} engagementScore - Engagement metric (0-100)
 * @returns {string[]} Ordered list of preferred agent types
 */
function determinePreferredAgents(scores, confidenceScore, engagementScore) {
  const agents = [];

  // IF visual_score > 0.6 → prioritize VisualAgent
  if (scores.visual > 0.6) {
    agents.push('visual-intelligence');
  }

  // IF kinesthetic > 0.5 → generate interactive widgets
  if (scores.kinesthetic > 0.5) {
    agents.push('interactive-widget');
  }

  // IF reading > 0.5 → reduce widget usage, prefer text
  if (scores.reading > 0.5) {
    agents.push('text-explanation');
    // Remove visual if reading is dominant
    const visualIdx = agents.indexOf('visual-intelligence');
    if (visualIdx > -1 && scores.reading > scores.visual) {
      agents.splice(visualIdx, 1);
    }
  }

  // IF confidence < 0.4 → use safer agents (less complex output)
  if (confidenceScore < 0.4) {
    // Filter out complex agents, prefer simpler ones
    const safeAgents = ['text-explanation', 'simple-diagram'];
    return agents.filter(a => safeAgents.includes(a)).concat(
      safeAgents.filter(a => !agents.includes(a))
    );
  }

  // Low engagement: prioritize interactive agents
  if (engagementScore < 40) {
    if (!agents.includes('interactive-widget')) {
      agents.unshift('interactive-widget');
    }
  }

  // Default: include planner for structured content
  if (agents.length === 0) {
    agents.push('planner', 'visual-intelligence');
  }

  return agents;
}

/**
 * Update user learning style based on behavior (async, non-blocking)
 * Uses weighted scoring with clamping and change limits
 * @param {string} userId
 * @param {Array} messages - recent messages
 * @param {Object} behavior - { widgetInteractions, avgMessageLength, followUpCount }
 * @returns {Promise<{dominant_style: string, scores: Object}|null>}
 */
export async function updateLearningStyle(userId, messages = [], behavior = {}) {
  if (!userId) return null;

  const DECAY_RATE = 0.05;      // 5% decay per update cycle
  const WEIGHT_INCREMENT = 0.1; // Weighted scoring: +0.1 per behavior
  const MAX_CHANGE = 0.2;       // Maximum change per update cycle
  const MIN_SCORE = 0;          // Minimum clamped value
  const MAX_SCORE = 1;          // Maximum clamped value

  try {
    // Fetch current profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('detected_styles, comprehension_level')
      .eq('id', userId)
      .single();

    if (!profile) return null;

    const currentStyles = profile.detected_styles || {
      visual: 0.25,
      auditory: 0.25,
      reading: 0.25,
      kinesthetic: 0.25,
    };

    // Apply 5% decay to current scores
    const decayedStyles = {};
    Object.keys(currentStyles).forEach(style => {
      decayedStyles[style] = currentStyles[style] * (1 - DECAY_RATE);
    });

    // Calculate style adjustments using weighted scoring (+0.1 per behavior)
    const adjustments = { visual: 0, auditory: 0, reading: 0, kinesthetic: 0 };

    // Widget interactions → +0.1 visual (per interaction, max 3)
    if (behavior.widgetInteractions > 0) {
      adjustments.visual += WEIGHT_INCREMENT * Math.min(behavior.widgetInteractions, 3);
    }

    // Long reading (avgMessageLength > 150) → +0.1 reading
    if (behavior.avgMessageLength > 150) {
      adjustments.reading += WEIGHT_INCREMENT;
    }

    // Follow-up questions → +0.1 kinesthetic (learning by doing)
    if (behavior.followUpCount > 0) {
      adjustments.kinesthetic += WEIGHT_INCREMENT * Math.min(behavior.followUpCount, 3);
    }

    // Apply adjustments with MAX_CHANGE limit to prevent extreme jumps
    const newStyles = {};
    Object.keys(decayedStyles).forEach(style => {
      // Calculate raw change
      let change = adjustments[style];

      // Clamp change to prevent extreme jumps (max ±0.2 per update)
      change = Math.max(-MAX_CHANGE, Math.min(MAX_CHANGE, change));

      // Apply change to decayed score
      let newValue = decayedStyles[style] + change;

      // Clamp final value between 0 and 1
      newValue = Math.max(MIN_SCORE, Math.min(MAX_SCORE, newValue));

      newStyles[style] = newValue;
    });

    // Normalize to sum = 1.0
    const total = Object.values(newStyles).reduce((a, b) => a + b, 0);
    if (total > 0) {
      Object.keys(newStyles).forEach(style => {
        newStyles[style] = newStyles[style] / total;
        // Final clamp after normalization (0-1)
        newStyles[style] = Math.max(MIN_SCORE, Math.min(MAX_SCORE, newStyles[style]));
      });
    } else {
      // Fallback to equal distribution
      Object.keys(newStyles).forEach(style => {
        newStyles[style] = 0.25;
      });
    }

    // Ensure minimum threshold (5% per style) and re-normalize
    const MIN_THRESHOLD = 0.05;
    Object.keys(newStyles).forEach(style => {
      newStyles[style] = Math.max(MIN_THRESHOLD, newStyles[style]);
    });
    const finalTotal = Object.values(newStyles).reduce((a, b) => a + b, 0);
    Object.keys(newStyles).forEach(style => {
      newStyles[style] = newStyles[style] / finalTotal;
    });

    // Determine dominant style
    const [dominantStyle] = Object.entries(newStyles).sort(([, a], [, b]) => b - a)[0];

    // Detect knowledge level from messages
    const knowledgeLevel = detectKnowledgeLevel(messages);

    // Calculate confidence score from behavior patterns
    const behaviorInteractions = [];
    if (behavior.widgetInteractions > 0) {
      for (let i = 0; i < behavior.widgetInteractions; i++) {
        behaviorInteractions.push({ type: 'widget' });
      }
    }
    if (behavior.avgMessageLength > 150) {
      behaviorInteractions.push({ type: 'text' });
    }
    if (behavior.followUpCount > 0) {
      for (let i = 0; i < behavior.followUpCount; i++) {
        behaviorInteractions.push({ type: 'interactive' });
      }
    }
    const confidenceScore = calculateConfidenceScore(behaviorInteractions, newStyles);

    // Update database
    await supabase
      .from('user_profiles')
      .update({
        detected_styles: newStyles,
        comprehension_level: knowledgeLevel,
        confidence_score: confidenceScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    logger.debug('Updated learning style', { userId, dominant_style: dominantStyle, scores: newStyles, knowledgeLevel, confidenceScore });

    return {
      dominant_style: dominantStyle,
      scores: newStyles,
      confidence_score: confidenceScore,
    };
  } catch (err) {
    logger.warn('updateLearningStyle failed', { userId, error: err.message });
    // Non-blocking - don't throw
    return null;
  }
}

// =============================================================================
// TOPIC TRACKING (weak/strong topics)
// =============================================================================

/**
 * Extract topic from user message using keyword matching
 * @param {string} message - User message
 * @returns {string|null} Detected topic or null
 */
function extractTopic(message = '') {
  const lowerMsg = message.toLowerCase();

  // Common educational topic patterns
  const topicPatterns = [
    // Direct topic mentions
    /(?:about|learn|understand|explain|help with|studying|topic:?)\s+([a-z\s]{3,30})/i,
    // Question-based extraction
    /(?:what is|how does|why does|how do|can you explain)\s+([a-z\s]{3,30})/i,
    // Subject areas
    /\b(math|mathematics|algebra|calculus|geometry|physics|chemistry|biology|history|programming|javascript|python|react|css|html|database|sql|machine learning|ai|data science)\b/i,
  ];

  for (const pattern of topicPatterns) {
    const match = lowerMsg.match(pattern);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }
  }

  return null;
}

/**
 * Detect if message indicates confusion or struggle
 * @param {string} message - User message
 * @returns {boolean}
 */
function detectStruggle(message = '') {
  const struggleIndicators = [
    "i don't understand",
    "i dont understand",
    "confused",
    "still confused",
    "can you explain again",
    "what do you mean",
    "i'm lost",
    "makes no sense",
    "too hard",
    "too difficult",
    "help me understand",
    "could you clarify",
    "not getting it",
  ];

  const lowerMsg = message.toLowerCase();
  return struggleIndicators.some(indicator => lowerMsg.includes(indicator));
}

/**
 * Detect if interaction indicates mastery/strength
 * @param {Object} interaction - { message, hasFollowUp, widgetInteracted, responseTime }
 * @returns {boolean}
 */
function detectStrength(interaction = {}) {
  const { message = '', hasFollowUp = true, widgetInteracted = false, responseTime = 0 } = interaction;

  // Strength indicators
  const strengthPhrases = [
    "i understand",
    "that makes sense",
    "got it",
    "thanks",
    "clear now",
    "i see",
    "perfect",
    "exactly what i needed",
  ];

  const lowerMsg = message.toLowerCase();
  const hasStrengthPhrase = strengthPhrases.some(phrase => lowerMsg.includes(phrase));

  // No follow-up questions + positive feedback = strength
  // Long engagement time (>30s) + widget interaction = strength
  return (hasStrengthPhrase && !hasFollowUp) ||
         (responseTime > 30000 && widgetInteracted && !hasFollowUp);
}

/**
 * Update user's weak/strong topics based on interactions
 * @param {string} userId
 * @param {Array} messages - Recent conversation messages
 * @param {Object} behavior - { hasFollowUp, widgetInteracted, responseTime }
 * @returns {Promise<Object>} { weak_topics, strong_topics }
 */
export async function updateTopicStrengths(userId, messages = [], behavior = {}) {
  if (!userId || messages.length === 0) return null;

  const MAX_TOPICS = 20; // Maximum topics to track per category
  const REPEAT_THRESHOLD = 2; // Questions on same topic to mark as weak

  try {
    // Fetch current profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('weak_topics, strong_topics')
      .eq('id', userId)
      .single();

    let weakTopics = profile?.weak_topics || [];
    let strongTopics = profile?.strong_topics || [];

    // Analyze messages for topic patterns
    const topicMentions = {};
    const userMessages = messages.filter(m => m.role === 'user');

    userMessages.forEach(msg => {
      const content = msg.content || '';
      const topic = extractTopic(content);

      if (topic) {
        if (!topicMentions[topic]) {
          topicMentions[topic] = { count: 0, struggled: false, mastered: false };
        }
        topicMentions[topic].count++;

        if (detectStruggle(content)) {
          topicMentions[topic].struggled = true;
        }
      }
    });

    // Check last message for strength indicators
    const lastUserMsg = userMessages[userMessages.length - 1];
    if (lastUserMsg) {
      const topic = extractTopic(lastUserMsg.content || '');
      if (topic && topicMentions[topic]) {
        const isStrong = detectStrength({
          message: lastUserMsg.content,
          hasFollowUp: behavior.hasFollowUp ?? true,
          widgetInteracted: behavior.widgetInteracted ?? false,
          responseTime: behavior.responseTime ?? 0,
        });
        if (isStrong) {
          topicMentions[topic].mastered = true;
        }
      }
    }

    // Update weak/strong topics
    Object.entries(topicMentions).forEach(([topic, data]) => {
      // Repeated questions on same topic → weak
      if (data.count >= REPEAT_THRESHOLD || data.struggled) {
        if (!weakTopics.includes(topic)) {
          weakTopics.push(topic);
        }
        // Remove from strong if was there
        strongTopics = strongTopics.filter(t => t !== topic);
      }

      // Mastered → strong (and remove from weak)
      if (data.mastered && !data.struggled) {
        if (!strongTopics.includes(topic)) {
          strongTopics.push(topic);
        }
        weakTopics = weakTopics.filter(t => t !== topic);
      }
    });

    // Limit array sizes
    weakTopics = weakTopics.slice(-MAX_TOPICS);
    strongTopics = strongTopics.slice(-MAX_TOPICS);

    // Update database
    await supabase
      .from('user_profiles')
      .update({
        weak_topics: weakTopics,
        strong_topics: strongTopics,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    logger.debug('Updated topic strengths', { userId, weakTopics, strongTopics });

    return { weak_topics: weakTopics, strong_topics: strongTopics };
  } catch (err) {
    logger.warn('updateTopicStrengths failed', { userId, error: err.message });
    return null;
  }
}

/**
 * Get topic recommendations for planner based on weak/strong topics
 * @param {Object} profile - User profile with weak_topics and strong_topics
 * @param {string} topic - Current topic being planned
 * @returns {Object} { needsExtraSteps, extraInstructions }
 */
export function getTopicRecommendations(profile, topic = '') {
  const weakTopics = profile?.weak_topics || [];
  const strongTopics = profile?.strong_topics || [];
  const lowerTopic = topic.toLowerCase();

  // Check if topic matches any weak topics
  const isWeakTopic = weakTopics.some(weak =>
    lowerTopic.includes(weak) || weak.includes(lowerTopic)
  );

  // Check if topic matches any strong topics
  const isStrongTopic = strongTopics.some(strong =>
    lowerTopic.includes(strong) || strong.includes(lowerTopic)
  );

  if (isWeakTopic && !isStrongTopic) {
    return {
      needsExtraSteps: true,
      extraInstructions: `- WEAK TOPIC DETECTED: User has struggled with "${topic}" before
- Add 2-3 EXTRA steps with simpler explanations
- Include more examples and practice exercises
- Break down complex concepts into smaller pieces
- Add checkpoints after each major concept`,
    };
  }

  if (isStrongTopic && !isWeakTopic) {
    return {
      needsExtraSteps: false,
      extraInstructions: `- STRONG TOPIC: User has shown mastery in "${topic}"
- Can move at a faster pace
- Focus on advanced applications and edge cases
- Skip basic explanations`,
    };
  }

  return {
    needsExtraSteps: false,
    extraInstructions: '',
  };
}

// =============================================================================
// EVALUATION METRICS
// =============================================================================

/**
 * Record a user interaction metric
 * @param {string} userId
 * @param {Object} metric - { type, value, metadata }
 * @returns {Promise<Object>}
 */
export async function recordMetric(userId, metric = {}) {
  if (!userId) return null;

  const { type, value, metadata = {} } = metric;

  try {
    const { data, error } = await supabase
      .from('user_metrics')
      .insert({
        user_id: userId,
        metric_type: type,
        metric_value: value,
        metadata,
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.warn('Failed to record metric', { userId, type, error: error.message });
      return null;
    }

    return data;
  } catch (err) {
    logger.warn('recordMetric failed', { userId, error: err.message });
    return null;
  }
}

/**
 * Calculate engagement score for a session
 * @param {number} timeSpent - Time spent in milliseconds
 * @param {number} interactionsCount - Number of interactions (messages, widget clicks)
 * @param {number} responsesCount - Number of AI responses
 * @returns {number} Score 0-100
 */
export function calculateEngagementScore(timeSpent = 0, interactionsCount = 0, responsesCount = 1) {
  // Engagement = weighted average of:
  // - Time engagement (0-40 points): Optimal is 5-15 mins per response
  // - Interaction rate (0-40 points): Interactions per response
  // - Session completion (0-20 points): Did they stay engaged?

  const avgTimePerResponse = responsesCount > 0 ? timeSpent / responsesCount : 0;
  const interactionsPerResponse = responsesCount > 0 ? interactionsCount / responsesCount : 0;

  // Time score: Peak at 5-15 mins (300000-900000ms), decay outside
  let timeScore = 0;
  if (avgTimePerResponse >= 300000 && avgTimePerResponse <= 900000) {
    timeScore = 40; // Optimal range
  } else if (avgTimePerResponse < 300000) {
    timeScore = Math.max(0, (avgTimePerResponse / 300000) * 40);
  } else {
    timeScore = Math.max(0, 40 - ((avgTimePerResponse - 900000) / 300000) * 10);
  }

  // Interaction score: Higher is better, cap at 3 per response
  const interactionScore = Math.min(40, interactionsPerResponse * 20);

  // Session score: Based on having multiple responses
  const sessionScore = Math.min(20, responsesCount * 4);

  return Math.round(timeScore + interactionScore + sessionScore);
}

/**
 * Calculate improvement score based on follow-up reduction
 * @param {Array} recentFollowUps - Follow-up counts for recent sessions [oldest...newest]
 * @returns {number} Score 0-100 (higher = more improvement)
 */
export function calculateImprovementScore(recentFollowUps = []) {
  if (recentFollowUps.length < 2) return 50; // Neutral if not enough data

  // Compare average of first half vs second half
  const midpoint = Math.floor(recentFollowUps.length / 2);
  const firstHalf = recentFollowUps.slice(0, midpoint);
  const secondHalf = recentFollowUps.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (firstAvg === 0 && secondAvg === 0) return 75; // No follow-ups = good
  if (firstAvg === 0) return 25; // Was good, now needs help

  // Calculate improvement percentage
  const improvementRatio = (firstAvg - secondAvg) / firstAvg;

  // Convert to 0-100 score
  // -1 (doubled follow-ups) = 0, 0 (no change) = 50, 1 (eliminated follow-ups) = 100
  return Math.round(Math.max(0, Math.min(100, (improvementRatio + 1) * 50)));
}

/**
 * Calculate satisfaction score from feedback
 * @param {Array} feedbackItems - [{ type: 'thumbs_up'|'thumbs_down', timestamp }]
 * @returns {number} Score 0-100
 */
export function calculateSatisfactionScore(feedbackItems = []) {
  if (feedbackItems.length === 0) return 50; // Neutral if no feedback

  // Weight recent feedback more heavily
  const now = Date.now();
  let weightedUp = 0;
  let weightedDown = 0;
  let totalWeight = 0;

  feedbackItems.forEach(item => {
    const age = now - new Date(item.timestamp || item.created_at).getTime();
    const weight = Math.exp(-age / (7 * 24 * 60 * 60 * 1000)); // Decay over 7 days

    totalWeight += weight;
    if (item.type === 'thumbs_up') {
      weightedUp += weight;
    } else if (item.type === 'thumbs_down') {
      weightedDown += weight;
    }
  });

  if (totalWeight === 0) return 50;

  const ratio = weightedUp / totalWeight;
  return Math.round(ratio * 100);
}

/**
 * Get comprehensive metrics for a user
 * @param {string} userId
 * @returns {Promise<Object>} Aggregated metrics
 */
export async function getUserMetrics(userId) {
  if (!userId) return null;

  try {
    // Fetch raw metrics from database
    const { data: metrics, error: metricsError } = await supabase
      .from('user_metrics')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false })
      .limit(100);

    // Fetch feedback for satisfaction score
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Aggregate metrics by type
    const timeSpentMetrics = (metrics || []).filter(m => m.metric_type === 'time_spent');
    const interactionMetrics = (metrics || []).filter(m => m.metric_type === 'interaction');
    const followUpMetrics = (metrics || []).filter(m => m.metric_type === 'follow_up_count');

    // Calculate total time spent
    const totalTimeSpent = timeSpentMetrics.reduce((sum, m) => sum + (m.metric_value || 0), 0);

    // Calculate total interactions
    const totalInteractions = interactionMetrics.reduce((sum, m) => sum + (m.metric_value || 0), 0);

    // Get session count (unique sessions from time_spent entries)
    const sessionCount = timeSpentMetrics.length;

    // Calculate scores
    const engagementScore = calculateEngagementScore(
      totalTimeSpent,
      totalInteractions,
      sessionCount
    );

    const followUpCounts = followUpMetrics.map(m => m.metric_value || 0);
    const improvementScore = calculateImprovementScore(followUpCounts);

    const satisfactionScore = calculateSatisfactionScore(feedback || []);

    // Calculate overall effectiveness score
    const overallScore = Math.round(
      (engagementScore * 0.3) + (improvementScore * 0.4) + (satisfactionScore * 0.3)
    );

    return {
      userId,
      engagement: {
        score: engagementScore,
        totalTimeSpent,
        totalInteractions,
        sessionsCount: sessionCount,
        avgTimePerSession: sessionCount > 0 ? Math.round(totalTimeSpent / sessionCount) : 0,
      },
      improvement: {
        score: improvementScore,
        followUpTrend: followUpCounts.length > 0 ?
          (followUpCounts[followUpCounts.length - 1] < followUpCounts[0] ? 'improving' : 'stable') :
          'insufficient_data',
        recentFollowUps: followUpCounts.slice(0, 5),
      },
      satisfaction: {
        score: satisfactionScore,
        thumbsUp: (feedback || []).filter(f => f.type === 'thumbs_up').length,
        thumbsDown: (feedback || []).filter(f => f.type === 'thumbs_down').length,
        totalFeedback: (feedback || []).length,
      },
      overall: {
        score: overallScore,
        rating: overallScore >= 80 ? 'excellent' :
                overallScore >= 60 ? 'good' :
                overallScore >= 40 ? 'average' : 'needs_improvement',
      },
      calculatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error('getUserMetrics failed', { userId, error: err.message });
    return null;
  }
}

/**
 * Track session metrics (call at end of response)
 * @param {string} userId
 * @param {Object} sessionData - { timeSpent, interactions, followUpCount, widgetInteractions }
 */
export async function trackSessionMetrics(userId, sessionData = {}) {
  if (!userId) return;

  const { timeSpent = 0, interactions = 0, followUpCount = 0, widgetInteractions = 0 } = sessionData;

  try {
    // Record individual metrics in parallel
    await Promise.all([
      timeSpent > 0 && recordMetric(userId, {
        type: 'time_spent',
        value: timeSpent,
        metadata: { unit: 'ms' }
      }),
      interactions > 0 && recordMetric(userId, {
        type: 'interaction',
        value: interactions,
        metadata: { widgetInteractions }
      }),
      recordMetric(userId, {
        type: 'follow_up_count',
        value: followUpCount,
        metadata: {}
      }),
    ].filter(Boolean));

    logger.debug('Tracked session metrics', { userId, timeSpent, interactions, followUpCount });
  } catch (err) {
    logger.warn('trackSessionMetrics failed', { userId, error: err.message });
  }
}

// =============================================================================
// DYNAMIC DIFFICULTY ADJUSTMENT (per session)
// =============================================================================

// In-memory session difficulty store (resets on server restart)
const sessionDifficulty = new Map();

/**
 * Get or initialize session difficulty for a user
 * @param {string} userId
 * @param {string} baseLevel - permanent knowledge level from profile
 * @returns {Object} { level, adjustment, followUpCount }
 */
export function getSessionDifficulty(userId, baseLevel = 'intermediate') {
  if (!userId) {
    return { level: baseLevel, adjustment: 0, followUpCount: 0 };
  }

  if (!sessionDifficulty.has(userId)) {
    sessionDifficulty.set(userId, {
      level: baseLevel,
      adjustment: 0, // -2 to +2 scale
      followUpCount: 0,
      quickResponses: 0,
      lastUpdated: Date.now(),
    });
  }

  const session = sessionDifficulty.get(userId);

  // Reset if session is older than 2 hours
  if (Date.now() - session.lastUpdated > 2 * 60 * 60 * 1000) {
    session.level = baseLevel;
    session.adjustment = 0;
    session.followUpCount = 0;
    session.quickResponses = 0;
    session.lastUpdated = Date.now();
  }

  return session;
}

/**
 * Adjust session difficulty based on user behavior
 * @param {string} userId
 * @param {Object} behavior - { hasFollowUp, responseTime, understoodContent }
 * @returns {Object} Updated session difficulty
 */
export function adjustSessionDifficulty(userId, behavior = {}) {
  if (!userId) return null;

  const {
    hasFollowUp = false,
    responseTime = 0,
    understoodContent = null, // true/false/null
  } = behavior;

  const session = getSessionDifficulty(userId);

  // Track follow-ups
  if (hasFollowUp) {
    session.followUpCount++;
  }

  // Track quick responses (user responded in < 10s without follow-up)
  const QUICK_RESPONSE_THRESHOLD = 10000; // 10 seconds
  if (responseTime > 0 && responseTime < QUICK_RESPONSE_THRESHOLD && !hasFollowUp) {
    session.quickResponses++;
  }

  // Adjust difficulty based on patterns
  const FOLLOWUP_THRESHOLD = 3; // 3+ follow-ups → decrease difficulty
  const QUICK_RESPONSE_THRESHOLD_COUNT = 3; // 3+ quick non-followup responses → increase

  // Many follow-ups → decrease difficulty temporarily
  if (session.followUpCount >= FOLLOWUP_THRESHOLD) {
    session.adjustment = Math.max(-2, session.adjustment - 1);
    session.followUpCount = 0; // Reset counter after adjustment
  }

  // Quick responses with no follow-ups → increase difficulty slightly
  if (session.quickResponses >= QUICK_RESPONSE_THRESHOLD_COUNT) {
    session.adjustment = Math.min(2, session.adjustment + 1);
    session.quickResponses = 0; // Reset counter after adjustment
  }

  // Direct understanding signal
  if (understoodContent === true) {
    session.adjustment = Math.min(2, session.adjustment + 0.5);
  } else if (understoodContent === false) {
    session.adjustment = Math.max(-2, session.adjustment - 0.5);
  }

  // Calculate effective level
  const levelMap = ['beginner', 'intermediate', 'advanced'];
  const baseIndex = levelMap.indexOf(session.level);
  const effectiveIndex = Math.max(0, Math.min(2, Math.round(baseIndex + session.adjustment)));
  const effectiveLevel = levelMap[effectiveIndex];

  session.lastUpdated = Date.now();
  sessionDifficulty.set(userId, session);

  logger.debug('Adjusted session difficulty', {
    userId,
    adjustment: session.adjustment,
    effectiveLevel,
    followUpCount: session.followUpCount,
    quickResponses: session.quickResponses,
  });

  return {
    ...session,
    effectiveLevel,
  };
}

/**
 * Get effective knowledge level for current session
 * Combines permanent profile level with session adjustments
 * @param {string} userId
 * @param {string} profileLevel - permanent level from user_profiles
 * @returns {string} 'beginner' | 'intermediate' | 'advanced'
 */
export function getEffectiveKnowledgeLevel(userId, profileLevel = 'intermediate') {
  const session = getSessionDifficulty(userId, profileLevel);

  const levelMap = ['beginner', 'intermediate', 'advanced'];
  const baseIndex = levelMap.indexOf(session.level);
  const effectiveIndex = Math.max(0, Math.min(2, Math.round(baseIndex + session.adjustment)));

  return levelMap[effectiveIndex];
}

// =============================================================================
// TOPIC PROGRESSION TRACKING
// =============================================================================

/**
 * Record a topic state in history
 * @param {string} userId
 * @param {string} topic
 * @param {string} state - 'struggling' | 'confused' | 'flow' | 'bored' | 'mastering'
 * @param {Object} scores - { effectiveness, engagement }
 * @param {Object} metadata - Additional context
 * @returns {Promise<Object>}
 */
export async function recordTopicState(userId, topic, state, scores = {}, metadata = {}) {
  if (!userId || !topic || !state) return null;

  const validStates = ['struggling', 'confused', 'flow', 'bored', 'mastering'];
  if (!validStates.includes(state)) {
    logger.warn('Invalid topic state', { state, validStates });
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('topic_history')
      .insert({
        user_id: userId,
        topic: topic.toLowerCase().trim(),
        state,
        effectiveness_score: Math.max(0, Math.min(1, scores.effectiveness ?? 0.5)),
        engagement_score: Math.max(0, Math.min(1, scores.engagement ?? 0.5)),
        metadata,
        recorded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logger.warn('Failed to record topic state', { userId, topic, error: error.message });
      return null;
    }

    logger.debug('Recorded topic state', { userId, topic, state });
    return data;
  } catch (err) {
    logger.warn('recordTopicState failed', { userId, error: err.message });
    return null;
  }
}

/**
 * Get topic history for a user
 * @param {string} userId
 * @param {string} topic
 * @param {number} limit
 * @returns {Promise<Object>} { topic, states[], timestamps[], trend }
 */
export async function getTopicHistory(userId, topic, limit = 20) {
  if (!userId || !topic) return null;

  try {
    const { data, error } = await supabase
      .from('topic_history')
      .select('state, effectiveness_score, engagement_score, recorded_at')
      .eq('user_id', userId)
      .ilike('topic', topic.toLowerCase().trim())
      .order('recorded_at', { ascending: false })
      .limit(limit);

    if (error || !data) {
      return null;
    }

    // Build progression structure
    const states = data.map(d => d.state);
    const timestamps = data.map(d => d.recorded_at);
    const effectivenessScores = data.map(d => d.effectiveness_score);
    const engagementScores = data.map(d => d.engagement_score);

    // Calculate trend
    const trend = detectImprovementTrend(effectivenessScores);

    return {
      topic: topic.toLowerCase().trim(),
      states: states.reverse(), // Chronological order
      timestamps: timestamps.reverse(),
      effectiveness: effectivenessScores.reverse(),
      engagement: engagementScores.reverse(),
      trend,
      entryCount: data.length,
    };
  } catch (err) {
    logger.warn('getTopicHistory failed', { userId, topic, error: err.message });
    return null;
  }
}

/**
 * Detect improvement trend from scores
 * @param {number[]} scores - Recent effectiveness scores (newest first)
 * @returns {'improving' | 'stagnating' | 'declining'}
 */
function detectImprovementTrend(scores = []) {
  if (scores.length < 2) return 'stagnating';

  // Compare first half (recent) vs second half (older)
  const midpoint = Math.floor(scores.length / 2);
  const recentHalf = scores.slice(0, midpoint);
  const olderHalf = scores.slice(midpoint);

  const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
  const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;

  const IMPROVEMENT_THRESHOLD = 0.1; // 10% improvement
  const STAGNATION_THRESHOLD = 0.05; // 5% change

  if (recentAvg > olderAvg + IMPROVEMENT_THRESHOLD) {
    return 'improving';
  } else if (Math.abs(recentAvg - olderAvg) < STAGNATION_THRESHOLD) {
    return 'stagnating';
  } else {
    return 'declining';
  }
}

/**
 * Get all topic progressions for a user
 * @param {string} userId
 * @returns {Promise<Object[]>}
 */
export async function getAllTopicProgressions(userId) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('topic_history')
      .select('topic, state, effectiveness_score, recorded_at')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false });

    if (error || !data) return [];

    // Group by topic
    const topicMap = new Map();
    data.forEach(entry => {
      const topic = entry.topic.toLowerCase();
      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          topic,
          states: [],
          timestamps: [],
          effectiveness: [],
        });
      }
      const t = topicMap.get(topic);
      t.states.push(entry.state);
      t.timestamps.push(entry.recorded_at);
      t.effectiveness.push(entry.effectiveness_score);
    });

    // Calculate trends
    return Array.from(topicMap.values()).map(t => ({
      ...t,
      states: t.states.reverse(),
      timestamps: t.timestamps.reverse(),
      effectiveness: t.effectiveness.reverse(),
      trend: detectImprovementTrend(t.effectiveness.slice().reverse()),
      latestState: t.states[t.states.length - 1],
    }));
  } catch (err) {
    logger.warn('getAllTopicProgressions failed', { userId, error: err.message });
    return [];
  }
}

// =============================================================================
// ADAPTIVE POLICY LAYER
// =============================================================================

/**
 * Adaptive Policy: Lightweight rule + scoring hybrid
 * Decides next action based on cognitive state, effectiveness, and engagement
 *
 * @param {Object} input - { cognitiveState, effectivenessScore, engagementScore, topicHistory }
 * @returns {Object} { action, widgetType, difficulty, reasoning, explorationApplied }
 */
export function adaptivePolicy(input = {}) {
  const {
    cognitiveState = 'flow',
    effectivenessScore = 0.5,
    engagementScore = 0.5,
    topicHistory = null,
    learningStyle = 'visual',
  } = input;

  // Normalize scores to 0-1
  const effectiveness = Math.max(0, Math.min(1, effectivenessScore));
  const engagement = Math.max(0, Math.min(1, engagementScore));

  // Track previous effectiveness for delta calculation
  const prevEffectiveness = topicHistory?.effectiveness?.slice(-2, -1)[0] ?? 0.5;
  const effectivenessDelta = effectiveness - prevEffectiveness;

  // Determine trend from history
  const trend = topicHistory?.trend ?? 'stagnating';

  // Exploration rate: 10% of the time, try something different
  const EXPLORATION_RATE = 0.1;
  const isExploring = Math.random() < EXPLORATION_RATE;

  let action = 'continue';
  let widgetType = 'step-by-step-animation';
  let difficulty = 'standard';
  let reasoning = [];

  // ==========================================================================
  // RULE 1: Effectiveness improving → reinforce current strategy
  // ==========================================================================
  if (effectivenessDelta > 0.1 || trend === 'improving') {
    action = 'reinforce';
    reasoning.push('Effectiveness improving → reinforcing current strategy');

    // Slightly increase difficulty
    if (effectiveness > 0.7) {
      difficulty = 'advanced';
      reasoning.push('High effectiveness → increasing difficulty');
    }
  }

  // ==========================================================================
  // RULE 2: Effectiveness dropping → switch strategy
  // ==========================================================================
  if (effectivenessDelta < -0.1 || (trend === 'declining' && effectiveness < 0.5)) {
    action = 'switch_strategy';
    reasoning.push('Effectiveness dropping → switching strategy');

    // Simplify
    difficulty = 'simplified';
    reasoning.push('Reduced difficulty to help recovery');

    // Change widget type based on what hasn't been tried
    widgetType = _selectAlternativeWidget(learningStyle);
    reasoning.push(`Trying different widget type: ${widgetType}`);
  }

  // ==========================================================================
  // RULE 3: Stagnating → change modality
  // ==========================================================================
  if (trend === 'stagnating' && topicHistory?.entryCount > 3) {
    action = 'change_modality';
    reasoning.push('Progress stagnating → changing learning modality');

    // Cycle through different widget types
    const modalityMap = {
      visual: 'drag-drop-exercise',
      auditory: 'step-by-step-animation',
      reading: 'comparison-table',
      kinesthetic: 'prediction-widget',
    };
    widgetType = modalityMap[learningStyle] || 'concept-map';
    reasoning.push(`Switching to ${widgetType} for fresh approach`);
  }

  // ==========================================================================
  // RULE 4: Low engagement → increase interactivity
  // ==========================================================================
  if (engagement < 0.4) {
    action = 'boost_engagement';
    reasoning.push('Low engagement detected → boosting interactivity');

    // Force interactive widgets
    widgetType = 'drag-drop-exercise';
    difficulty = 'challenge'; // Make it more game-like
    reasoning.push('Using interactive challenge to re-engage');
  }

  // ==========================================================================
  // RULE 5: Cognitive state specific overrides
  // ==========================================================================
  switch (cognitiveState) {
    case 'struggling':
      action = 'scaffold';
      widgetType = 'step-by-step-animation';
      difficulty = 'simplified';
      reasoning.push('Struggling state → maximum scaffolding');
      break;

    case 'confused':
      action = 'clarify';
      widgetType = 'prediction-widget';
      difficulty = 'simplified';
      reasoning.push('Confused state → surfacing misconceptions');
      break;

    case 'bored':
      action = 'challenge';
      widgetType = 'challenge-widget';
      difficulty = 'advanced';
      reasoning.push('Bored state → increasing challenge');
      break;

    case 'mastering':
      action = 'advance';
      widgetType = 'quiz-widget';
      difficulty = 'advanced';
      reasoning.push('Mastering state → confirming mastery');
      break;

    case 'flow':
    default:
      // Keep current settings if in flow
      if (action === 'continue') {
        reasoning.push('Flow state → maintaining current approach');
      }
      break;
  }

  // ==========================================================================
  // EXPLORATION: 10% of the time, try something new
  // ==========================================================================
  if (isExploring && cognitiveState !== 'struggling') {
    const explorationWidgets = [
      'concept-map',
      'comparison-table',
      'prediction-widget',
      'drag-drop-exercise',
      'challenge-widget',
    ];
    widgetType = explorationWidgets[Math.floor(Math.random() * explorationWidgets.length)];
    reasoning.push(`Exploration (10%): trying ${widgetType}`);
  }

  return {
    action,
    widgetType,
    difficulty,
    reasoning,
    explorationApplied: isExploring && cognitiveState !== 'struggling',
    scores: {
      effectiveness,
      engagement,
      effectivenessDelta,
    },
    trend,
  };
}

/**
 * Select an alternative widget based on learning style
 * @param {string} currentStyle
 * @returns {string}
 */
function _selectAlternativeWidget(currentStyle) {
  const alternatives = {
    visual: ['comparison-table', 'concept-map'],
    auditory: ['step-by-step-animation', 'quiz-widget'],
    reading: ['drag-drop-exercise', 'prediction-widget'],
    kinesthetic: ['step-by-step-animation', 'concept-map'],
  };

  const options = alternatives[currentStyle] || ['step-by-step-animation'];
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Run adaptive policy and record state
 * @param {string} userId
 * @param {string} topic
 * @param {Object} context - { cognitiveState, effectiveness, engagement, learningStyle, widgetType, interactionCount }
 * @returns {Promise<Object>} Policy decision with recorded state
 */
export async function runAdaptivePolicyWithTracking(userId, topic, context = {}) {
  const {
    cognitiveState = 'flow',
    effectiveness = 0.5,
    engagement = 0.5,
    learningStyle = 'visual',
    widgetType = null,
    interactionCount = 0,
    hintsUsed = 0,
    errorsCount = 0,
  } = context;

  // Get topic history for trend analysis
  const topicHistory = await getTopicHistory(userId, topic);

  // Run adaptive policy
  const decision = adaptivePolicy({
    cognitiveState,
    effectivenessScore: effectiveness,
    engagementScore: engagement,
    topicHistory,
    learningStyle,
  });

  // Record the current state
  await recordTopicState(userId, topic, cognitiveState, {
    effectiveness,
    engagement,
  }, {
    widgetType: widgetType || decision.widgetType,
    interactionCount,
    hintsUsed,
    errorsCount,
    policyAction: decision.action,
  });

  return {
    ...decision,
    topicHistory,
    userId,
    topic,
  };
}

// =============================================================================
// PERSONALIZATION TRANSPARENCY / EXPLANATION
// =============================================================================

/**
 * Generate human-readable explanation of why personalization choices were made
 * @param {Object} profile - User profile
 * @param {Object} strategy - Strategy from getPersonalizationStrategy()
 * @returns {Object} { summary, reasons[], debug }
 */
export function generatePersonalizationExplanation(profile, strategy) {
  const reasons = [];
  const debug = {};

  // Learning style explanation
  const scores = profile?.scores || profile?.styleScores || {};
  const dominantStyle = profile?.dominant_style || 'visual';
  const dominantScore = scores[dominantStyle] || 0.25;
  const stylePercent = Math.round(dominantScore * 100);

  reasons.push(`You prefer ${dominantStyle} learning (${stylePercent}%)`);
  debug.learningStyle = { style: dominantStyle, score: stylePercent };

  // Knowledge level explanation
  const knowledgeLevel = profile?.knowledge_level || 'intermediate';
  const levelDescriptions = {
    beginner: 'beginner level - simpler explanations',
    intermediate: 'intermediate level - balanced detail',
    advanced: 'advanced level - technical depth',
  };
  reasons.push(`You are at ${levelDescriptions[knowledgeLevel]}`);
  debug.knowledgeLevel = knowledgeLevel;

  // Confidence explanation
  const confidence = profile?.confidence_score ?? 0.5;
  if (confidence < 0.4) {
    reasons.push('Profile confidence is low - using safer defaults');
    debug.confidence = { score: confidence, effect: 'reduced_personalization' };
  }

  // Weak/strong topics explanation
  const weakTopics = profile?.weak_topics || [];
  const strongTopics = profile?.strong_topics || [];

  if (weakTopics.length > 0) {
    reasons.push(`Topics needing more help: ${weakTopics.slice(0, 3).join(', ')}`);
    debug.weakTopics = weakTopics;
  }

  if (strongTopics.length > 0) {
    reasons.push(`Topics you've mastered: ${strongTopics.slice(0, 3).join(', ')}`);
    debug.strongTopics = strongTopics;
  }

  // Metrics-based adjustments
  if (strategy?._context?.metrics) {
    const { engagement, improvement, satisfaction } = strategy._context.metrics;

    if (engagement < 40) {
      reasons.push('Engagement is low - adding more interactive content');
      debug.metricsEffect = debug.metricsEffect || [];
      debug.metricsEffect.push('low_engagement');
    }

    if (improvement < 50) {
      reasons.push('Adding more examples to help understanding');
      debug.metricsEffect = debug.metricsEffect || [];
      debug.metricsEffect.push('low_improvement');
    }

    if (satisfaction < 50) {
      reasons.push('Simplifying explanations based on feedback');
      debug.metricsEffect = debug.metricsEffect || [];
      debug.metricsEffect.push('low_satisfaction');
    }
  }

  // Strategy choices explanation
  if (strategy?.force_visual) {
    reasons.push('Visual explanations prioritized');
  }

  if (strategy?.interaction_mode === 'interactive') {
    reasons.push('Interactive elements enabled');
  }

  if (strategy?.add_examples) {
    reasons.push('Extra examples included');
  }

  // Build summary
  const summary = `Response tailored because:\n• ${reasons.join('\n• ')}`;

  return {
    summary,
    reasons,
    debug,
    strategy: {
      force_visual: strategy?.force_visual,
      response_length: strategy?.response_length,
      explanation_style: strategy?.explanation_style,
      interaction_mode: strategy?.interaction_mode,
      personalization_strength: strategy?.personalization_strength,
    },
  };
}

/**
 * Explain adaptive decision for UI transparency
 * Returns a structured explanation of why a particular response was generated
 *
 * @param {Object} params - All context needed for explanation
 * @param {Object} params.profile - User profile with learning styles, weak/strong topics
 * @param {string} params.cognitiveState - Current cognitive state
 * @param {string} params.topic - Current topic being discussed
 * @param {Object} params.policyDecision - Output from adaptivePolicy()
 * @param {Object} params.topicHistory - Topic progression history
 * @returns {Object} { summary, reasons[], factors[], debugInfo }
 */
export function explainAdaptiveDecision({
  profile = {},
  cognitiveState = 'flow',
  topic = null,
  policyDecision = {},
  topicHistory = null,
} = {}) {
  const reasons = [];
  const factors = [];

  // Extract profile data
  const scores = profile?.scores || profile?.styleScores || profile?.detected_styles || {
    visual: 0.25,
    auditory: 0.25,
    reading: 0.25,
    kinesthetic: 0.25,
  };
  const dominantStyle = profile?.dominant_style || profile?.learning_style ||
    Object.entries(scores).sort(([, a], [, b]) => b - a)[0]?.[0] || 'visual';
  const dominantScore = scores[dominantStyle] || 0.25;
  const stylePercent = Math.round(dominantScore * 100);

  const knowledgeLevel = profile?.knowledge_level || profile?.comprehension_level || 'intermediate';
  const confidenceScore = profile?.confidence_score ?? 0.5;
  const weakTopics = profile?.weak_topics || [];
  const strongTopics = profile?.strong_topics || [];

  // ==========================================================================
  // FACTOR 1: Cognitive State
  // ==========================================================================
  const stateDescriptions = {
    struggling: 'having difficulty with this concept',
    confused: 'showing signs of confusion or misconceptions',
    flow: 'learning effectively',
    bored: 'finding the content too easy',
    mastering: 'demonstrating strong understanding',
  };

  factors.push({
    type: 'cognitive_state',
    label: 'Current State',
    value: cognitiveState,
    description: stateDescriptions[cognitiveState] || 'in a learning session',
    impact: cognitiveState === 'struggling' || cognitiveState === 'confused' ? 'high' : 'medium',
  });

  reasons.push(`You are currently in '${cognitiveState}' state (${stateDescriptions[cognitiveState]})`);

  // ==========================================================================
  // FACTOR 2: Topic Strength
  // ==========================================================================
  if (topic) {
    const lowerTopic = topic.toLowerCase();
    const isWeakTopic = weakTopics.some(t => lowerTopic.includes(t) || t.includes(lowerTopic));
    const isStrongTopic = strongTopics.some(t => lowerTopic.includes(t) || t.includes(lowerTopic));

    if (isWeakTopic) {
      factors.push({
        type: 'topic_strength',
        label: 'Topic Status',
        value: 'weak',
        description: `${topic} is a topic you've struggled with before`,
        impact: 'high',
      });
      reasons.push(`${topic} is a weak topic for you - extra support enabled`);
    } else if (isStrongTopic) {
      factors.push({
        type: 'topic_strength',
        label: 'Topic Status',
        value: 'strong',
        description: `${topic} is a topic you've mastered`,
        impact: 'medium',
      });
      reasons.push(`${topic} is a strong topic - advancing at faster pace`);
    } else {
      factors.push({
        type: 'topic_strength',
        label: 'Topic Status',
        value: 'neutral',
        description: 'Standard topic - balanced approach',
        impact: 'low',
      });
    }
  }

  // ==========================================================================
  // FACTOR 3: Learning Style Preference
  // ==========================================================================
  factors.push({
    type: 'learning_style',
    label: 'Learning Preference',
    value: dominantStyle,
    description: `${stylePercent}% preference for ${dominantStyle} learning`,
    impact: stylePercent > 50 ? 'high' : 'medium',
  });

  reasons.push(`${dominantStyle.charAt(0).toUpperCase() + dominantStyle.slice(1)} learning preference is ${stylePercent > 50 ? 'high' : 'moderate'} (${stylePercent}%)`);

  // ==========================================================================
  // FACTOR 4: Knowledge Level
  // ==========================================================================
  const levelDescriptions = {
    beginner: 'simple explanations and more examples',
    intermediate: 'balanced detail level',
    advanced: 'technical depth and faster pace',
  };

  factors.push({
    type: 'knowledge_level',
    label: 'Knowledge Level',
    value: knowledgeLevel,
    description: levelDescriptions[knowledgeLevel],
    impact: 'medium',
  });

  reasons.push(`Your knowledge level is ${knowledgeLevel} - ${levelDescriptions[knowledgeLevel]}`);

  // ==========================================================================
  // FACTOR 5: Topic Progression Trend
  // ==========================================================================
  if (topicHistory && topicHistory.trend) {
    const trendDescriptions = {
      improving: 'Your understanding is improving - difficulty may increase',
      stagnating: 'Progress has plateaued - trying a different approach',
      declining: 'Recent difficulty detected - simplifying content',
    };

    factors.push({
      type: 'progression_trend',
      label: 'Learning Trend',
      value: topicHistory.trend,
      description: trendDescriptions[topicHistory.trend],
      impact: topicHistory.trend === 'declining' ? 'high' : 'medium',
    });

    reasons.push(trendDescriptions[topicHistory.trend]);
  }

  // ==========================================================================
  // FACTOR 6: Policy Decision
  // ==========================================================================
  if (policyDecision.action) {
    const actionDescriptions = {
      reinforce: 'Continuing with current effective approach',
      switch_strategy: 'Changing strategy to improve results',
      change_modality: 'Trying a different learning format',
      boost_engagement: 'Adding interactive elements to increase engagement',
      scaffold: 'Providing extra support and guidance',
      clarify: 'Addressing potential misconceptions',
      challenge: 'Increasing difficulty to maintain interest',
      advance: 'Moving to more advanced content',
      continue: 'Maintaining current approach',
    };

    factors.push({
      type: 'policy_action',
      label: 'Adaptive Action',
      value: policyDecision.action,
      description: actionDescriptions[policyDecision.action] || policyDecision.action,
      impact: 'high',
    });

    if (policyDecision.widgetType) {
      reasons.push(`Widget type: ${policyDecision.widgetType.replace(/-/g, ' ')}`);
    }

    if (policyDecision.difficulty) {
      reasons.push(`Difficulty: ${policyDecision.difficulty}`);
    }

    if (policyDecision.explorationApplied) {
      reasons.push('Exploration mode: trying a new approach (10% chance)');
    }
  }

  // ==========================================================================
  // FACTOR 7: Confidence Score Impact
  // ==========================================================================
  if (confidenceScore < 0.4) {
    factors.push({
      type: 'confidence',
      label: 'Profile Confidence',
      value: 'low',
      description: 'Limited data - using safer defaults',
      impact: 'medium',
    });
    reasons.push('Limited profile data - using balanced defaults');
  } else if (confidenceScore > 0.7) {
    factors.push({
      type: 'confidence',
      label: 'Profile Confidence',
      value: 'high',
      description: 'Strong user profile - full personalization active',
      impact: 'low',
    });
  }

  // ==========================================================================
  // BUILD SUMMARY
  // ==========================================================================
  const summary = `This response was generated because:
- You are currently in '${cognitiveState}' state
${topic ? `- ${weakTopics.some(t => topic.toLowerCase().includes(t) || t.includes(topic.toLowerCase())) ? `${topic} is a weak topic` : strongTopics.some(t => topic.toLowerCase().includes(t) || t.includes(topic.toLowerCase())) ? `${topic} is a strong topic` : `Topic: ${topic}`}` : ''}
- ${dominantStyle.charAt(0).toUpperCase() + dominantStyle.slice(1)} learning preference is ${stylePercent > 50 ? 'high' : 'moderate'} (${stylePercent}%)`;

  return {
    summary,
    reasons,
    factors,
    debugInfo: {
      profile: {
        dominantStyle,
        stylePercent,
        knowledgeLevel,
        confidenceScore,
        weakTopicsCount: weakTopics.length,
        strongTopicsCount: strongTopics.length,
      },
      cognitiveState,
      topic,
      policyAction: policyDecision.action,
      policyWidget: policyDecision.widgetType,
      trend: topicHistory?.trend,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Get a short personalization badge/tag for UI display
 * @param {Object} profile - User profile
 * @returns {Object} { icon, label, color }
 */
export function getPersonalizationBadge(profile) {
  const dominantStyle = profile?.dominant_style || 'visual';
  const knowledgeLevel = profile?.knowledge_level || 'intermediate';

  const styleBadges = {
    visual: { icon: '👁️', label: 'Visual Learner', color: '#3B82F6' },
    auditory: { icon: '🎧', label: 'Auditory Learner', color: '#8B5CF6' },
    reading: { icon: '📖', label: 'Reading/Writing', color: '#10B981' },
    kinesthetic: { icon: '🖐️', label: 'Hands-on Learner', color: '#F59E0B' },
  };

  const levelBadges = {
    beginner: { suffix: '(Beginner)', intensity: 'light' },
    intermediate: { suffix: '(Intermediate)', intensity: 'medium' },
    advanced: { suffix: '(Advanced)', intensity: 'strong' },
  };

  const style = styleBadges[dominantStyle] || styleBadges.visual;
  const level = levelBadges[knowledgeLevel] || levelBadges.intermediate;

  return {
    icon: style.icon,
    label: `${style.label} ${level.suffix}`,
    color: style.color,
    style: dominantStyle,
    level: knowledgeLevel,
  };
}
