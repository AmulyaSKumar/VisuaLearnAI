/**
 * Adaptive Learning Engine
 * A closed-loop system for generating, updating, and optimizing learning widgets
 * INPUT → DECISION → WIDGET → USER INTERACTION → ANALYTICS → ADAPTATION → UPDATED WIDGET
 * @module agents/adaptive-learning-engine
 */

import { BaseAgent } from './base-agent.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// =============================================================================
// COGNITIVE STATE DEFINITIONS
// =============================================================================

const COGNITIVE_STATES = {
  STRUGGLING: 'struggling',   // high errors + hesitation
  CONFUSED: 'confused',       // wrong + high confidence (misconception)
  FLOW: 'flow',               // high completion + optimal time
  BORED: 'bored',             // low interaction + fast responses
  MASTERING: 'mastering',     // correct + high confidence
};

const WIDGET_TYPES = [
  'step-by-step-animation',
  'quiz-widget',
  'drag-drop-exercise',
  'prediction-widget',
  'concept-map',
  'comparison-table',
  'challenge-widget',
];

// =============================================================================
// ADAPTIVE LEARNING ENGINE
// =============================================================================

export class AdaptiveLearningEngine extends BaseAgent {
  constructor() {
    super(
      'adaptive-learning-engine',
      'Closed-loop adaptive learning system for maximizing learning effectiveness',
      '3.0.0'
    );

    // Escalation thresholds
    this.ESCALATION = {
      SIMPLIFY_THRESHOLD: 3,        // attempts > 3 → simplify
      MODALITY_CHANGE_THRESHOLD: 5, // attempts > 5 → change modality
      DIRECT_ANSWER_THRESHOLD: 7,   // attempts > 7 → provide direct answer
    };
  }

  /**
   * Main execution - generate adaptive widget
   * @param {Object} input - { query, topic }
   * @param {Object} context - Full learning context
   */
  async execute(input, context = {}) {
    const { query, topic } = input;
    const {
      userProfile = {},
      userMetrics = {},
      sessionContext = {},
      realtimeSignals = {},
      optionalAnalytics = {},
    } = context;

    logger.info('AdaptiveLearningEngine: Processing request', {
      topic,
      confidence: userProfile.confidence,
      weakTopics: userProfile.weak_topics,
    });

    // ==========================================================================
    // STEP 1: DETERMINE LEARNING STATE
    // ==========================================================================
    const cognitiveState = this._classifyLearningState(
      userMetrics,
      realtimeSignals,
      optionalAnalytics,
      sessionContext
    );

    // ==========================================================================
    // STEP 2: DECISION ENGINE
    // ==========================================================================
    const decision = this._runDecisionEngine(
      topic,
      userProfile,
      cognitiveState,
      sessionContext,
      realtimeSignals
    );

    // ==========================================================================
    // STEP 3: APPLY ESCALATION STRATEGY
    // ==========================================================================
    const escalation = this._applyEscalationStrategy(
      realtimeSignals.incorrect_attempts || 0,
      sessionContext.last_widget_type,
      decision.widget_type
    );

    // ==========================================================================
    // STEP 4: BUILD PERSONALIZATION
    // ==========================================================================
    const personalization = this._buildPersonalization(
      userProfile,
      cognitiveState,
      decision,
      escalation
    );

    // ==========================================================================
    // STEP 5: GENERATE WIDGET
    // ==========================================================================
    const widget = await this._generateWidget(
      query,
      topic,
      decision.widget_type,
      personalization,
      cognitiveState,
      escalation
    );

    // ==========================================================================
    // STEP 6: BUILD ANALYTICS HOOKS
    // ==========================================================================
    const analyticsHooks = this._buildAnalyticsHooks(cognitiveState);

    // ==========================================================================
    // STEP 7: DEFINE ADAPTATION RULES
    // ==========================================================================
    const adaptationRules = this._buildAdaptationRules(cognitiveState, escalation);

    // ==========================================================================
    // STEP 8: GENERATE CACHE KEY
    // ==========================================================================
    const cache = this._generateCacheKey(topic, decision, personalization);

    // ==========================================================================
    // FINAL OUTPUT
    // ==========================================================================
    const output = {
      widget_type: decision.widget_type,
      cognitive_state: cognitiveState,
      reasoning: decision.reasoning,
      personalization_applied: personalization,
      interaction_model: widget.interaction_model,
      html_code: widget.html_code,
      analytics_hooks: analyticsHooks,
      learning_effectiveness_formula: '(quizScore * 0.5) + (completionRate * 0.2) - (hintsUsed * 0.2) - (errorsCount * 0.1)',
      adaptation_rules: adaptationRules,
      cache,
      escalation_applied: escalation,
    };

    logger.info('AdaptiveLearningEngine: Widget generated', {
      widgetType: output.widget_type,
      cognitiveState: output.cognitive_state,
      escalationLevel: escalation.level,
    });

    return output;
  }

  // ===========================================================================
  // LEARNING STATE CLASSIFIER
  // ===========================================================================

  /**
   * Classify user's cognitive/learning state
   * @returns {string} One of: struggling, confused, flow, bored, mastering
   */
  _classifyLearningState(metrics, signals, analytics, session) {
    const {
      engagement_score = 0.5,
      improvement_score = 0.5,
    } = metrics;

    const {
      incorrect_attempts = 0,
      hesitation_detected = false,
      time_spent = 'medium',
    } = signals;

    const {
      completionRate = 0.5,
      quizScore = null,
      errorsCount = 0,
      confidence_level = 0.5, // user self-reported
    } = analytics;

    const { last_3_performance = [] } = session;

    // Calculate recent performance trend
    const recentCorrect = last_3_performance.filter(p => p === 'correct').length;
    const recentWrong = last_3_performance.filter(p => p === 'wrong').length;

    // STRUGGLING: high errors + hesitation
    if ((incorrect_attempts > 2 || errorsCount > 2) && hesitation_detected) {
      return COGNITIVE_STATES.STRUGGLING;
    }

    // CONFUSED: wrong answers + high confidence (misconception detected)
    if (recentWrong >= 2 && confidence_level > 0.7) {
      return COGNITIVE_STATES.CONFUSED;
    }

    // BORED: low interaction + fast responses
    if (time_spent === 'low' && engagement_score < 0.4 && completionRate < 0.5) {
      return COGNITIVE_STATES.BORED;
    }

    // MASTERING: correct + high confidence
    if (recentCorrect >= 2 && confidence_level > 0.7 && (quizScore === null || quizScore > 0.8)) {
      return COGNITIVE_STATES.MASTERING;
    }

    // FLOW: high completion + optimal time + good engagement
    if (completionRate > 0.7 && time_spent === 'medium' && engagement_score > 0.6) {
      return COGNITIVE_STATES.FLOW;
    }

    // Default to flow if uncertain
    return COGNITIVE_STATES.FLOW;
  }

  // ===========================================================================
  // DECISION ENGINE
  // ===========================================================================

  /**
   * Core decision engine for widget selection
   */
  _runDecisionEngine(topic, profile, cognitiveState, session, signals) {
    const scores = profile.scores || profile.learning_style_scores || {
      visual: 0.25,
      kinesthetic: 0.25,
      reading: 0.25,
      auditory: 0.25,
    };
    const weakTopics = profile.weak_topics || [];
    const strongTopics = profile.strong_topics || [];
    const confidence = profile.confidence ?? 0.5;
    const knowledgeLevel = profile.knowledge_level || 'intermediate';

    // Determine topic status
    const lowerTopic = (topic || '').toLowerCase();
    const isWeakTopic = weakTopics.some(t => lowerTopic.includes(t) || t.includes(lowerTopic));
    const isStrongTopic = strongTopics.some(t => lowerTopic.includes(t) || t.includes(lowerTopic));

    // Compute topic difficulty
    let topicDifficulty = 'standard';
    if (isWeakTopic) topicDifficulty = 'simplified';
    if (isStrongTopic && confidence > 0.6) topicDifficulty = 'advanced';

    // Compute struggle level
    const incorrectAttempts = signals.incorrect_attempts || 0;
    let struggleLevel = 'low';
    if (incorrectAttempts > 5) struggleLevel = 'critical';
    else if (incorrectAttempts > 3) struggleLevel = 'high';
    else if (incorrectAttempts > 1) struggleLevel = 'medium';

    // Select widget type based on cognitive state
    let widgetType;
    let reasoning;

    switch (cognitiveState) {
      case COGNITIVE_STATES.STRUGGLING:
        widgetType = 'step-by-step-animation';
        reasoning = 'User is struggling (high errors + hesitation). Providing guided step-by-step animation with extensive scaffolding.';
        break;

      case COGNITIVE_STATES.CONFUSED:
        widgetType = 'prediction-widget';
        reasoning = 'User shows misconception (wrong + high confidence). Using prediction widget to surface and correct misconceptions.';
        break;

      case COGNITIVE_STATES.BORED:
        widgetType = 'challenge-widget';
        reasoning = 'User appears bored (low engagement + fast responses). Increasing challenge level to re-engage.';
        break;

      case COGNITIVE_STATES.MASTERING:
        widgetType = scores.kinesthetic > 0.5 ? 'drag-drop-exercise' : 'quiz-widget';
        reasoning = 'User is mastering content (correct + high confidence). Providing assessment to confirm mastery.';
        break;

      case COGNITIVE_STATES.FLOW:
      default:
        // In flow state, optimize for learning style
        if (scores.visual > 0.5 && !isStrongTopic) {
          widgetType = isWeakTopic ? 'step-by-step-animation' : 'concept-map';
          reasoning = `User in flow state with visual preference (${(scores.visual * 100).toFixed(0)}%). ${isWeakTopic ? 'Weak topic detected - using guided animation.' : 'Using concept map for visual exploration.'}`;
        } else if (scores.kinesthetic > 0.5) {
          widgetType = 'drag-drop-exercise';
          reasoning = `User in flow state with kinesthetic preference (${(scores.kinesthetic * 100).toFixed(0)}%). Using interactive drag-drop exercise.`;
        } else if (scores.reading > 0.4) {
          widgetType = 'comparison-table';
          reasoning = `User in flow state with reading preference (${(scores.reading * 100).toFixed(0)}%). Using structured comparison table.`;
        } else {
          widgetType = 'step-by-step-animation';
          reasoning = 'User in flow state with balanced learning style. Defaulting to step-by-step animation.';
        }
        break;
    }

    // Override for weak topics regardless of state
    if (isWeakTopic && cognitiveState !== COGNITIVE_STATES.MASTERING) {
      if (widgetType !== 'step-by-step-animation') {
        widgetType = 'step-by-step-animation';
        reasoning += ' [OVERRIDE: Weak topic detected - switching to guided animation with hints]';
      }
    }

    // Override for strong topics
    if (isStrongTopic && cognitiveState === COGNITIVE_STATES.FLOW) {
      widgetType = 'challenge-widget';
      reasoning = 'Strong topic + flow state. Advancing to challenge widget for deeper mastery.';
    }

    return {
      widget_type: widgetType,
      topic_difficulty: topicDifficulty,
      struggle_level: struggleLevel,
      reasoning,
      topic_status: isWeakTopic ? 'weak' : isStrongTopic ? 'strong' : 'neutral',
    };
  }

  // ===========================================================================
  // ESCALATION STRATEGY
  // ===========================================================================

  /**
   * Apply escalation based on attempt count
   */
  _applyEscalationStrategy(attempts, lastWidgetType, currentWidgetType) {
    const escalation = {
      level: 0,
      actions: [],
      modality_changed: false,
      provide_direct_answer: false,
    };

    // Level 1: Simplify (attempts > 3)
    if (attempts > this.ESCALATION.SIMPLIFY_THRESHOLD) {
      escalation.level = 1;
      escalation.actions.push('simplify_explanation');
      escalation.actions.push('auto_show_hint_level_1');
      escalation.actions.push('reduce_steps');
    }

    // Level 2: Change modality (attempts > 5)
    if (attempts > this.ESCALATION.MODALITY_CHANGE_THRESHOLD) {
      escalation.level = 2;
      escalation.actions.push('change_modality');
      escalation.modality_changed = true;

      // Suggest different widget type
      const modalityOptions = {
        'step-by-step-animation': 'comparison-table',
        'quiz-widget': 'drag-drop-exercise',
        'concept-map': 'step-by-step-animation',
        'comparison-table': 'step-by-step-animation',
        'drag-drop-exercise': 'step-by-step-animation',
        'prediction-widget': 'step-by-step-animation',
        'challenge-widget': 'step-by-step-animation',
      };
      escalation.suggested_widget = modalityOptions[currentWidgetType] || 'step-by-step-animation';
    }

    // Level 3: Direct answer (attempts > 7)
    if (attempts > this.ESCALATION.DIRECT_ANSWER_THRESHOLD) {
      escalation.level = 3;
      escalation.actions.push('provide_direct_answer');
      escalation.actions.push('show_full_breakdown');
      escalation.provide_direct_answer = true;
    }

    return escalation;
  }

  // ===========================================================================
  // PERSONALIZATION BUILDER
  // ===========================================================================

  /**
   * Build personalization configuration
   */
  _buildPersonalization(profile, cognitiveState, decision, escalation) {
    const scores = profile.scores || profile.learning_style_scores || {};
    const confidence = profile.confidence ?? 0.5;
    const knowledgeLevel = profile.knowledge_level || 'intermediate';

    // Determine dominant learning style
    const dominantStyle = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .map(([style]) => style)[0] || 'visual';

    // Determine difficulty adjustment based on confidence
    let difficulty = decision.topic_difficulty;
    let confidenceAdjustment = 'none';

    if (confidence < 0.4) {
      difficulty = 'simplified';
      confidenceAdjustment = 'reduced_due_to_low_confidence';
    } else if (confidence > 0.7 && decision.topic_status !== 'weak') {
      difficulty = 'advanced';
      confidenceAdjustment = 'increased_due_to_high_confidence';
    }

    // Apply escalation adjustments
    if (escalation.level >= 1) {
      difficulty = 'simplified';
      confidenceAdjustment = 'reduced_due_to_escalation';
    }

    // Determine pacing
    let pace = 'normal';
    if (cognitiveState === COGNITIVE_STATES.STRUGGLING || escalation.level > 0) {
      pace = 'slow';
    } else if (cognitiveState === COGNITIVE_STATES.MASTERING || cognitiveState === COGNITIVE_STATES.BORED) {
      pace = 'fast';
    }

    return {
      learning_style: dominantStyle,
      learning_style_scores: scores,
      difficulty,
      pace,
      topic_status: decision.topic_status,
      confidence_adjustment: confidenceAdjustment,
      knowledge_level: knowledgeLevel,
      hints_enabled: decision.topic_status === 'weak' || confidence < 0.6 || escalation.level > 0,
      comprehension_check_required: decision.topic_status === 'weak' || confidence < 0.6,
    };
  }

  // ===========================================================================
  // WIDGET GENERATOR
  // ===========================================================================

  /**
   * Generate the actual widget HTML and interaction model
   */
  async _generateWidget(query, topic, widgetType, personalization, cognitiveState, escalation) {
    // Determine steps based on difficulty and escalation
    let steps = 5;
    if (personalization.difficulty === 'simplified' || escalation.level >= 1) {
      steps = 7; // More steps for struggling users
    } else if (personalization.difficulty === 'advanced') {
      steps = 3; // Fewer steps for advanced
    }

    // Determine hint levels
    const hintLevels = 3;

    // Determine prediction points
    let predictionPoints = 2;
    if (cognitiveState === COGNITIVE_STATES.CONFUSED) {
      predictionPoints = 3; // More prediction points to surface misconceptions
    }

    const interaction_model = {
      steps,
      user_input_required: true,
      hint_levels: hintLevels,
      prediction_points: predictionPoints,
      comprehension_check: personalization.comprehension_check_required,
      auto_hints_enabled: escalation.level >= 1,
      direct_answer_available: escalation.provide_direct_answer,
    };

    // Generate HTML based on widget type
    const html_code = this._generateWidgetHTML(
      topic,
      widgetType,
      personalization,
      interaction_model,
      cognitiveState,
      escalation
    );

    return { interaction_model, html_code };
  }

  /**
   * Generate widget HTML code
   */
  _generateWidgetHTML(topic, widgetType, personalization, interactionModel, cognitiveState, escalation) {
    // For this implementation, generate a comprehensive adaptive widget
    // In production, this would call Claude to generate specific content

    const isRecursion = topic.toLowerCase().includes('recursion');
    const isGraphs = topic.toLowerCase().includes('graph');

    // Use specific generators based on widget type
    switch (widgetType) {
      case 'step-by-step-animation':
        return this._generateStepByStepHTML(topic, personalization, interactionModel, escalation);
      case 'prediction-widget':
        return this._generatePredictionHTML(topic, personalization, interactionModel);
      case 'challenge-widget':
        return this._generateChallengeHTML(topic, personalization, interactionModel);
      case 'quiz-widget':
        return this._generateQuizHTML(topic, personalization, interactionModel);
      case 'drag-drop-exercise':
        return this._generateDragDropHTML(topic, personalization, interactionModel);
      case 'concept-map':
        return this._generateConceptMapHTML(topic, personalization, interactionModel);
      case 'comparison-table':
        return this._generateComparisonHTML(topic, personalization, interactionModel);
      default:
        return this._generateStepByStepHTML(topic, personalization, interactionModel, escalation);
    }
  }

  /**
   * Generate step-by-step animation widget
   */
  _generateStepByStepHTML(topic, personalization, interactionModel, escalation) {
    const { steps, hint_levels, prediction_points, direct_answer_available } = interactionModel;
    const { difficulty, pace, hints_enabled } = personalization;

    return `<div id="adaptive-widget" data-cognitive-state="${personalization.topic_status}" data-difficulty="${difficulty}" style="font-family: system-ui, -apple-system, sans-serif; padding: 24px; background: var(--color-card, #faf9f5); border-radius: 16px; color: var(--color-foreground, #3d3929); max-width: 100%;">
  <style>
    .aw-step { display: none; animation: awFadeIn 0.4s ease; }
    .aw-step.active { display: block; }
    @keyframes awFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .aw-progress { height: 8px; background: var(--color-muted, #ede9de); border-radius: 4px; margin-bottom: 24px; overflow: hidden; }
    .aw-progress-fill { height: 100%; background: linear-gradient(90deg, var(--color-primary, #c96442), #e07755); border-radius: 4px; transition: width 0.4s ease; }
    .aw-btn { padding: 12px 24px; border: none; border-radius: 10px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s; margin: 4px; }
    .aw-btn-primary { background: var(--color-primary, #c96442); color: white; }
    .aw-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(201, 100, 66, 0.3); }
    .aw-btn-secondary { background: var(--color-muted, #ede9de); color: var(--color-foreground, #3d3929); }
    .aw-btn-hint { background: #fef3c7; color: #92400e; font-size: 13px; padding: 8px 16px; }
    .aw-btn-hint:hover { background: #fde68a; }
    .aw-hint { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 12px 12px 0; margin: 16px 0; display: none; }
    .aw-hint.show { display: block; animation: awFadeIn 0.3s ease; }
    .aw-hint-level { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e; margin-bottom: 8px; }
    .aw-code { background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 12px; font-family: 'SF Mono', Monaco, monospace; font-size: 14px; overflow-x: auto; line-height: 1.6; }
    .aw-highlight { color: #4ec9b0; }
    .aw-keyword { color: #569cd6; }
    .aw-number { color: #b5cea8; }
    .aw-comment { color: #6a9955; }
    .aw-string { color: #ce9178; }
    .aw-prediction { background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%); border: 2px solid #8b5cf6; padding: 20px; border-radius: 12px; margin: 20px 0; }
    .aw-prediction-title { font-weight: 700; color: #5b21b6; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .aw-option { padding: 14px 18px; margin: 10px 0; border: 2px solid var(--color-border, #dad9d4); border-radius: 10px; cursor: pointer; transition: all 0.2s; background: white; }
    .aw-option:hover { border-color: var(--color-primary, #c96442); transform: translateX(4px); }
    .aw-option.correct { border-color: #10b981; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); }
    .aw-option.incorrect { border-color: #ef4444; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); }
    .aw-stack { display: flex; flex-direction: column-reverse; gap: 10px; margin: 24px 0; }
    .aw-frame { padding: 14px 18px; border-radius: 10px; border-left: 5px solid var(--color-primary, #c96442); background: var(--color-muted, #ede9de); transition: all 0.3s ease; font-family: monospace; }
    .aw-frame.active { background: var(--color-primary, #c96442); color: white; transform: scale(1.02); box-shadow: 0 4px 12px rgba(201, 100, 66, 0.3); }
    .aw-frame.returning { border-left-color: #10b981; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); }
    .aw-quiz { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #0ea5e9; padding: 20px; border-radius: 12px; margin: 20px 0; }
    .aw-confidence { display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; }
    .aw-confidence-btn { padding: 8px 16px; border: 2px solid var(--color-border); border-radius: 20px; background: white; cursor: pointer; font-size: 13px; transition: all 0.2s; }
    .aw-confidence-btn:hover { border-color: var(--color-primary); }
    .aw-confidence-btn.selected { background: var(--color-primary); color: white; border-color: var(--color-primary); }
    .aw-direct-answer { background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%); border: 2px solid #ef4444; padding: 20px; border-radius: 12px; margin: 20px 0; display: none; }
    .aw-direct-answer.show { display: block; }
    .aw-completion { text-align: center; padding: 32px; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; margin-top: 20px; display: none; }
    .aw-completion.show { display: block; animation: awFadeIn 0.5s ease; }
    .aw-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
    [role="button"] { cursor: pointer; }
    .aw-metrics { font-size: 12px; color: var(--color-muted-foreground); margin-top: 16px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px; }
  </style>

  <!-- Progress Bar -->
  <div class="aw-progress" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Learning progress">
    <div class="aw-progress-fill" id="aw-progress" style="width: 0%"></div>
  </div>

  <!-- Step 1: Introduction -->
  <div id="aw-step-1" class="aw-step active">
    <h2 style="margin: 0 0 16px 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
      <span style="background: var(--color-primary); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">1</span>
      Understanding ${topic}
    </h2>
    <p style="line-height: 1.7; font-size: 16px; margin-bottom: 20px;" id="aw-intro-text">
      Let's build your understanding step by step. ${difficulty === 'simplified' ? "We'll go slowly with lots of examples." : difficulty === 'advanced' ? "Let's dive into the deeper concepts." : "We'll cover the essentials clearly."}
    </p>
    ${hints_enabled ? `
    <div style="margin: 16px 0;">
      <button class="aw-btn aw-btn-hint" onclick="awShowHint(1, 1)" aria-label="Show hint level 1">💡 Hint Level 1</button>
      <button class="aw-btn aw-btn-hint" onclick="awShowHint(1, 2)" aria-label="Show hint level 2" style="display: none;" id="aw-hint-btn-1-2">💡 Hint Level 2</button>
      <button class="aw-btn aw-btn-hint" onclick="awShowHint(1, 3)" aria-label="Show hint level 3" style="display: none;" id="aw-hint-btn-1-3">💡 Hint Level 3</button>
    </div>
    <div id="aw-hint-1-1" class="aw-hint" role="alert">
      <div class="aw-hint-level">Conceptual Guidance</div>
      <p style="margin: 0;">Think about ${topic} as a way to break a big problem into smaller, identical problems.</p>
    </div>
    <div id="aw-hint-1-2" class="aw-hint" role="alert">
      <div class="aw-hint-level">Partial Solution</div>
      <p style="margin: 0;">The key pattern: solve for the simplest case first (base case), then build up from there.</p>
    </div>
    <div id="aw-hint-1-3" class="aw-hint" role="alert">
      <div class="aw-hint-level">Near-Complete Solution</div>
      <p style="margin: 0;">Every solution has: 1) Base case (when to stop), 2) Recursive case (how to reduce the problem), 3) Return value (what to pass back up).</p>
    </div>
    ` : ''}
    <div style="margin-top: 24px;">
      <button class="aw-btn aw-btn-primary" onclick="awNextStep(2)" aria-label="Continue to step 2">I'm Ready → </button>
    </div>
  </div>

  <!-- Step 2: Code Example -->
  <div id="aw-step-2" class="aw-step">
    <h2 style="margin: 0 0 16px 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
      <span style="background: var(--color-primary); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">2</span>
      See It In Code
    </h2>
    <div class="aw-code">
<span class="aw-keyword">function</span> <span class="aw-highlight">factorial</span>(n) {
  <span class="aw-comment">// Base case: smallest problem</span>
  <span class="aw-keyword">if</span> (n <= <span class="aw-number">1</span>) <span class="aw-keyword">return</span> <span class="aw-number">1</span>;

  <span class="aw-comment">// Recursive case: break it down</span>
  <span class="aw-keyword">return</span> n * <span class="aw-highlight">factorial</span>(n - <span class="aw-number">1</span>);
}
    </div>
    ${hints_enabled ? `
    <div style="margin: 16px 0;">
      <button class="aw-btn aw-btn-hint" onclick="awShowHint(2, 1)" aria-label="Explain the code">💡 Explain This</button>
    </div>
    <div id="aw-hint-2-1" class="aw-hint" role="alert">
      <div class="aw-hint-level">Code Breakdown</div>
      <p style="margin: 0 0 8px 0;"><strong>Line 2:</strong> Base case - when n is 1 or less, just return 1 (we know 1! = 1)</p>
      <p style="margin: 0;"><strong>Line 4:</strong> Recursive case - multiply n by the factorial of (n-1)</p>
    </div>
    ` : ''}
    <div style="margin-top: 24px;">
      <button class="aw-btn aw-btn-secondary" onclick="awNextStep(1)" aria-label="Go back">← Back</button>
      <button class="aw-btn aw-btn-primary" onclick="awNextStep(3)" aria-label="Continue to prediction">Make a Prediction →</button>
    </div>
  </div>

  <!-- Step 3: Prediction Point -->
  <div id="aw-step-3" class="aw-step">
    <h2 style="margin: 0 0 16px 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
      <span style="background: #8b5cf6; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">?</span>
      Prediction Point
    </h2>
    <div class="aw-prediction">
      <div class="aw-prediction-title">🤔 Before we continue...</div>
      <p style="margin: 0 0 16px 0;">What will <code style="background: #ddd6fe; padding: 2px 8px; border-radius: 4px;">factorial(4)</code> return?</p>
      <div id="aw-prediction-options">
        <div class="aw-option" onclick="awCheckPrediction(this, 4, false)" role="button" tabindex="0">4</div>
        <div class="aw-option" onclick="awCheckPrediction(this, 16, false)" role="button" tabindex="0">16</div>
        <div class="aw-option" onclick="awCheckPrediction(this, 24, true)" role="button" tabindex="0">24</div>
        <div class="aw-option" onclick="awCheckPrediction(this, 10, false)" role="button" tabindex="0">10</div>
      </div>
      <div class="aw-confidence" id="aw-confidence-1">
        <span style="font-size: 13px; color: #5b21b6;">How confident are you?</span>
        <button class="aw-confidence-btn" onclick="awSetConfidence(this, 'low')">Not sure</button>
        <button class="aw-confidence-btn" onclick="awSetConfidence(this, 'medium')">Somewhat</button>
        <button class="aw-confidence-btn" onclick="awSetConfidence(this, 'high')">Very confident</button>
      </div>
      <p id="aw-prediction-feedback" style="margin-top: 16px; font-weight: 600; display: none;"></p>
    </div>
    <div style="margin-top: 24px;">
      <button class="aw-btn aw-btn-secondary" onclick="awNextStep(2)" aria-label="Go back">← Back</button>
    </div>
  </div>

  <!-- Step 4: Visualization -->
  <div id="aw-step-4" class="aw-step">
    <h2 style="margin: 0 0 16px 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
      <span style="background: var(--color-primary); color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">3</span>
      Watch It Execute
    </h2>
    <p style="margin-bottom: 16px;">Click <strong>Step</strong> to see how the call stack builds and returns:</p>
    <div class="aw-stack" id="aw-stack" role="list" aria-label="Call stack visualization"></div>
    <div style="text-align: center; margin: 20px 0;">
      <button class="aw-btn aw-btn-primary" id="aw-step-btn" onclick="awAnimateStack()" aria-label="Step through">▶ Step</button>
      <button class="aw-btn aw-btn-secondary" onclick="awResetStack()" aria-label="Reset">↺ Reset</button>
    </div>
    <p id="aw-stack-explain" style="text-align: center; font-weight: 500; min-height: 48px; padding: 12px; background: rgba(0,0,0,0.02); border-radius: 8px;"></p>
    ${direct_answer_available ? `
    <div id="aw-direct-answer" class="aw-direct-answer">
      <h4 style="margin: 0 0 12px 0; color: #dc2626;">📍 Direct Answer</h4>
      <p style="margin: 0 0 8px 0;"><strong>factorial(4) = 24</strong></p>
      <p style="margin: 0;">4! = 4 × 3 × 2 × 1 = 24</p>
      <p style="margin: 8px 0 0 0;">The function calls itself 4 times, building a stack, then multiplies as it returns.</p>
    </div>
    <button class="aw-btn aw-btn-hint" onclick="document.getElementById('aw-direct-answer').classList.add('show')" style="margin-top: 12px;">🆘 Show Direct Answer</button>
    ` : ''}
    <div style="margin-top: 24px;">
      <button class="aw-btn aw-btn-secondary" onclick="awNextStep(3)" aria-label="Go back">← Back</button>
      <button class="aw-btn aw-btn-primary" id="aw-to-quiz" onclick="awNextStep(5)" style="display: none;" aria-label="Continue to quiz">Take the Quiz →</button>
    </div>
  </div>

  <!-- Step 5: Comprehension Check -->
  <div id="aw-step-5" class="aw-step">
    <h2 style="margin: 0 0 16px 0; font-size: 22px; display: flex; align-items: center; gap: 10px;">
      <span style="background: #0ea5e9; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px;">✓</span>
      Check Your Understanding
    </h2>
    <div class="aw-quiz">
      <p style="margin: 0 0 16px 0; font-weight: 600;">What would happen if we removed the base case?</p>
      <div id="aw-quiz-options">
        <div class="aw-option" onclick="awCheckQuiz(this, false)" role="button" tabindex="0">A. Returns 0</div>
        <div class="aw-option" onclick="awCheckQuiz(this, true)" role="button" tabindex="0">B. Infinite loop / Stack overflow</div>
        <div class="aw-option" onclick="awCheckQuiz(this, false)" role="button" tabindex="0">C. Returns undefined</div>
        <div class="aw-option" onclick="awCheckQuiz(this, false)" role="button" tabindex="0">D. Works the same</div>
      </div>
      <div class="aw-confidence" id="aw-confidence-2">
        <span style="font-size: 13px; color: #0369a1;">Confidence level:</span>
        <button class="aw-confidence-btn" onclick="awSetConfidence(this, 'low')">Guessing</button>
        <button class="aw-confidence-btn" onclick="awSetConfidence(this, 'medium')">Think so</button>
        <button class="aw-confidence-btn" onclick="awSetConfidence(this, 'high')">Certain</button>
      </div>
      <p id="aw-quiz-feedback" style="margin-top: 16px; font-weight: 600; display: none;"></p>
    </div>
    <div class="aw-completion" id="aw-completion">
      <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
      <h3 style="margin: 0 0 8px 0; color: #065f46;">Excellent Work!</h3>
      <p style="margin: 0; color: #047857;">You've mastered the basics of ${topic}!</p>
      <div class="aw-metrics" id="aw-metrics"></div>
    </div>
  </div>

  <script>
    // State
    let awCurrentStep = 1;
    let awStackState = 0;
    let awTotalSteps = 5;
    let awStartTime = Date.now();
    let awInteractions = [];
    let awHintsUsed = 0;
    let awErrors = 0;
    let awConfidenceLevel = null;
    let awPredictionCorrect = null;
    let awQuizCorrect = null;

    // Stack animation states
    const awStackStates = [
      { frames: [{t:'factorial(4)',a:true}], e:'factorial(4) called. Needs factorial(3) first.' },
      { frames: [{t:'factorial(4)',a:false},{t:'factorial(3)',a:true}], e:'factorial(3) called. Needs factorial(2).' },
      { frames: [{t:'factorial(4)',a:false},{t:'factorial(3)',a:false},{t:'factorial(2)',a:true}], e:'factorial(2) called. Needs factorial(1).' },
      { frames: [{t:'factorial(4)',a:false},{t:'factorial(3)',a:false},{t:'factorial(2)',a:false},{t:'factorial(1) → 1',a:true}], e:'Base case! factorial(1) returns 1.' },
      { frames: [{t:'factorial(4)',a:false},{t:'factorial(3)',a:false},{t:'factorial(2) → 2×1 = 2',a:true,r:true}], e:'factorial(2) returns 2×1 = 2' },
      { frames: [{t:'factorial(4)',a:false},{t:'factorial(3) → 3×2 = 6',a:true,r:true}], e:'factorial(3) returns 3×2 = 6' },
      { frames: [{t:'factorial(4) → 4×6 = 24',a:true,r:true}], e:'factorial(4) returns 4×6 = 24. Complete!' },
    ];

    function awTrack(type, data = {}) {
      const event = { type, data, time: Date.now() - awStartTime, step: awCurrentStep };
      awInteractions.push(event);
      window.parent.postMessage({ type: 'widget_interaction', ...event, widgetId: 'adaptive-widget' }, '*');
    }

    function awNextStep(step) {
      document.querySelectorAll('.aw-step').forEach(el => el.classList.remove('active'));
      document.getElementById('aw-step-' + step).classList.add('active');
      awCurrentStep = step;
      document.getElementById('aw-progress').style.width = ((step / awTotalSteps) * 100) + '%';
      awTrack('step_change', { to: step });
    }

    function awShowHint(step, level) {
      const hint = document.getElementById('aw-hint-' + step + '-' + level);
      if (hint) {
        hint.classList.add('show');
        awHintsUsed++;
        awTrack('hint_used', { step, level });
        // Show next hint button
        const nextBtn = document.getElementById('aw-hint-btn-' + step + '-' + (level + 1));
        if (nextBtn) nextBtn.style.display = 'inline-block';
      }
    }

    function awSetConfidence(btn, level) {
      btn.parentElement.querySelectorAll('.aw-confidence-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      awConfidenceLevel = level;
      awTrack('confidence_set', { level });
    }

    function awCheckPrediction(el, value, correct) {
      document.querySelectorAll('#aw-prediction-options .aw-option').forEach(o => {
        o.style.pointerEvents = 'none';
        o.classList.remove('correct', 'incorrect');
      });
      el.classList.add(correct ? 'correct' : 'incorrect');
      awPredictionCorrect = correct;
      const feedback = document.getElementById('aw-prediction-feedback');
      feedback.style.display = 'block';
      if (correct) {
        feedback.innerHTML = '✅ <span style="color:#065f46">Correct! 4! = 4×3×2×1 = 24</span>';
        setTimeout(() => awNextStep(4), 1500);
      } else {
        feedback.innerHTML = '❌ <span style="color:#dc2626">Not quite. 4! = 4×3×2×1. Try to trace through!</span>';
        awErrors++;
      }
      awTrack('prediction', { value, correct, confidence: awConfidenceLevel });
    }

    function awAnimateStack() {
      if (awStackState >= awStackStates.length) return;
      const state = awStackStates[awStackState];
      const container = document.getElementById('aw-stack');
      container.innerHTML = state.frames.map(f =>
        '<div class="aw-frame' + (f.a ? ' active' : '') + (f.r ? ' returning' : '') + '" role="listitem">' + f.t + '</div>'
      ).join('');
      document.getElementById('aw-stack-explain').textContent = state.e;
      awStackState++;
      awTrack('stack_step', { state: awStackState });
      if (awStackState >= awStackStates.length) {
        document.getElementById('aw-step-btn').innerHTML = '✓ Done';
        document.getElementById('aw-step-btn').disabled = true;
        document.getElementById('aw-to-quiz').style.display = 'inline-block';
      }
    }

    function awResetStack() {
      awStackState = 0;
      document.getElementById('aw-stack').innerHTML = '';
      document.getElementById('aw-stack-explain').textContent = '';
      document.getElementById('aw-step-btn').innerHTML = '▶ Step';
      document.getElementById('aw-step-btn').disabled = false;
      document.getElementById('aw-to-quiz').style.display = 'none';
      awTrack('stack_reset');
    }

    function awCheckQuiz(el, correct) {
      document.querySelectorAll('#aw-quiz-options .aw-option').forEach(o => {
        o.style.pointerEvents = 'none';
        o.classList.remove('correct', 'incorrect');
      });
      el.classList.add(correct ? 'correct' : 'incorrect');
      if (!correct) {
        document.querySelectorAll('#aw-quiz-options .aw-option')[1].classList.add('correct');
        awErrors++;
      }
      awQuizCorrect = correct;
      const feedback = document.getElementById('aw-quiz-feedback');
      feedback.style.display = 'block';
      feedback.innerHTML = correct
        ? '✅ <span style="color:#065f46">Exactly! Without a base case, recursion never stops.</span>'
        : '❌ <span style="color:#dc2626">The correct answer is B - it would recurse forever!</span>';

      // Show completion
      setTimeout(() => {
        document.getElementById('aw-completion').classList.add('show');
        awShowMetrics();
        awSendAnalytics();
      }, 1000);

      awTrack('quiz_answer', { correct, confidence: awConfidenceLevel });
    }

    function awShowMetrics() {
      const duration = Math.round((Date.now() - awStartTime) / 1000);
      const effectiveness = Math.max(0, Math.min(100,
        ((awQuizCorrect ? 50 : 0) + (awPredictionCorrect ? 20 : 0)) +
        (awInteractions.length > 5 ? 20 : awInteractions.length * 4) -
        (awHintsUsed * 10) -
        (awErrors * 5)
      ));
      document.getElementById('aw-metrics').innerHTML =
        '<strong>Session Stats:</strong> ' + duration + 's · ' +
        awInteractions.length + ' interactions · ' +
        awHintsUsed + ' hints · ' +
        'Effectiveness: ' + effectiveness + '%';
    }

    function awSendAnalytics() {
      window.parent.postMessage({
        type: 'widget_analytics',
        widgetId: 'adaptive-widget',
        data: {
          completionRate: 1,
          quizScore: awQuizCorrect ? 1 : 0,
          predictionScore: awPredictionCorrect ? 1 : 0,
          hintsUsed: awHintsUsed,
          errorsCount: awErrors,
          confidenceLevel: awConfidenceLevel,
          totalTime: Date.now() - awStartTime,
          interactions: awInteractions.length,
        }
      }, '*');
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && document.activeElement.classList.contains('aw-option')) {
        document.activeElement.click();
      }
    });

    // Track hesitation (no interaction for 30s)
    let awHesitationTimer = setInterval(() => {
      const lastInteraction = awInteractions[awInteractions.length - 1];
      if (!lastInteraction || (Date.now() - awStartTime - lastInteraction.time) > 30000) {
        awTrack('hesitation_detected');
      }
    }, 30000);
  </script>
</div>`;
  }

  /**
   * Generate prediction widget HTML
   */
  _generatePredictionHTML(topic, personalization, interactionModel) {
    return `<div id="prediction-widget" style="font-family: system-ui, sans-serif; padding: 24px; background: var(--color-card); border-radius: 16px;">
  <h2 style="margin: 0 0 20px 0;">🔮 Prediction Challenge: ${topic}</h2>
  <p>This widget surfaces misconceptions through prediction-based learning.</p>
  <div style="background: #ede9fe; padding: 20px; border-radius: 12px; margin: 20px 0;">
    <p><strong>Your task:</strong> Predict what will happen before seeing the answer.</p>
  </div>
  <!-- Full prediction widget implementation would go here -->
</div>`;
  }

  /**
   * Generate challenge widget HTML
   */
  _generateChallengeHTML(topic, personalization, interactionModel) {
    return `<div id="challenge-widget" style="font-family: system-ui, sans-serif; padding: 24px; background: var(--color-card); border-radius: 16px;">
  <h2 style="margin: 0 0 20px 0;">🏆 Challenge Mode: ${topic}</h2>
  <p>Ready to test your mastery? Complete these challenges!</p>
  <!-- Full challenge widget implementation would go here -->
</div>`;
  }

  /**
   * Generate quiz widget HTML
   */
  _generateQuizHTML(topic, personalization, interactionModel) {
    return `<div id="quiz-widget" style="font-family: system-ui, sans-serif; padding: 24px; background: var(--color-card); border-radius: 16px;">
  <h2 style="margin: 0 0 20px 0;">📝 Quick Assessment: ${topic}</h2>
  <p>Test your understanding with these questions.</p>
  <!-- Full quiz widget implementation would go here -->
</div>`;
  }

  /**
   * Generate drag-drop widget HTML
   */
  _generateDragDropHTML(topic, personalization, interactionModel) {
    return `<div id="dragdrop-widget" style="font-family: system-ui, sans-serif; padding: 24px; background: var(--color-card); border-radius: 16px;">
  <h2 style="margin: 0 0 20px 0;">🎯 Hands-On: ${topic}</h2>
  <p>Drag and drop to match concepts with their definitions.</p>
  <!-- Full drag-drop widget implementation would go here -->
</div>`;
  }

  /**
   * Generate concept map widget HTML
   */
  _generateConceptMapHTML(topic, personalization, interactionModel) {
    return `<div id="conceptmap-widget" style="font-family: system-ui, sans-serif; padding: 24px; background: var(--color-card); border-radius: 16px;">
  <h2 style="margin: 0 0 20px 0;">🗺️ Concept Map: ${topic}</h2>
  <p>Explore how concepts connect to each other.</p>
  <!-- Full concept map widget implementation would go here -->
</div>`;
  }

  /**
   * Generate comparison table widget HTML
   */
  _generateComparisonHTML(topic, personalization, interactionModel) {
    return `<div id="comparison-widget" style="font-family: system-ui, sans-serif; padding: 24px; background: var(--color-card); border-radius: 16px;">
  <h2 style="margin: 0 0 20px 0;">📊 Compare & Contrast: ${topic}</h2>
  <p>See the key differences and similarities.</p>
  <!-- Full comparison table widget implementation would go here -->
</div>`;
  }

  // ===========================================================================
  // ANALYTICS HOOKS BUILDER
  // ===========================================================================

  _buildAnalyticsHooks(cognitiveState) {
    return {
      track_interactions: true,
      track_hesitation: cognitiveState === COGNITIVE_STATES.STRUGGLING || cognitiveState === COGNITIVE_STATES.CONFUSED,
      track_completion: true,
      track_errors: true,
      track_hint_usage: true,
      track_confidence: true,
      track_time_per_step: true,
      track_prediction_accuracy: true,
      compute_learning_effectiveness: true,
    };
  }

  // ===========================================================================
  // ADAPTATION RULES BUILDER
  // ===========================================================================

  _buildAdaptationRules(cognitiveState, escalation) {
    const rules = {
      on_struggle: 'simplify + auto_show_hints + slow_pacing + add_scaffolding',
      on_success: 'increase_difficulty + reduce_hints + faster_pacing',
      on_bored: 'increase_challenge + add_gamification + skip_basics',
      on_confusion: 'add_misconception_explanation + prediction_exercise + slow_down',
    };

    // Add escalation-specific rules
    if (escalation.level >= 2) {
      rules.on_struggle = 'change_modality + provide_direct_example + maximum_scaffolding';
    }
    if (escalation.level >= 3) {
      rules.on_struggle = 'provide_direct_answer + full_breakdown + suggest_prerequisite_review';
    }

    return rules;
  }

  // ===========================================================================
  // CACHE KEY GENERATOR
  // ===========================================================================

  _generateCacheKey(topic, decision, personalization) {
    const context = {
      topic: (topic || '').toLowerCase(),
      difficulty: personalization.difficulty,
      learning_style: personalization.learning_style,
      widget_type: decision.widget_type,
    };

    const contextString = JSON.stringify(context);
    const hash = crypto.createHash('sha256').update(contextString).digest('hex').slice(0, 16);

    return {
      key: hash,
      context_signature: contextString,
    };
  }

  // ===========================================================================
  // REAL-TIME ADAPTATION
  // ===========================================================================

  /**
   * Adapt widget based on real-time signals (called when user interacts)
   */
  async adaptInRealtime(currentWidget, newSignals) {
    const { incorrect_attempts = 0, hesitation_detected = false, confidence = 'stable' } = newSignals;

    // Determine if we need to adapt
    const needsAdaptation =
      incorrect_attempts > 2 ||
      hesitation_detected ||
      confidence === 'decreasing';

    if (!needsAdaptation) {
      return { adapted: false, widget: currentWidget };
    }

    // Apply adaptations
    const adaptedWidget = { ...currentWidget };

    if (incorrect_attempts > 3) {
      adaptedWidget.personalization_applied.difficulty = 'simplified';
      adaptedWidget.interaction_model.auto_hints_enabled = true;
      adaptedWidget.interaction_model.hint_levels = Math.min(5, adaptedWidget.interaction_model.hint_levels + 1);
    }

    if (hesitation_detected) {
      adaptedWidget.personalization_applied.pace = 'slow';
    }

    if (confidence === 'decreasing') {
      adaptedWidget.personalization_applied.confidence_adjustment = 'decreased_based_on_realtime';
    }

    adaptedWidget.adaptation_applied_at = new Date().toISOString();
    adaptedWidget.adaptation_reason = `Adapted due to: ${incorrect_attempts} errors, hesitation: ${hesitation_detected}, confidence: ${confidence}`;

    return { adapted: true, widget: adaptedWidget };
  }

  /**
   * Calculate learning effectiveness score
   */
  calculateLearningEffectiveness(analytics) {
    const {
      quizScore = 0,
      completionRate = 0,
      hintsUsed = 0,
      errorsCount = 0,
    } = analytics;

    // Formula: (quizScore * 0.5) + (completionRate * 0.2) - (hintsUsed * 0.2) - (errorsCount * 0.1)
    const effectiveness =
      (quizScore * 0.5) +
      (completionRate * 0.2) -
      (hintsUsed * 0.05) - // Normalized: each hint costs 5%
      (errorsCount * 0.03); // Normalized: each error costs 3%

    return Math.max(0, Math.min(1, effectiveness));
  }

  /**
   * Interpret comprehension check results
   */
  interpretComprehension(correct, confidenceLevel) {
    // correct + low confidence → fragile knowledge
    // wrong + high confidence → misconception
    // correct + high confidence → mastery

    if (correct && confidenceLevel === 'low') {
      return {
        status: 'fragile_knowledge',
        recommendation: 'Reinforce with additional examples and practice',
        action: 'add_reinforcement_exercise',
      };
    }

    if (!correct && confidenceLevel === 'high') {
      return {
        status: 'misconception_detected',
        recommendation: 'Address misconception directly with counter-examples',
        action: 'show_misconception_correction',
      };
    }

    if (correct && confidenceLevel === 'high') {
      return {
        status: 'mastery',
        recommendation: 'Advance to more challenging content',
        action: 'increase_difficulty',
      };
    }

    return {
      status: 'learning',
      recommendation: 'Continue with current approach',
      action: 'continue',
    };
  }
}

export default AdaptiveLearningEngine;
