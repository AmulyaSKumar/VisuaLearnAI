import { z } from 'zod';

export const VISUAL_3D_VERSION = '0.1.0';

export const SCENE_FAMILIES = [
  'algorithm',
  'spatial',
  'structure',
  'network',
  'physics',
  'abstract',
];

export const PRIMITIVES = [
  'sphere',
  'cube',
  'cylinder',
  'cone',
  'ring',
  'line',
  'particle_system',
  'helix',
  'plane',
  'text_label',
];

export const ANIMATION_TYPES = [
  'orbit',
  'rotate',
  'move',
  'expand',
  'split',
  'merge',
  'pulse',
  'fade',
  'flow',
  'particle_motion',
];

export const CONTROL_TYPES = [
  'zoom',
  'rotate',
  'pan',
  'play',
  'pause',
  'speed',
  'select',
  'restart',
  'fullscreen',
];

export const LIMITS = {
  maxObjects: 48,
  maxAnimations: 80,
  maxFactsPerObject: 6,
  maxParticleCount: 2500,
  maxPositionAbs: 60,
  maxScaleAbs: 30,
  maxStringLength: 320,
  cacheTtlSeconds: 60 * 60 * 24,
};

const Vector3Schema = z
  .array(z.number().finite())
  .length(3)
  .transform(values => values.map(value => clamp(value, -LIMITS.maxPositionAbs, LIMITS.maxPositionAbs)));

const Scale3Schema = z
  .array(z.number().finite())
  .length(3)
  .transform(values => values.map(value => clamp(Math.abs(value) || 1, 0.05, LIMITS.maxScaleAbs)));

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/).catch('#88ccff');

export const SceneObjectSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(LIMITS.maxStringLength),
  position: Vector3Schema.default([0, 0, 0]),
  scale: Scale3Schema.default([1, 1, 1]),
  geometry: z.object({
    primitive: z.enum(PRIMITIVES),
    count: z.number().int().positive().max(LIMITS.maxParticleCount).optional(),
    radius: z.number().positive().max(30).optional(),
    height: z.number().positive().max(60).optional(),
    segments: z.number().int().positive().max(128).optional(),
    points: z.array(Vector3Schema).max(80).optional(),
  }).passthrough(),
  material: z.object({
    color: HexColorSchema.default('#88ccff'),
    emissive: HexColorSchema.optional(),
    opacity: z.number().min(0.05).max(1).optional(),
    wireframe: z.boolean().optional(),
  }).default({ color: '#88ccff' }),
  facts: z.array(z.string().min(1).max(LIMITS.maxStringLength)).max(LIMITS.maxFactsPerObject).default([]),
}).strict();

export const AnimationSchema = z.object({
  targetId: z.string().min(1).max(80),
  type: z.enum(ANIMATION_TYPES),
  speed: z.number().finite().min(0).max(10).default(1),
  from: Vector3Schema.optional(),
  to: Vector3Schema.optional(),
  radius: z.number().positive().max(60).optional(),
  axis: z.enum(['x', 'y', 'z']).optional(),
  phase: z.number().finite().optional(),
}).strict();

export const SceneBlueprintSchema = z.object({
  id: z.string().min(1).max(120).optional(),
  version: z.string().max(40).default(VISUAL_3D_VERSION),
  topic: z.string().min(1).max(160),
  domain: z.string().min(1).max(80),
  family: z.enum(SCENE_FAMILIES),
  objects: z.array(SceneObjectSchema).min(1).max(LIMITS.maxObjects),
  animations: z.array(AnimationSchema).max(LIMITS.maxAnimations).default([]),
  controls: z.array(z.enum(CONTROL_TYPES)).min(1).max(12).default(['zoom', 'rotate', 'pan', 'play', 'pause', 'speed', 'select']),
  camera: z.object({
    position: Vector3Schema.default([0, 6, 14]),
    target: Vector3Schema.default([0, 0, 0]),
  }).default({ position: [0, 6, 14], target: [0, 0, 0] }),
  metadata: z.object({
    generatedBy: z.string().max(80).optional(),
    source: z.enum(['model', 'deterministic', 'candidate']).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).passthrough().default({}),
}).strict();

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeId(value, fallback = 'object') {
  const id = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return id || fallback;
}

export function normalizeTopic(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\b(?:visuali[sz]e|explain|show|simulate|create|build|render|in\s+3d|3d|three[-\s]?d)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export function safeJsonParse(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        return null;
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
