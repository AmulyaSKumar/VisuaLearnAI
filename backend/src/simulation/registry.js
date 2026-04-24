/**
 * Generator Registry
 * Central registry for all simulation generators
 * Enables pluggable architecture - add new generators without modifying core
 */

class GeneratorRegistry {
  constructor() {
    this.generators = new Map();
    this.typeIndex = new Map(); // Index by type for quick lookup
  }

  /**
   * Register a generator
   * @param {BaseGenerator} generator
   */
  register(generator) {
    if (!generator.key || !generator.type) {
      throw new Error('Generator must have key and type');
    }

    this.generators.set(generator.key, generator);

    // Index by type
    if (!this.typeIndex.has(generator.type)) {
      this.typeIndex.set(generator.type, []);
    }
    this.typeIndex.get(generator.type).push(generator.key);

    console.log(`[Registry] Registered generator: ${generator.key} (${generator.type})`);
  }

  /**
   * Get a generator by key
   * @param {string} key
   * @returns {BaseGenerator|null}
   */
  get(key) {
    return this.generators.get(key) || null;
  }

  /**
   * Check if generator exists
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.generators.has(key);
  }

  /**
   * Get all generators of a specific type
   * @param {string} type
   * @returns {BaseGenerator[]}
   */
  getByType(type) {
    const keys = this.typeIndex.get(type) || [];
    return keys.map(key => this.generators.get(key));
  }

  /**
   * List all registered generators
   * @returns {object[]}
   */
  list() {
    return Array.from(this.generators.values()).map(g => g.getMetadata());
  }

  /**
   * List generators grouped by type
   * @returns {object}
   */
  listByType() {
    const grouped = {};
    for (const [type, keys] of this.typeIndex) {
      grouped[type] = keys.map(key => {
        const gen = this.generators.get(key);
        return gen.getMetadata();
      });
    }
    return grouped;
  }

  /**
   * Generate simulation using a specific generator
   * @param {string} key - Generator key
   * @param {object} inputs - User inputs
   * @returns {GeneratorResult}
   */
  generate(key, inputs) {
    const generator = this.get(key);
    if (!generator) {
      return {
        success: false,
        simulation: null,
        error: {
          message: `Generator not found: ${key}`,
          hint: `Available generators: ${Array.from(this.generators.keys()).join(', ')}`,
          recoverable: false
        }
      };
    }
    return generator.generate(inputs);
  }

  /**
   * Get input schema for a generator
   * @param {string} key
   * @returns {object|null}
   */
  getInputSchema(key) {
    const generator = this.get(key);
    return generator?.inputSchema || null;
  }

  /**
   * Get default inputs for a generator
   * @param {string} key
   * @returns {object|null}
   */
  getDefaults(key) {
    const generator = this.get(key);
    return generator?.getDefaults() || null;
  }

  /**
   * Get count of registered generators
   * @returns {number}
   */
  get size() {
    return this.generators.size;
  }

  /**
   * Get all generator keys
   * @returns {string[]}
   */
  keys() {
    return Array.from(this.generators.keys());
  }

  /**
   * Get all supported types
   * @returns {string[]}
   */
  types() {
    return Array.from(this.typeIndex.keys());
  }
}

// Singleton instance
export const registry = new GeneratorRegistry();

export default registry;
