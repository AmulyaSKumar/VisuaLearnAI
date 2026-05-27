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
// Old simulation agents removed - now using new dynamic simulation engine
// See: backend/src/simulation/ for the new implementation

/**
 * Agent Implementations:
 *
 * Day 2 (Planning & Personalization):
 * - planner.js: Generates structured learning plans (haiku)
 * - personalization.js: Detects VARK learning styles (haiku)
 *
 * Day 3 (Visual Intelligence):
 * - visual-intelligence.js: Generates declarative visual specs
 *
 * Day 4 (Image Generation & Validation):
 * - image-generator.js: Calls Azure gpt-image-1.5 for educational images
 * - fact-checker.js: Validates claims using MAFC pattern (haiku)
 *
 * Import pattern:
 * import { agentRegistry, VisualIntelligenceAgent } from './agents/index.js';
 * agentRegistry.registerAgent(new VisualIntelligenceAgent());
 */
