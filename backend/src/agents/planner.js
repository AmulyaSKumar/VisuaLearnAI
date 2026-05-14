/**
 * Planner Agent (Phase 9A)
 * Generates structured learning plans from user goals
 * @module agents/planner
 */

import { BaseAgent } from './base-agent.js';
import { logger } from '../utils/logger.js';
import { getTopicRecommendations } from './personalization.js';
import { createTextCompletion } from '../services/openai/azure-client.js';

export class PlannerAgent extends BaseAgent {
  /**
   * Retry configuration for PlannerAgent
   * Higher retries since plan generation is critical
   */
  static retryConfig = { maxRetries: 3 };

  constructor() {
    super(
      'planner',
      'Generates structured learning plans with steps, resources, and estimated time',
      '1.0.0'
    );
  }

  /**
   * Generate a learning plan for a goal
   * @param {Object} input - { goal: string, context?: string, targetLevel?: string }
   * @param {Object} context - { userId?: string, userProfile?: Object }
   * @returns {Object} Learning plan with structure, steps, and resources
   */
  async execute(input, context = {}) {
    this.validateInput(input, ['goal']);

    const { goal, context: userContext = '', targetLevel = 'intermediate' } = input;
    const { userId, userProfile = {} } = context;

    logger.info('Planner: Generating plan', { goal, userId });

    // Build the prompt for the configured chat model
    const prompt = this._buildPlannerPrompt(goal, userContext, targetLevel, userProfile);

    try {
      const plan = await this._generatePlanWithModel(prompt);

      logger.info('Planner: Plan generated successfully', { goal, steps: plan.steps?.length });

      return {
        goal,
        targetLevel,
        plan,
        generatedAt: new Date().toISOString(),
        userId,
      };
    } catch (error) {
      logger.error('Planner: Failed to generate plan', { goal, error: error.message });
      throw error;
    }
  }

  /**
   * Build a structured prompt to generate a learning plan
   * Enhanced with personalization based on user profile and topic strengths
   */
  _buildPlannerPrompt(goal, userContext, targetLevel, userProfile) {
    // Extract personalization parameters
    const knowledgeLevel = userProfile.comprehension?.currentLevel || userProfile.knowledge_level || 'intermediate';
    const scores = userProfile.scores || userProfile.styleScores || {
      visual: 0.25,
      auditory: 0.25,
      reading: 0.25,
      kinesthetic: 0.25,
    };
    const primaryStyle = userProfile.dominant_style || userProfile.primaryStyle || 'visual';

    // Determine step count and complexity based on knowledge level
    const levelConfig = this._getLevelConfig(knowledgeLevel);

    // Determine content emphasis based on learning style
    const styleEmphasis = this._getStyleEmphasis(scores, primaryStyle);

    // Get topic-specific recommendations based on weak/strong topics
    const topicRecs = getTopicRecommendations(userProfile, goal);

    // Build topic-specific instructions
    let topicInstructions = '';
    if (topicRecs.extraInstructions) {
      topicInstructions = `\nTOPIC-SPECIFIC ADJUSTMENTS:\n${topicRecs.extraInstructions}`;
    }

    // Adjust step count if weak topic detected
    const adjustedLevelConfig = topicRecs.needsExtraSteps
      ? { ...levelConfig, stepRule: levelConfig.stepRule + ' (ADD 2-3 EXTRA STEPS for this weak topic)' }
      : levelConfig;

    return `You are an expert learning plan designer. Generate a structured learning plan for the following goal.

GOAL: "${goal}"

${userContext ? `ADDITIONAL CONTEXT: ${userContext}` : ''}
TARGET LEVEL: ${targetLevel} (beginner, intermediate, advanced)

LEARNER PROFILE:
- Learning Style: ${primaryStyle} (visual: ${(scores.visual * 100).toFixed(0)}%, auditory: ${(scores.auditory * 100).toFixed(0)}%, reading: ${(scores.reading * 100).toFixed(0)}%, kinesthetic: ${(scores.kinesthetic * 100).toFixed(0)}%)
- Knowledge Level: ${knowledgeLevel}
- Language: ${userProfile.language?.preferred || 'en'}
- Weak Topics: ${(userProfile.weak_topics || []).join(', ') || 'none identified'}
- Strong Topics: ${(userProfile.strong_topics || []).join(', ') || 'none identified'}

PERSONALIZATION REQUIREMENTS:
${adjustedLevelConfig.instructions}
${styleEmphasis.instructions}${topicInstructions}

Generate a JSON response with this exact structure:
{
  "title": "Clear, engaging title for the plan",
  "overview": "2-3 sentence overview",
  "estimatedDuration": "e.g., 2-3 hours, 1 week",
  "prerequisites": ["skill1", "skill2"],
  "learningOutcomes": [
    "By the end, you will be able to...",
    "You will understand..."
  ],
  "steps": [
    {
      "number": 1,
      "title": "Step title",
      "description": "What will be covered",
      "duration": "15 mins",
      "type": "concept|visualization|practice|reading",
      "resources": [
        {
          "type": "explanation",
          "content": "Key concept explanation"
        },
        {
          "type": "visualization",
          "description": "What visualization would help (e.g., 'interactive graph showing...')"
        },
        {
          "type": "example",
          "description": "Real-world example"
        },
        {
          "type": "practice",
          "description": "Hands-on exercise or task"
        }
      ]
    }
  ],
  "checkpoints": [
    {
      "step": 1,
      "question": "Quick self-check question",
      "expectedAnswer": "What they should understand"
    }
  ],
  "nextSteps": ["What to learn after this plan"]
}

IMPORTANT RULES:
1. Return ONLY valid JSON - no markdown, no explanation, no code blocks
2. Start your response with { and end with }
3. ${adjustedLevelConfig.stepRule}
4. Visualizations should describe WHAT to show, not code
5. Make step descriptions specific to the topic
6. ${styleEmphasis.resourceRule}`;
  }

  /**
   * Get configuration based on knowledge level
   */
  _getLevelConfig(knowledgeLevel) {
    const configs = {
      beginner: {
        stepCount: '5-7',
        instructions: `- BEGINNER LEARNER: Create MORE steps (5-7) with simpler progression
- Use very simple language, define all terms
- Start with absolute basics, build up gradually
- Include more checkpoints for validation
- Shorter duration per step (10-15 mins each)`,
        stepRule: 'Create 5-7 steps with gentle, incremental progression for beginners',
      },
      intermediate: {
        stepCount: '4-5',
        instructions: `- INTERMEDIATE LEARNER: Create balanced plan (4-5 steps)
- Assume basic knowledge, focus on connections
- Mix theory with practical application
- Moderate pace with clear explanations`,
        stepRule: 'Create 4-5 well-balanced steps for intermediate learners',
      },
      advanced: {
        stepCount: '3-4',
        instructions: `- ADVANCED LEARNER: Create FEWER steps (3-4) with deeper topics
- Skip basics, dive into advanced concepts
- Focus on edge cases, optimizations, best practices
- Include challenging exercises and real-world complexity
- Longer, more intensive steps (30-45 mins each)`,
        stepRule: 'Create 3-4 in-depth steps focusing on advanced concepts and edge cases',
      },
    };
    return configs[knowledgeLevel] || configs.intermediate;
  }

  /**
   * Get content emphasis based on learning style scores
   */
  _getStyleEmphasis(scores, primaryStyle) {
    const emphases = [];
    let resourceRule = 'Include a mix of resources';

    // Visual learner (score > 0.4)
    if (scores.visual > 0.4) {
      emphases.push(`- VISUAL LEARNER: Include "visualization" tasks in EVERY step
- Add diagrams, charts, flowcharts, mind maps
- Describe visual representations for abstract concepts
- Use color-coding and spatial organization`);
      resourceRule = 'MUST include at least one visualization resource per step';
    }

    // Kinesthetic learner (score > 0.4)
    if (scores.kinesthetic > 0.4) {
      emphases.push(`- KINESTHETIC LEARNER: Include "practice" tasks in EVERY step
- Add hands-on exercises, experiments, simulations
- Learning by doing - interactive elements
- Build something tangible at each step`);
      resourceRule = 'MUST include at least one practice/hands-on resource per step';
    }

    // Reading learner (score > 0.4)
    if (scores.reading > 0.4) {
      emphases.push(`- READING/WRITING LEARNER: Include detailed explanations
- Provide comprehensive written content
- Add note-taking prompts and summaries
- Include references for further reading`);
    }

    // Auditory learner (score > 0.4)
    if (scores.auditory > 0.4) {
      emphases.push(`- AUDITORY LEARNER: Include discussion points
- Add verbal explanation cues
- Include podcasts or video recommendations
- Suggest study groups or verbal review`);
    }

    return {
      instructions: emphases.length > 0 ? emphases.join('\n') : '- Balanced learning approach',
      resourceRule,
    };
  }

  /**
   * Call the configured chat model to generate the plan
   */
  async _generatePlanWithModel(prompt) {
    try {
      const responseText = await createTextCompletion({
        maxTokens: 4000,
        system: 'You are a learning plan generator. Always respond with valid JSON only, no additional text or markdown formatting. Start your response with { and end with }.',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Try to extract and parse JSON with robust fallback
      const plan = this._parseJsonPlan(responseText, prompt.split('"')[1] || 'Learning');
      return plan;
    } catch (error) {
      logger.error('Planner: model API error', { error: error.message });
      throw error;
    }
  }

  /**
   * Parse JSON plan from response with robust error recovery
   */
  _parseJsonPlan(responseText, goal = '') {
    // Log response for debugging
    logger.debug('Planner model response received', {
      length: responseText.length,
      preview: responseText.substring(0, 300),
    });

    // Clean up common issues in the response
    let cleanedText = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    // Try to find JSON block - look for the first { and last }
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      logger.warn('No valid JSON block found in response, using fallback');
      return this._getFallbackPlan(goal);
    }

    const jsonStr = cleanedText.substring(firstBrace, lastBrace + 1);

    // Try direct parsing first
    try {
      const parsed = JSON.parse(jsonStr);
      logger.info('JSON parsed successfully');
      return parsed;
    } catch (e) {
      logger.debug('Direct JSON parse failed, attempting recovery', { error: e.message });
    }

    // Recovery: Try to fix common JSON issues
    try {
      // Fix trailing commas, unescaped quotes, etc
      let fixedJson = jsonStr
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .replace(/\t/g, ' ');

      const parsed = JSON.parse(fixedJson);
      logger.info('JSON parsed after cleanup');
      return parsed;
    } catch (e) {
      logger.debug('JSON cleanup parse failed', { error: e.message });
    }

    // Final recovery: Find matching braces more carefully
    let braceCount = 0;
    let startIdx = -1;
    let endIdx = -1;

    for (let i = 0; i < cleanedText.length; i++) {
      if (cleanedText[i] === '{') {
        if (startIdx === -1) startIdx = i;
        braceCount++;
      } else if (cleanedText[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIdx !== -1) {
          endIdx = i + 1;
          break;
        }
      }
    }

    if (startIdx !== -1 && endIdx !== -1) {
      const trimmedJson = cleanedText.substring(startIdx, endIdx);
      try {
        return JSON.parse(trimmedJson);
      } catch (e) {
        logger.error('Final JSON recovery failed', { error: e.message });
      }
    }

    logger.warn('All JSON parsing attempts failed, using fallback');
    return this._getFallbackPlan(goal);
  }

  /**
   * Return a fallback plan structure when model generation fails
   */
  _getFallbackPlan(goal = 'the topic') {
    const topicName = goal.length > 50 ? goal.substring(0, 50) + '...' : goal;
    return {
      title: `Learn: ${topicName}`,
      overview: `A structured learning path to help you understand ${topicName}. This plan covers fundamentals, key concepts, and practical applications.`,
      estimatedDuration: '2-4 hours',
      prerequisites: ['Basic foundational knowledge', 'Curiosity to learn'],
      learningOutcomes: [
        `Understand the core concepts of ${topicName}`,
        'Apply knowledge to real-world scenarios',
        'Build a solid foundation for further learning',
      ],
      steps: [
        {
          number: 1,
          title: 'Introduction & Fundamentals',
          description: `Start with the basics of ${topicName}. Learn key terminology and foundational concepts.`,
          duration: '30 mins',
          resources: [
            {
              type: 'explanation',
              content: 'Overview of fundamental concepts and definitions',
            },
            {
              type: 'visualization',
              description: `Interactive diagram showing ${topicName} components`,
            },
          ],
        },
        {
          number: 2,
          title: 'Core Concepts',
          description: 'Dive deeper into main ideas and principles',
          duration: '60 mins',
          resources: [
            {
              type: 'explanation',
              content: 'Detailed explanation of core principles',
            },
            {
              type: 'example',
              description: 'Real-world examples and case studies',
            },
          ],
        },
        {
          number: 3,
          title: 'Practice',
          description: 'Apply what you learned through hands-on exercises',
          duration: '45 mins',
          resources: [
            {
              type: 'example',
              description: 'Practice problems with increasing difficulty',
            },
            {
              type: 'visualization',
              description: 'Interactive simulations to test understanding',
            },
          ],
        },
      ],
      checkpoints: [
        {
          step: 1,
          question: 'What are the key concepts we covered?',
          expectedAnswer: 'Understanding of core terminology and relationships',
        },
        {
          step: 2,
          question: 'How do these concepts apply in practice?',
          expectedAnswer: 'Ability to identify real-world applications',
        },
      ],
      nextSteps: ['Advanced Topics', 'Project-Based Learning', 'Specialization'],
    };
  }

  /**
   * Lifecycle hook: Enrich input with context
   */
  async beforeExecute(input, context) {
    // Log the start
    logger.debug(`[${this.name}] Starting planner...`, { goal: input.goal });
    return { input, context };
  }

  /**
   * Lifecycle hook: Validate plan output
   */
  async afterExecute(result, context) {
    // Validate required fields in plan
    const plan = result.plan;
    if (!plan.steps || !Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new Error('Invalid plan: must have at least one step');
    }

    logger.info(`[${this.name}] Plan validation passed`, {
      steps: plan.steps.length,
      duration: plan.estimatedDuration,
    });

    return result;
  }
}

export default PlannerAgent;
