/**
 * Base Generator Class
 * Abstract base class for all simulation generators
 * Provides common functionality and enforces interface
 */

/**
 * Structured result for generator operations
 */
export class GeneratorResult {
  static success(ir) {
    return {
      success: true,
      simulation: ir,
      error: null
    };
  }

  static error(message, hint = null, recoverable = true) {
    return {
      success: false,
      simulation: null,
      error: {
        message,
        hint,
        recoverable
      }
    };
  }
}

/**
 * Base generator class - all generators extend this
 */
export class BaseGenerator {
  /**
   * @param {string} key - Unique identifier (e.g., 'bubble_sort')
   * @param {string} type - Simulation type (e.g., 'array', 'graph')
   * @param {string} name - Display name (e.g., 'Bubble Sort')
   * @param {object} inputSchema - Schema for required inputs
   */
  constructor(key, type, name, inputSchema) {
    this.key = key;
    this.type = type;
    this.name = name;
    this.inputSchema = inputSchema;
    this.description = '';
    this.complexity = null;
  }

  /**
   * Set algorithm description
   */
  setDescription(description) {
    this.description = description;
    return this;
  }

  /**
   * Set complexity info
   */
  setComplexity(time, space) {
    this.complexity = { time, space };
    return this;
  }

  /**
   * Get default values for inputs
   */
  getDefaults() {
    const defaults = {};
    for (const [key, field] of Object.entries(this.inputSchema)) {
      if (field.default !== undefined) {
        defaults[key] = field.default;
      }
    }
    return defaults;
  }

  /**
   * Validate inputs against schema
   * @returns {{ valid: boolean, errors: string[], value: any }}
   */
  validateInputs(inputs) {
    const errors = [];
    const normalized = {};

    for (const [key, schema] of Object.entries(this.inputSchema)) {
      const value = inputs[key];
      const validation = schema.validation || {};

      // Check required
      if (value === undefined || value === null) {
        if (schema.default !== undefined) {
          normalized[key] = schema.default;
          continue;
        }
        errors.push(`${schema.label || key} is required`);
        continue;
      }

      // Type-specific validation
      if (schema.type === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`${schema.label || key} must be an array`);
          continue;
        }
        if (validation.minLength && value.length < validation.minLength) {
          errors.push(`${schema.label || key} must have at least ${validation.minLength} elements`);
        }
        if (validation.maxLength && value.length > validation.maxLength) {
          errors.push(`${schema.label || key} must have at most ${validation.maxLength} elements`);
        }
        normalized[key] = value;
      } else if (schema.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${schema.label || key} must be a number`);
          continue;
        }
        if (validation.min !== undefined && num < validation.min) {
          errors.push(`${schema.label || key} must be at least ${validation.min}`);
        }
        if (validation.max !== undefined && num > validation.max) {
          errors.push(`${schema.label || key} must be at most ${validation.max}`);
        }
        normalized[key] = num;
      } else if (schema.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${schema.label || key} must be a string`);
          continue;
        }
        if (validation.minLength && value.length < validation.minLength) {
          errors.push(`${schema.label || key} must be at least ${validation.minLength} characters`);
        }
        if (validation.maxLength && value.length > validation.maxLength) {
          errors.push(`${schema.label || key} must be at most ${validation.maxLength} characters`);
        }
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
          errors.push(`${schema.label || key} has invalid format`);
        }
        normalized[key] = value;
      } else if (schema.type === 'graph') {
        if (!value.nodes || !value.edges) {
          errors.push(`${schema.label || key} must have nodes and edges`);
          continue;
        }
        normalized[key] = value;
      } else {
        normalized[key] = value;
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      value: normalized
    };
  }

  /**
   * Main generate method - handles validation and error handling
   * @param {object} inputs - User inputs
   * @returns {GeneratorResult}
   */
  generate(inputs) {
    try {
      // Validate inputs
      const validation = this.validateInputs(inputs);
      if (!validation.valid) {
        return GeneratorResult.error(
          'Invalid input',
          validation.errors.join('. '),
          true
        );
      }

      // Generate simulation
      const ir = this.doGenerate(validation.value);
      return GeneratorResult.success(ir);

    } catch (err) {
      console.error(`[${this.key}] Generation failed:`, err);
      return GeneratorResult.error(
        'Generation failed',
        err.message,
        false
      );
    }
  }

  /**
   * Abstract method - subclasses must implement
   * @param {object} inputs - Validated inputs
   * @returns {SimulationIR}
   */
  doGenerate(inputs) {
    throw new Error('doGenerate() must be implemented by subclass');
  }

  /**
   * Helper to create a step
   */
  createStep(stepNum, state, highlights, action, description) {
    return {
      step: stepNum,
      state: JSON.parse(JSON.stringify(state)), // Deep clone
      highlights: highlights || {},
      meta: {
        action,
        description
      }
    };
  }

  /**
   * Build the final IR object
   */
  buildIR(inputs, initialState, steps) {
    return {
      id: `${this.key}_${Date.now()}`,
      type: this.type,
      algorithm: this.key,
      title: this.name,
      description: this.description,
      inputs: {
        schema: this.inputSchema,
        values: inputs,
        defaults: this.getDefaults()
      },
      initial_state: JSON.parse(JSON.stringify(initialState)),
      steps,
      controls: {
        editable: true,
        steppable: true,
        autoplayable: true,
        speedRange: [100, 2000]
      },
      complexity: this.complexity
    };
  }

  /**
   * Get generator metadata
   */
  getMetadata() {
    return {
      key: this.key,
      type: this.type,
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      complexity: this.complexity
    };
  }
}

export default BaseGenerator;
