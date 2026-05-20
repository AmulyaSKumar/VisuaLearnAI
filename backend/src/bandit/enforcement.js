/**
 * Action Enforcement Module
 * Validates that responses match the selected bandit action
 */

import { logger } from '../utils/logger.js';
import { FAILSAFE_ACTION } from './algorithm.js';

// Fallback alert threshold - if fallback rate exceeds this, system is becoming rule-based
const FALLBACK_ALERT_THRESHOLD = parseFloat(process.env.BANDIT_FALLBACK_THRESHOLD || '0.15');

/**
 * Action requirements for validation
 */
export const ACTION_REQUIREMENTS = {
  visual_widget: {
    description: 'Must include a widget/visualization',
    mustHave: ['tool_use'],
    toolName: 'show_widget',
    mustNotBe: ['text_only'],
  },
  guided_steps: {
    description: 'Must have numbered step-by-step structure',
    mustHave: ['numbered_steps'],
    pattern: /(?:\d+\.\s+|\*\s+|-\s+)/m,
    minSteps: 2,
  },
  quiz_check: {
    description: 'Must include a question for comprehension check',
    mustHave: ['question'],
    pattern: /\?/,
    questionIndicators: ['?', 'what', 'how', 'why', 'can you', 'do you', 'think about', 'consider'],
  },
  text_explanation: {
    description: 'Must be concise text without forcing widgets',
    mustNotHave: ['tool_use'],
    maxLength: 3000,
  },
  socratic_questioning: {
    description: 'Must guide with questions and avoid giving a direct answer first',
    minQuestions: 2,
    directAnswerMarkers: ['the answer is', 'answer:', 'solution:', 'final answer', 'therefore the answer'],
  },
  remediation: {
    description: 'Must identify an error or misconception and restate the idea more simply',
    misconceptionIndicators: ['misconception', 'mistake', 'error', 'incorrect', 'confusion', 'common trap', 'not quite'],
    correctionIndicators: ['correct', 'instead', 'fix', 'should be', 'try this', 'better way'],
    simplificationIndicators: ['simpler', 'in simple terms', 'basic idea', 'step back', 'plainly'],
  },
};

function countQuestionMarks(text = '') {
  return (text.match(/\?/g) || []).length;
}

function includesAny(text = '', terms = []) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function hasDirectAnswerBeforeQuestion(text = '', markers = []) {
  const lower = text.toLowerCase();
  const firstQuestionIndex = lower.indexOf('?');
  return markers.some((marker) => {
    const markerIndex = lower.indexOf(marker);
    return markerIndex !== -1 && (firstQuestionIndex === -1 || markerIndex < firstQuestionIndex);
  });
}

/**
 * Validate response against action requirements (chat)
 * @param {string} action - Selected bandit action
 * @param {string} responseText - Full response text
 * @param {Array} toolCalls - Tool calls made during response
 * @returns {Object} Validation result
 */
export function validateChatResponse(action, responseText = '', toolCalls = []) {
  const rules = ACTION_REQUIREMENTS[action];
  if (!rules) {
    return { valid: true, violations: [], suggestion: null };
  }

  const violations = [];
  const hasToolUse = toolCalls && toolCalls.length > 0;
  const hasShowWidget = toolCalls?.some(t => t.name === 'show_widget');

  switch (action) {
    case 'visual_widget':
      if (!hasShowWidget) {
        violations.push('Response does not include a show_widget tool call');
      }
      break;

    case 'guided_steps':
      // Check for numbered steps or bullet points
      const stepMatches = responseText.match(/(?:\d+\.\s+|\*\s+|-\s+)/gm);
      if (!stepMatches || stepMatches.length < rules.minSteps) {
        violations.push(`Response should have at least ${rules.minSteps} numbered/bulleted steps, found ${stepMatches?.length || 0}`);
      }
      break;

    case 'quiz_check':
      // Check for question marks or question indicators
      const hasQuestion = responseText.includes('?') ||
        rules.questionIndicators.some(indicator =>
          responseText.toLowerCase().includes(indicator)
        );
      if (!hasQuestion) {
        violations.push('Response does not include a comprehension question');
      }
      break;

    case 'text_explanation':
      if (hasShowWidget) {
        violations.push('Response includes widget when text-only explanation was requested');
      }
      if (responseText.length > rules.maxLength) {
        violations.push(`Response exceeds max length of ${rules.maxLength} characters`);
      }
      break;

    case 'socratic_questioning':
      if (countQuestionMarks(responseText) < rules.minQuestions) {
        violations.push(`Response should include at least ${rules.minQuestions} guiding questions`);
      }
      if (hasDirectAnswerBeforeQuestion(responseText, rules.directAnswerMarkers)) {
        violations.push('Response gives a direct answer before asking guiding questions');
      }
      break;

    case 'remediation':
      if (!includesAny(responseText, rules.misconceptionIndicators)) {
        violations.push('Response should explicitly identify a misconception, mistake, or error');
      }
      if (!includesAny(responseText, rules.correctionIndicators)) {
        violations.push('Response should include a corrected explanation');
      }
      if (!includesAny(responseText, rules.simplificationIndicators)) {
        violations.push('Response should include a simpler restatement');
      }
      break;
  }

  return {
    valid: violations.length === 0,
    violations,
    suggestion: violations.length > 0 ? `Consider regenerating to match ${action} requirements` : null,
  };
}

/**
 * Validate learning content against action requirements
 * @param {string} action - Selected bandit action
 * @param {string} contentType - Type of content (learn, quiz, examples, etc.)
 * @param {Object} content - Generated content object
 * @returns {Object} Validation result
 */
export function validateLearningContent(action, contentType, content) {
  if (!content) {
    return { valid: false, violations: ['No content generated'], suggestion: null };
  }

  const violations = [];

  switch (action) {
    case 'visual_widget':
      // For learn content, should have visual elements
      // The learning content schema uses: concept, code, mistake, insight blocks
      // For programming topics: code blocks are visual learning elements
      // For non-programming topics: rich key_ideas with multiple blocks count as visual
      if (contentType === 'learn') {
        const hasExplicitVisual = content.key_ideas?.some(idea =>
          idea.blocks?.some(b =>
            b.type === 'visualization' ||
            b.type === 'diagram' ||
            b.type === 'chart' ||
            b.type === 'code'
          )
        );
        // Also accept rich structured content as "visual" for non-programming topics
        const hasRichContent = content.key_ideas?.length >= 3 &&
          content.key_ideas.some(idea => idea.blocks && idea.blocks.length >= 2);

        if (!hasExplicitVisual && !hasRichContent) {
          violations.push('Learning content lacks visual blocks (code, diagram, or chart) for visual_widget action');
        }
      }
      break;

    case 'guided_steps':
      // Should have step-by-step structure with multiple blocks per idea
      if (contentType === 'learn') {
        const hasSteps = content.key_ideas?.every(idea =>
          idea.blocks && idea.blocks.length >= 2
        );
        if (!hasSteps) {
          violations.push('Learning content lacks step-by-step structure for guided_steps action');
        }
      }
      break;

    case 'quiz_check':
      // Should have quiz questions or comprehension checks
      if (contentType === 'learn') {
        const hasComprehensionCheck = content.comprehension_checks?.length > 0 ||
          content.key_ideas?.some(idea => idea.blocks?.some(b => b.type === 'question'));
        if (!hasComprehensionCheck) {
          violations.push('Learning content lacks comprehension checks for quiz_check action');
        }
      }
      if (contentType === 'quiz') {
        if (!content.quiz || content.quiz.length === 0) {
          violations.push('Quiz content is empty for quiz_check action');
        }
      }
      break;

    case 'text_explanation':
      // Should be concise, not heavy on visuals
      if (contentType === 'learn') {
        const visualCount = content.key_ideas?.reduce((count, idea) =>
          count + (idea.blocks?.filter(b => b.type === 'visualization').length || 0), 0) || 0;
        const totalBlocks = content.key_ideas?.reduce((count, idea) =>
          count + (idea.blocks?.length || 0), 0) || 0;

        if (totalBlocks > 0 && visualCount / totalBlocks > 0.5) {
          violations.push('Learning content has too many visualizations for text_explanation action');
        }
      }
      break;

    case 'socratic_questioning': {
      const serialized = JSON.stringify(content);
      const rules = ACTION_REQUIREMENTS.socratic_questioning;
      if (countQuestionMarks(serialized) < rules.minQuestions) {
        violations.push(`Learning content should include at least ${rules.minQuestions} guiding questions`);
      }
      if (hasDirectAnswerBeforeQuestion(serialized, rules.directAnswerMarkers)) {
        violations.push('Learning content gives a direct answer before guiding questions');
      }
      break;
    }

    case 'remediation': {
      const serialized = JSON.stringify(content);
      const rules = ACTION_REQUIREMENTS.remediation;
      if (!includesAny(serialized, rules.misconceptionIndicators)) {
        violations.push('Learning content should identify a misconception, mistake, or error');
      }
      if (!includesAny(serialized, rules.correctionIndicators)) {
        violations.push('Learning content should include a corrected explanation');
      }
      if (!includesAny(serialized, rules.simplificationIndicators)) {
        violations.push('Learning content should include a simpler restatement');
      }
      break;
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    suggestion: violations.length > 0 ? `Consider adjusting content to match ${action} requirements` : null,
  };
}

/**
 * Enforcement Monitor - Tracks fallback rates and alerts
 */
export class EnforcementMonitor {
  constructor(windowSize = 100) {
    this.enforcementHistory = [];
    this.windowSize = windowSize;
  }

  /**
   * Record an enforcement attempt
   */
  recordEnforcement(action, enforced, violations = []) {
    this.enforcementHistory.push({
      action,
      enforced,
      violations,
      ts: Date.now(),
    });

    // Trim to window size
    if (this.enforcementHistory.length > this.windowSize) {
      this.enforcementHistory.shift();
    }

    // Check fallback rate
    this.checkFallbackRate();
  }

  /**
   * Check if fallback rate is too high
   */
  checkFallbackRate() {
    if (this.enforcementHistory.length < 10) return; // Need minimum samples

    const fallbackCount = this.enforcementHistory.filter(e => !e.enforced).length;
    const fallbackRate = fallbackCount / this.enforcementHistory.length;

    if (fallbackRate > FALLBACK_ALERT_THRESHOLD) {
      // Get per-action failure rates
      const byAction = this.getByActionStats();

      logger.error({
        fallbackRate,
        threshold: FALLBACK_ALERT_THRESHOLD,
        windowSize: this.enforcementHistory.length,
        byAction,
        recentViolations: this.getRecentViolations(5),
      }, 'ENFORCEMENT ALERT: Fallback rate too high - system becoming rule-based');
    }
  }

  /**
   * Get per-action enforcement stats
   */
  getByActionStats() {
    const stats = {};

    this.enforcementHistory.forEach(e => {
      if (!stats[e.action]) {
        stats[e.action] = { total: 0, failed: 0, violations: [] };
      }
      stats[e.action].total++;
      if (!e.enforced) {
        stats[e.action].failed++;
        stats[e.action].violations.push(...e.violations);
      }
    });

    // Calculate rates
    for (const action of Object.keys(stats)) {
      stats[action].failureRate = stats[action].failed / stats[action].total;
      // Get unique violations
      stats[action].uniqueViolations = [...new Set(stats[action].violations)];
    }

    return stats;
  }

  /**
   * Get recent violations for debugging
   */
  getRecentViolations(limit = 10) {
    return this.enforcementHistory
      .filter(e => !e.enforced)
      .slice(-limit)
      .map(e => ({ action: e.action, violations: e.violations, ts: e.ts }));
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    const total = this.enforcementHistory.length;
    const failed = this.enforcementHistory.filter(e => !e.enforced).length;

    return {
      total,
      failed,
      fallbackRate: total > 0 ? failed / total : 0,
      threshold: FALLBACK_ALERT_THRESHOLD,
      byAction: this.getByActionStats(),
    };
  }
}

// Singleton monitor instance
export const enforcementMonitor = new EnforcementMonitor();

/**
 * Enforce action on chat response
 * Returns enforcement result and logs to monitor
 */
export function enforceChatAction(action, responseText, toolCalls) {
  const validation = validateChatResponse(action, responseText, toolCalls);

  // Always log enforcement attempt
  enforcementMonitor.recordEnforcement(action, validation.valid, validation.violations);

  if (!validation.valid) {
    logger.warn({
      action,
      violations: validation.violations,
      fallbackAction: FAILSAFE_ACTION,
    }, 'Chat enforcement failed - using fallback');

    return {
      enforced: false,
      fallback: FAILSAFE_ACTION,
      violations: validation.violations,
      originalAction: action,
    };
  }

  return { enforced: true, action };
}

/**
 * Enforce action on learning content
 * Returns enforcement result and logs to monitor
 */
export function enforceLearningAction(action, contentType, content) {
  const validation = validateLearningContent(action, contentType, content);

  // Always log enforcement attempt
  enforcementMonitor.recordEnforcement(action, validation.valid, validation.violations);

  if (!validation.valid) {
    logger.warn({
      action,
      contentType,
      violations: validation.violations,
      fallbackAction: FAILSAFE_ACTION,
    }, 'Learning content enforcement failed - using fallback');

    return {
      enforced: false,
      fallback: FAILSAFE_ACTION,
      violations: validation.violations,
      originalAction: action,
    };
  }

  return { enforced: true, action };
}
