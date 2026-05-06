/**
 * Learning Orchestrator
 * Routes learning queries to the appropriate agent based on intent classification
 * This is the main entry point for adaptive learning content generation
 */
import { BaseAgent } from './base-agent.js';
import { classifyLearningIntent, INTENT_TYPES, DEPTH_LEVELS } from '../services/intentClassifier.js';
import { QuickExplainAgent } from './quick-explain.js';
import { ConceptualAgent } from './conceptual.js';
import { CodingHelpAgent } from './coding-help.js';
import { LearnAgent } from './learning-content.js';

/**
 * Learning Orchestrator Class
 * Classifies intent and routes to appropriate agent
 */
export class LearningOrchestrator extends BaseAgent {
  constructor() {
    super('learning-orchestrator', 'Orchestrates intent-based adaptive learning content generation', '1.0.0');

    // Initialize agents
    this.quickExplainAgent = new QuickExplainAgent();
    this.conceptualAgent = new ConceptualAgent();
    this.codingHelpAgent = new CodingHelpAgent();
    this.learnAgent = new LearnAgent();
  }

  async execute(input, context = {}) {
    const {
      query,
      profile = {},
      contentType,
      skipIntentDetection = false,
      forceMode = null, // Allow forcing a specific mode
      ...restInput
    } = input;

    if (!query) throw new Error('Query is required');

    console.log('[LearningOrchestrator] Processing query:', query.slice(0, 50));

    // If contentType is specified and not 'learn', route to the original LearnAgent
    // (Examples, Quiz, Flashcards are handled by existing agents)
    if (contentType && contentType !== 'learn') {
      console.log(`[LearningOrchestrator] Non-learn content type: ${contentType}, using LearnAgent`);
      return await this.learnAgent.execute(input, context);
    }

    // Skip intent detection if explicitly requested or forceMode is set
    if (skipIntentDetection || forceMode) {
      const mode = forceMode || 'deep_learn';
      console.log(`[LearningOrchestrator] Skipping intent detection, using mode: ${mode}`);
      return await this.routeToAgent(mode, { ...input, intent: { intent: mode } }, context);
    }

    // Classify the query intent
    let intent;
    try {
      intent = await classifyLearningIntent(query);
      console.log('[LearningOrchestrator] Intent classification:', {
        intent: intent.intent,
        confidence: intent.confidence,
        domain: intent.domain,
        needsCode: intent.needsCode,
        suggestedDepth: intent.suggestedDepth,
        fromHeuristic: intent.fromHeuristic,
        cached: intent.cached,
      });
    } catch (error) {
      console.error('[LearningOrchestrator] Intent classification failed:', error.message);
      // Default to quick_explain on classification failure
      intent = {
        intent: INTENT_TYPES.QUICK_EXPLAIN,
        confidence: 0.5,
        domain: 'cs',
        needsCode: true,
        suggestedDepth: DEPTH_LEVELS.MODERATE,
        reason: 'Classification failed - using default',
      };
    }

    // Route to appropriate agent
    const result = await this.routeToAgent(intent.intent, { ...input, intent }, context);

    // Add orchestration metadata
    return {
      ...result,
      _orchestration: {
        intent: intent.intent,
        confidence: intent.confidence,
        domain: intent.domain,
        suggestedDepth: intent.suggestedDepth,
        fromHeuristic: intent.fromHeuristic,
        cached: intent.cached,
        reason: intent.reason,
      },
    };
  }

  /**
   * Route to the appropriate agent based on intent
   */
  async routeToAgent(intentType, input, context) {
    const { intent, ...restInput } = input;

    switch (intentType) {
      case INTENT_TYPES.QUICK_EXPLAIN:
        console.log('[LearningOrchestrator] Routing to QuickExplainAgent');
        return await this.quickExplainAgent.execute(restInput, context);

      case INTENT_TYPES.CONCEPTUAL_NONCS:
        console.log('[LearningOrchestrator] Routing to ConceptualAgent');
        return await this.conceptualAgent.execute({ ...restInput, intent }, context);

      case INTENT_TYPES.CODING_HELP:
        console.log('[LearningOrchestrator] Routing to CodingHelpAgent');
        return await this.codingHelpAgent.execute({ ...restInput, intent }, context);

      case INTENT_TYPES.SIMULATION:
        // Simulation mode still uses LearnAgent but with hints for simulation
        console.log('[LearningOrchestrator] Routing to LearnAgent with simulation hints');
        return await this.learnAgent.execute({
          ...restInput,
          intent,
          simulationFirst: true,
        }, context);

      case INTENT_TYPES.DEEP_LEARN:
      default:
        // Deep learning uses the full LearnAgent with all blocks
        console.log('[LearningOrchestrator] Routing to LearnAgent (deep learn mode)');
        return await this.learnAgent.execute({
          ...restInput,
          intent,
        }, context);
    }
  }

  /**
   * Get the recommended response mode for a query without generating content
   * Useful for frontend to decide UI layout before fetching content
   */
  async previewIntent(query) {
    if (!query) return null;

    try {
      const intent = await classifyLearningIntent(query);
      return {
        recommendedMode: intent.intent,
        confidence: intent.confidence,
        domain: intent.domain,
        suggestedDepth: intent.suggestedDepth,
        needsCode: intent.needsCode,
      };
    } catch (error) {
      console.error('[LearningOrchestrator] Preview intent failed:', error.message);
      return {
        recommendedMode: INTENT_TYPES.QUICK_EXPLAIN,
        confidence: 0.5,
        domain: 'cs',
        suggestedDepth: DEPTH_LEVELS.MODERATE,
        needsCode: true,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export const learningOrchestrator = new LearningOrchestrator();

// Export for direct usage
export default learningOrchestrator;
