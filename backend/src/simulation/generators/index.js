/**
 * Generators Index
 * Auto-registers all simulation generators by importing type-specific indices
 */

// Import all generator categories
import './array/index.js';
import './graph/index.js';
import './tree/index.js';
import './grid/index.js';
import './dp/index.js';
import './timeline/index.js';
import './state-machine/index.js';
import './math/index.js';
import './stack/index.js';
import './linkedlist/index.js';
import './heap/index.js';
import './turing/index.js';

// Re-export base classes for external use
export { BaseGenerator, GeneratorResult } from './base-generator.js';

console.log('[Generators] All generators loaded');
