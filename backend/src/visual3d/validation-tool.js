import {
  ANIMATION_TYPES,
  LIMITS,
  PRIMITIVES,
  SCENE_FAMILIES,
  SceneBlueprintSchema,
  VISUAL_3D_VERSION,
  normalizeId,
} from './schema.js';

const UNSAFE_STRING_PATTERN = /<\s*\/?\s*(script|iframe|object|embed|link|style|html|body|canvas)\b|(?:document|window|globalThis|parent|top|opener|process|localStorage|sessionStorage|cookie)\s*\.|\b(fetch|XMLHttpRequest|WebSocket|eval|Function|import|require|npm|npx|yarn|pnpm)\b|javascript:|https?:\/\//i;

export function validateAndNormalizeBlueprint(input, options = {}) {
  const warnings = [];
  const errors = [];
  if (hasUnsafeString(input)) {
    errors.push('Blueprint contains executable code, browser globals, or external URLs.');
  }

  const sanitized = sanitizeBlueprint(input, warnings, errors, options);

  if (hasUnsafeString(sanitized)) {
    errors.push('Blueprint contains executable code, browser globals, or external URLs.');
  }

  const parsed = SceneBlueprintSchema.safeParse(sanitized);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`${issue.path.join('.') || 'blueprint'}: ${issue.message}`);
    }
    return {
      valid: false,
      score: 0,
      warnings,
      errors,
      blueprint: null,
    };
  }

  const blueprint = addMissingIds(parsed.data);
  validateObjectReferences(blueprint, errors);
  validateParticleBudget(blueprint, warnings, errors);
  validateOverlap(blueprint, warnings);
  validateLabels(blueprint, warnings, errors);

  const score = computeScore(warnings, errors);
  return {
    valid: errors.length === 0,
    score,
    warnings,
    errors,
    blueprint: {
      ...blueprint,
      version: blueprint.version || VISUAL_3D_VERSION,
      validation: {
        score,
        warnings,
        errors,
      },
    },
  };
}

export function validateTopicAnalysis(topicAnalysis = {}) {
  const warnings = [];
  const errors = [];
  if (!topicAnalysis.topic) errors.push('Topic is required.');
  if (!SCENE_FAMILIES.includes(topicAnalysis.family)) errors.push(`Unsupported family: ${topicAnalysis.family}`);
  return { valid: errors.length === 0, warnings, errors };
}

function sanitizeBlueprint(input, warnings, errors, options) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    errors.push('Blueprint must be a JSON object.');
    return {};
  }

  const source = options.source || input.metadata?.source || 'model';
  const objects = Array.isArray(input.objects) ? input.objects.slice(0, LIMITS.maxObjects) : [];
  const animations = Array.isArray(input.animations) ? input.animations.slice(0, LIMITS.maxAnimations) : [];

  if (Array.isArray(input.objects) && input.objects.length > LIMITS.maxObjects) {
    warnings.push(`Object list truncated to ${LIMITS.maxObjects}.`);
  }

  return {
    ...input,
    topic: safeString(input.topic || options.topic || '3D Topic', '3D Topic'),
    domain: safeString(input.domain || options.domain || 'General Education', 'General Education'),
    family: SCENE_FAMILIES.includes(input.family) ? input.family : options.family || 'abstract',
    objects: objects.map((object, index) => sanitizeObject(object, index, warnings)),
    animations: animations.map(animation => sanitizeAnimation(animation)),
    controls: Array.isArray(input.controls) ? input.controls : ['zoom', 'rotate', 'pan', 'play', 'pause', 'speed', 'select'],
    metadata: {
      ...(input.metadata && typeof input.metadata === 'object' ? input.metadata : {}),
      source,
    },
  };
}

function sanitizeObject(object = {}, index, warnings) {
  const geometry = object.geometry && typeof object.geometry === 'object' ? object.geometry : {};
  const primitive = PRIMITIVES.includes(geometry.primitive) ? geometry.primitive : primitiveFromType(object.type);
  if (geometry.primitive && primitive !== geometry.primitive) {
    warnings.push(`Unsupported primitive replaced on object ${object.id || index + 1}.`);
  }

  return {
    id: normalizeId(object.id || object.name || `object-${index + 1}`, `object-${index + 1}`),
    type: safeString(object.type || primitive, primitive),
    name: safeString(object.name || `Object ${index + 1}`, `Object ${index + 1}`),
    description: safeString(object.description || 'Educational scene object.', 'Educational scene object.'),
    position: vector3(object.position),
    scale: scale3(object.scale),
    geometry: {
      ...geometry,
      primitive,
      count: primitive === 'particle_system'
        ? Math.min(Number(geometry.count) || 600, LIMITS.maxParticleCount)
        : geometry.count,
    },
    material: sanitizeMaterial(object.material),
    facts: Array.isArray(object.facts)
      ? object.facts.slice(0, LIMITS.maxFactsPerObject).map(fact => safeString(fact, '')).filter(Boolean)
      : [],
  };
}

function sanitizeAnimation(animation = {}) {
  return {
    targetId: normalizeId(animation.targetId || animation.objectId || 'object-1', 'object-1'),
    type: ANIMATION_TYPES.includes(animation.type) ? animation.type : 'pulse',
    speed: finiteNumber(animation.speed, 1, 0, 10),
    from: animation.from ? vector3(animation.from) : undefined,
    to: animation.to ? vector3(animation.to) : undefined,
    radius: animation.radius == null ? undefined : finiteNumber(animation.radius, 4, 0.1, 60),
    axis: ['x', 'y', 'z'].includes(animation.axis) ? animation.axis : undefined,
    phase: animation.phase == null ? undefined : finiteNumber(animation.phase, 0, -100, 100),
  };
}

function sanitizeMaterial(material = {}) {
  const color = /^#[0-9a-fA-F]{6}$/.test(material.color || '') ? material.color : '#88ccff';
  const out = { color };
  if (/^#[0-9a-fA-F]{6}$/.test(material.emissive || '')) out.emissive = material.emissive;
  if (material.opacity != null) out.opacity = finiteNumber(material.opacity, 1, 0.05, 1);
  if (typeof material.wireframe === 'boolean') out.wireframe = material.wireframe;
  return out;
}

function addMissingIds(blueprint) {
  const seen = new Set();
  const objects = blueprint.objects.map((object, index) => {
    let id = normalizeId(object.id, `object-${index + 1}`);
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    return { ...object, id };
  });
  return {
    ...blueprint,
    id: blueprint.id || normalizeId(`${blueprint.topic}-${Date.now()}`, 'scene'),
    objects,
  };
}

function validateObjectReferences(blueprint, errors) {
  const ids = new Set(blueprint.objects.map(object => object.id));
  for (const animation of blueprint.animations) {
    if (!ids.has(animation.targetId)) {
      errors.push(`Animation target not found: ${animation.targetId}`);
    }
  }
}

function validateParticleBudget(blueprint, warnings, errors) {
  const total = blueprint.objects.reduce((sum, object) => {
    return sum + (object.geometry.primitive === 'particle_system' ? Number(object.geometry.count || 0) : 0);
  }, 0);
  if (total > LIMITS.maxParticleCount * 2) {
    errors.push(`Particle budget exceeded: ${total}`);
  } else if (total > LIMITS.maxParticleCount) {
    warnings.push(`High particle budget: ${total}`);
  }
}

function validateOverlap(blueprint, warnings) {
  for (let i = 0; i < blueprint.objects.length; i += 1) {
    for (let j = i + 1; j < blueprint.objects.length; j += 1) {
      const a = blueprint.objects[i];
      const b = blueprint.objects[j];
      const distance = Math.hypot(
        a.position[0] - b.position[0],
        a.position[1] - b.position[1],
        a.position[2] - b.position[2]
      );
      const aRadius = Number(a.geometry.radius || 0.7) * Math.max(...a.scale);
      const bRadius = Number(b.geometry.radius || 0.7) * Math.max(...b.scale);
      if (distance > 0 && distance < Math.min(1.2, (aRadius + bRadius) * 0.25)) {
        warnings.push(`Possible overlap between ${a.id} and ${b.id}.`);
      }
    }
  }
}

function validateLabels(blueprint, warnings, errors) {
  if (!blueprint.topic || !blueprint.domain) errors.push('Topic and domain are required.');
  for (const object of blueprint.objects) {
    if (!object.name || !object.description) {
      errors.push(`Object ${object.id} is missing educational label or description.`);
    }
    if (!Array.isArray(object.facts) || object.facts.length === 0) {
      warnings.push(`Object ${object.id} has no key facts.`);
    }
  }
}

function computeScore(warnings, errors) {
  if (errors.length > 0) return 0;
  return Math.max(60, 100 - warnings.length * 6);
}

function hasUnsafeString(value) {
  if (typeof value === 'string') return UNSAFE_STRING_PATTERN.test(value);
  if (Array.isArray(value)) return value.some(hasUnsafeString);
  if (value && typeof value === 'object') return Object.values(value).some(hasUnsafeString);
  return false;
}

function safeString(value, fallback) {
  const text = String(value ?? fallback).trim().slice(0, LIMITS.maxStringLength);
  if (!text || UNSAFE_STRING_PATTERN.test(text)) return fallback;
  return text;
}

function vector3(value) {
  const source = Array.isArray(value) ? value : [0, 0, 0];
  return [0, 1, 2].map(index => finiteNumber(source[index], 0, -LIMITS.maxPositionAbs, LIMITS.maxPositionAbs));
}

function scale3(value) {
  const source = Array.isArray(value) ? value : [1, 1, 1];
  return [0, 1, 2].map(index => finiteNumber(Math.abs(source[index]), 1, 0.05, LIMITS.maxScaleAbs));
}

function finiteNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function primitiveFromType(type) {
  if (/particle|field|flow|galaxy|star/i.test(type || '')) return 'particle_system';
  if (/ring|orbit|path|trajectory/i.test(type || '')) return 'ring';
  if (/helix|dna/i.test(type || '')) return 'helix';
  if (/line|edge|connector/i.test(type || '')) return 'line';
  if (/label/i.test(type || '')) return 'text_label';
  return 'sphere';
}
