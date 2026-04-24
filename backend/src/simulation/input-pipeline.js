/**
 * Input Pipeline
 * 3-stage processing: Parse → Normalize → Validate
 */

/**
 * Stage 1: Parse raw input strings into typed values
 * @param {any} raw - Raw input value
 * @param {string} type - Expected type
 * @returns {any} Parsed value
 */
export function parseInput(raw, type) {
  if (raw === undefined || raw === null) {
    return null;
  }

  switch (type) {
    case 'array':
      // Handle multiple formats: "1,2,3", "[1, 2, 3]", "1 2 3", or actual array
      if (Array.isArray(raw)) {
        return raw.map(v => Number(v)).filter(n => !isNaN(n));
      }
      if (typeof raw === 'string') {
        // Remove brackets and split by comma, space, or both
        const cleaned = raw.replace(/[\[\]]/g, '').trim();
        if (!cleaned) return [];
        return cleaned
          .split(/[,\s]+/)
          .map(s => s.trim())
          .filter(s => s !== '')
          .map(Number)
          .filter(n => !isNaN(n));
      }
      return [];

    case 'number':
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') {
        const num = parseFloat(raw.trim());
        return isNaN(num) ? null : num;
      }
      return null;

    case 'string':
      return String(raw);

    case 'graph':
      // Accept graph object or try to parse JSON
      if (typeof raw === 'object' && raw.nodes && raw.edges) {
        return raw;
      }
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.nodes && parsed.edges) return parsed;
        } catch {
          // Not valid JSON
        }
      }
      return null;

    case 'tree':
      // Accept tree object or try to parse JSON
      if (typeof raw === 'object') return raw;
      if (typeof raw === 'string') {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      return null;

    case 'grid':
      // Accept 2D array or try to parse JSON
      if (Array.isArray(raw) && raw.every(Array.isArray)) {
        return raw;
      }
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.every(Array.isArray)) {
            return parsed;
          }
        } catch {
          return null;
        }
      }
      return null;

    default:
      return raw;
  }
}

/**
 * Stage 2: Normalize parsed values to standard format
 * @param {any} parsed - Parsed value
 * @param {string} type - Expected type
 * @param {any} defaultValue - Default value if parsed is empty/null
 * @returns {any} Normalized value
 */
export function normalizeInput(parsed, type, defaultValue) {
  if (parsed === null || parsed === undefined) {
    return defaultValue;
  }

  switch (type) {
    case 'array':
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return defaultValue;
      }
      // Ensure all numbers are integers (for sorting/search simulations)
      return parsed.map(v => Math.round(Number(v)));

    case 'number':
      const num = Number(parsed);
      if (isNaN(num)) return defaultValue;
      return num;

    case 'string':
      const str = String(parsed).trim();
      return str || defaultValue;

    case 'graph':
      if (!parsed || !parsed.nodes || !parsed.edges) {
        return defaultValue;
      }
      // Normalize graph structure
      return {
        nodes: parsed.nodes.map(String),
        edges: parsed.edges.map(edge => {
          if (Array.isArray(edge)) {
            return edge.length === 3
              ? [String(edge[0]), String(edge[1]), Number(edge[2])]
              : [String(edge[0]), String(edge[1])];
          }
          return [String(edge.from), String(edge.to), edge.weight ?? 1];
        })
      };

    case 'tree':
      return parsed || defaultValue;

    case 'grid':
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return defaultValue;
      }
      return parsed;

    default:
      return parsed ?? defaultValue;
  }
}

/**
 * Stage 3: Validate normalized values against schema
 * @param {any} normalized - Normalized value
 * @param {object} schema - Input schema with validation rules
 * @returns {{ valid: boolean, errors: string[], value: any }}
 */
export function validateInput(normalized, schema) {
  const errors = [];
  const validation = schema.validation || {};

  if (normalized === null || normalized === undefined) {
    if (schema.required !== false && schema.default === undefined) {
      errors.push(`${schema.label || 'Input'} is required`);
    }
    return { valid: errors.length === 0, errors, value: schema.default };
  }

  switch (schema.type) {
    case 'array':
      if (!Array.isArray(normalized)) {
        errors.push(`${schema.label || 'Input'} must be an array`);
        break;
      }
      if (validation.minLength !== undefined && normalized.length < validation.minLength) {
        errors.push(`${schema.label || 'Input'} must have at least ${validation.minLength} elements`);
      }
      if (validation.maxLength !== undefined && normalized.length > validation.maxLength) {
        errors.push(`${schema.label || 'Input'} must have at most ${validation.maxLength} elements`);
      }
      // Validate each element
      for (let i = 0; i < normalized.length; i++) {
        if (typeof normalized[i] !== 'number' || isNaN(normalized[i])) {
          errors.push(`Element at index ${i} is not a valid number`);
        }
        if (validation.min !== undefined && normalized[i] < validation.min) {
          errors.push(`Element ${normalized[i]} is less than minimum ${validation.min}`);
        }
        if (validation.max !== undefined && normalized[i] > validation.max) {
          errors.push(`Element ${normalized[i]} exceeds maximum ${validation.max}`);
        }
      }
      break;

    case 'number':
      if (typeof normalized !== 'number' || isNaN(normalized)) {
        errors.push(`${schema.label || 'Input'} must be a number`);
        break;
      }
      if (validation.min !== undefined && normalized < validation.min) {
        errors.push(`${schema.label || 'Input'} must be at least ${validation.min}`);
      }
      if (validation.max !== undefined && normalized > validation.max) {
        errors.push(`${schema.label || 'Input'} must be at most ${validation.max}`);
      }
      break;

    case 'string':
      if (typeof normalized !== 'string') {
        errors.push(`${schema.label || 'Input'} must be a string`);
        break;
      }
      if (validation.minLength !== undefined && normalized.length < validation.minLength) {
        errors.push(`${schema.label || 'Input'} must be at least ${validation.minLength} characters`);
      }
      if (validation.maxLength !== undefined && normalized.length > validation.maxLength) {
        errors.push(`${schema.label || 'Input'} must be at most ${validation.maxLength} characters`);
      }
      if (validation.pattern && !new RegExp(validation.pattern).test(normalized)) {
        errors.push(`${schema.label || 'Input'} has invalid format`);
      }
      break;

    case 'graph':
      if (!normalized || !normalized.nodes || !normalized.edges) {
        errors.push(`${schema.label || 'Input'} must be a valid graph with nodes and edges`);
      }
      break;

    case 'tree':
      if (!normalized) {
        errors.push(`${schema.label || 'Input'} must be a valid tree structure`);
      }
      break;

    case 'grid':
      if (!Array.isArray(normalized) || !normalized.every(Array.isArray)) {
        errors.push(`${schema.label || 'Input'} must be a 2D array`);
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
    value: normalized
  };
}

/**
 * Complete input processing pipeline
 * @param {any} raw - Raw input value
 * @param {object} schema - Input schema
 * @returns {{ valid: boolean, errors: string[], value: any }}
 */
export function processInput(raw, schema) {
  const parsed = parseInput(raw, schema.type);
  const normalized = normalizeInput(parsed, schema.type, schema.default);
  return validateInput(normalized, schema);
}

/**
 * Process all inputs for a generator
 * @param {object} rawInputs - Object with raw input values
 * @param {object} inputSchema - Generator's input schema
 * @returns {{ valid: boolean, errors: string[], values: object }}
 */
export function processAllInputs(rawInputs, inputSchema) {
  const allErrors = [];
  const values = {};

  for (const [key, schema] of Object.entries(inputSchema)) {
    const result = processInput(rawInputs[key], schema);
    if (!result.valid) {
      allErrors.push(...result.errors);
    }
    values[key] = result.value;
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    values
  };
}

export default {
  parseInput,
  normalizeInput,
  validateInput,
  processInput,
  processAllInputs
};
