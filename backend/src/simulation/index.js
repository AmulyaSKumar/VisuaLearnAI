/**
 * Simulation Engine - Main Exports
 * Dynamic simulation generation system
 */

// Load all generators (side effect: registers them)
import './generators/index.js';

// Core exports
export { registry } from './registry.js';
export { BaseGenerator, GeneratorResult } from './generators/base-generator.js';
export {
  SimulationIRSchema,
  SimulationStepSchema,
  validateSimulationIR,
  validateClassification
} from './schema.js';

// Classification
export {
  classifySimulationIntent,
  mightBeSimulationRelated,
  getSuggestedInputs
} from './classifier.js';

// Input processing
export {
  parseInput,
  normalizeInput,
  validateInput,
  processInput,
  processAllInputs
} from './input-pipeline.js';

// Key mapping
export {
  resolveGeneratorKey,
  getTypeForKey,
  fuzzyMatchGenerator,
  getAllAliases
} from './key-mapper.js';

// Caching
export {
  classificationCache,
  simulationCache,
  getSimulationFromCache,
  cacheSimulation,
  clearAllCaches,
  getCacheStats
} from './cache.js';

// Fallback
export {
  findRelatedSimulatableTopics,
  createFallbackResponse,
  getAvailableSimulations
} from './fallback.js';

// Default export: main functions
export default {
  // Generate simulation
  generate: (generatorKey, inputs) => {
    const { registry } = require('./registry.js');
    return registry.generate(generatorKey, inputs);
  },

  // Classify query
  classify: async (query) => {
    const { classifySimulationIntent } = require('./classifier.js');
    return classifySimulationIntent(query);
  },

  // List available generators
  list: () => {
    const { registry } = require('./registry.js');
    return registry.list();
  }
};
