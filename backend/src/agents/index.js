/**
 * Agents Module
 * Agent registry and implementations
 * @module agents
 */

export { BaseAgent } from './base-agent.js';
export { agentRegistry, AgentRegistry } from './registry.js';
export { PlannerAgent } from './planner.js';
export { PersonalizationAgent } from './personalization.js';
export { VisualIntelligenceAgent } from './visual-intelligence.js';
export { ImageGeneratorAgent } from './image-generator.js';
export { FactCheckerAgent } from './fact-checker.js';
export { AdaptiveWidgetGenerator } from './adaptive-widget-generator.js';
export { AdaptiveLearningEngine } from './adaptive-learning-engine.js';
export { SimulationAgent, simulationAgent } from './simulation-generator.js';

/**
 * Agent Implementations:
 *
 * Day 2 (Planning & Personalization):
 * - planner.js: Generates structured learning plans (haiku)
 * - personalization.js: Detects VARK learning styles (haiku)
 *
 * Day 3 (Visual Intelligence):
 * - visual-intelligence.js: Generates interactive widgets (sonnet)
 *
 * Day 4 (Image Generation & Validation):
 * - image-generator.js: Calls Azure gpt-image-1.5 for educational images
 * - fact-checker.js: Validates claims using MAFC pattern (haiku)
 *
 * Day 5+ (Adaptive Learning):
 * - adaptive-widget-generator.js: Generates personalized widgets based on
 *   user profile, metrics, and real-time signals (sonnet)
 * - adaptive-learning-engine.js: Closed-loop adaptive learning system with
 *   cognitive state classification, decision engine, escalation strategy,
 *   comprehension modeling, and real-time adaptation (sonnet)
 *
 * Import pattern:
 * import { agentRegistry, AdaptiveWidgetGenerator } from './agents/index.js';
 * agentRegistry.registerAgent(new AdaptiveWidgetGenerator());
 */
