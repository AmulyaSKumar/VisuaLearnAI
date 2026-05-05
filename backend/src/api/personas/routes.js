/**
 * Personas API Routes
 * CRUD operations for AI persona management
 * @module api/personas
 */

import express from 'express';
import {
  getPersonas,
  getPersona,
  createPersona,
  updatePersona,
  deletePersona,
  setDefaultPersona,
  getUserDefaultPersona,
} from '../../database/client.js';
import { logger } from '../../services/logger.js';

const router = express.Router();

// ============================================
// VALIDATION
// ============================================

const ALLOWED_TONES = ['friendly', 'formal', 'casual', 'technical', 'encouraging', 'rigorous'];
const ALLOWED_VERBOSITY = ['concise', 'medium', 'detailed'];
const MAX_RULES = 5;
const MAX_AVOID_RULES = 5;
const MAX_EXAMPLES = 2;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_PROMPT_PREFIX_LENGTH = 2000;
const MAX_RULE_LENGTH = 200;

/**
 * Detect conflicting rules that would confuse the model
 */
const CONFLICT_PAIRS = [
  ['concise', 'detailed'],
  ['casual', 'formal'],
  ['brief', 'thorough'],
  ['simple', 'technical'],
  ['short', 'comprehensive'],
  ['minimal', 'extensive'],
];

function detectConflicts(rules, avoidRules) {
  const allTerms = [...(rules || []), ...(avoidRules || [])].map(r => r.toLowerCase());
  const conflicts = [];

  for (const [term1, term2] of CONFLICT_PAIRS) {
    if (allTerms.some(r => r.includes(term1)) && allTerms.some(r => r.includes(term2))) {
      conflicts.push(`Conflicting terms: "${term1}" and "${term2}"`);
    }
  }
  return conflicts;
}

function validatePersona(data, isUpdate = false) {
  const errors = [];

  // Name validation (required for create)
  if (!isUpdate && !data.name) {
    errors.push('Name is required');
  }
  if (data.name) {
    if (typeof data.name !== 'string') {
      errors.push('Name must be a string');
    } else if (data.name.length > MAX_NAME_LENGTH) {
      errors.push(`Name must be ${MAX_NAME_LENGTH} characters or less`);
    } else if (data.name.trim().length === 0) {
      errors.push('Name cannot be empty');
    }
  }

  // Description validation
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      errors.push('Description must be a string');
    } else if (data.description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`);
    }
  }

  // System prompt prefix validation
  if (data.system_prompt_prefix !== undefined) {
    if (typeof data.system_prompt_prefix !== 'string') {
      errors.push('System prompt prefix must be a string');
    } else if (data.system_prompt_prefix.length > MAX_PROMPT_PREFIX_LENGTH) {
      errors.push(`System prompt prefix must be ${MAX_PROMPT_PREFIX_LENGTH} characters or less`);
    }
  }

  // Tone validation
  if (data.tone !== undefined && !ALLOWED_TONES.includes(data.tone)) {
    errors.push(`Tone must be one of: ${ALLOWED_TONES.join(', ')}`);
  }

  // Verbosity validation
  if (data.verbosity !== undefined && !ALLOWED_VERBOSITY.includes(data.verbosity)) {
    errors.push(`Verbosity must be one of: ${ALLOWED_VERBOSITY.join(', ')}`);
  }

  // Strength validation
  if (data.strength !== undefined) {
    if (typeof data.strength !== 'number' || data.strength < 0 || data.strength > 100) {
      errors.push('Strength must be a number between 0 and 100');
    }
  }

  // Rules validation
  if (data.rules !== undefined) {
    if (!Array.isArray(data.rules)) {
      errors.push('Rules must be an array');
    } else {
      if (data.rules.length > MAX_RULES) {
        errors.push(`Maximum ${MAX_RULES} rules allowed`);
      }
      data.rules.forEach((rule, index) => {
        if (typeof rule !== 'string') {
          errors.push(`Rule ${index + 1} must be a string`);
        } else if (rule.length > MAX_RULE_LENGTH) {
          errors.push(`Rule ${index + 1} must be ${MAX_RULE_LENGTH} characters or less`);
        }
      });
    }
  }

  // Avoid rules validation
  if (data.avoid_rules !== undefined) {
    if (!Array.isArray(data.avoid_rules)) {
      errors.push('Avoid rules must be an array');
    } else {
      if (data.avoid_rules.length > MAX_AVOID_RULES) {
        errors.push(`Maximum ${MAX_AVOID_RULES} avoid rules allowed`);
      }
      data.avoid_rules.forEach((rule, index) => {
        if (typeof rule !== 'string') {
          errors.push(`Avoid rule ${index + 1} must be a string`);
        } else if (rule.length > MAX_RULE_LENGTH) {
          errors.push(`Avoid rule ${index + 1} must be ${MAX_RULE_LENGTH} characters or less`);
        }
      });
    }
  }

  // Example responses validation
  if (data.example_responses !== undefined) {
    if (!Array.isArray(data.example_responses)) {
      errors.push('Example responses must be an array');
    } else {
      if (data.example_responses.length > MAX_EXAMPLES) {
        errors.push(`Maximum ${MAX_EXAMPLES} example responses allowed`);
      }
      data.example_responses.forEach((example, index) => {
        if (typeof example !== 'object' || !example.prompt || !example.response) {
          errors.push(`Example ${index + 1} must have both "prompt" and "response" fields`);
        }
      });
    }
  }

  // Check for conflicting rules
  const conflicts = detectConflicts(data.rules, data.avoid_rules);
  if (conflicts.length > 0) {
    errors.push(...conflicts);
  }

  return errors;
}

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/personas
 * List user's custom personas + system personas
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const personas = await getPersonas(userId);

    res.json({
      personas,
      systemPersonas: personas.filter(p => p.is_system),
      customPersonas: personas.filter(p => !p.is_system),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch personas');
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
});

/**
 * GET /api/personas/default
 * Get user's current default persona
 */
router.get('/default', async (req, res) => {
  try {
    const userId = req.user.userId;
    const persona = await getUserDefaultPersona(userId);

    res.json({ persona });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch default persona');
    res.status(500).json({ error: 'Failed to fetch default persona' });
  }
});

/**
 * GET /api/personas/:id
 * Get a single persona by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const persona = await getPersona(id);

    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    // Check access: user can only view their own personas or system personas
    if (!persona.is_system && persona.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ persona });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch persona');
    res.status(500).json({ error: 'Failed to fetch persona' });
  }
});

/**
 * POST /api/personas
 * Create a new custom persona
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId;
    const data = req.body;

    // Validate input
    const errors = validatePersona(data, false);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const persona = await createPersona(userId, {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      system_prompt_prefix: data.system_prompt_prefix?.trim() || '',
      tone: data.tone || 'friendly',
      verbosity: data.verbosity || 'medium',
      strength: data.strength ?? 80,
      rules: data.rules || [],
      avoid_rules: data.avoid_rules || [],
      example_responses: data.example_responses || [],
    });

    logger.info({ userId, personaId: persona.id }, 'Persona created');
    res.status(201).json({ persona });
  } catch (error) {
    logger.error({ error }, 'Failed to create persona');

    if (error.message.includes('Maximum')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to create persona' });
  }
});

/**
 * PUT /api/personas/:id
 * Update a custom persona
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const data = req.body;

    // Check ownership first
    const existing = await getPersona(id);
    if (!existing) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    if (existing.is_system) {
      return res.status(403).json({ error: 'System personas cannot be modified' });
    }
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Validate input
    const errors = validatePersona(data, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    // Build update object (only include provided fields)
    const updates = {};
    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.description !== undefined) updates.description = data.description.trim();
    if (data.system_prompt_prefix !== undefined) updates.system_prompt_prefix = data.system_prompt_prefix.trim();
    if (data.tone !== undefined) updates.tone = data.tone;
    if (data.verbosity !== undefined) updates.verbosity = data.verbosity;
    if (data.strength !== undefined) updates.strength = data.strength;
    if (data.rules !== undefined) updates.rules = data.rules;
    if (data.avoid_rules !== undefined) updates.avoid_rules = data.avoid_rules;
    if (data.example_responses !== undefined) updates.example_responses = data.example_responses;

    const persona = await updatePersona(id, updates);

    logger.info({ userId, personaId: id }, 'Persona updated');
    res.json({ persona });
  } catch (error) {
    logger.error({ error }, 'Failed to update persona');
    res.status(500).json({ error: 'Failed to update persona' });
  }
});

/**
 * DELETE /api/personas/:id
 * Delete a custom persona
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    await deletePersona(userId, id);

    logger.info({ userId, personaId: id }, 'Persona deleted');
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to delete persona');

    if (error.message.includes('not found') || error.message.includes('cannot be deleted')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to delete persona' });
  }
});

/**
 * POST /api/personas/:id/set-default
 * Set a persona as user's default
 */
router.post('/:id/set-default', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Verify persona exists and user has access
    const persona = await getPersona(id);
    if (!persona) {
      return res.status(404).json({ error: 'Persona not found' });
    }

    // User can set system personas or their own custom personas as default
    if (!persona.is_system && persona.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const profile = await setDefaultPersona(userId, id);

    logger.info({ userId, personaId: id }, 'Default persona set');
    res.json({ success: true, profile, persona });
  } catch (error) {
    logger.error({ error }, 'Failed to set default persona');
    res.status(500).json({ error: 'Failed to set default persona' });
  }
});

export default router;
