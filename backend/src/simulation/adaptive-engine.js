import { randomUUID } from 'crypto';
import { createTextCompletion } from '../services/openai/azure-client.js';
import { supabase } from '../database/client.js';

export const MAX_NODES = 100;
export const MAX_STEPS = 200;
export const MAX_GENERATION_TIME_MS = 5000;
export const MAX_RENDER_TIME_MS = 3000;

const DOMAINS = [
  'algorithms',
  'data structures',
  'machine learning',
  'operating systems',
  'networking',
  'mathematics',
  'physics',
  'chemistry',
  'general education',
];

const SIMULATION_TYPES = [
  'graph visualization',
  'timeline',
  'process animation',
  'matrix visualization',
  'node network',
  'sequence animation',
  'interactive concept model',
  'flow visualization',
];

const CONTROL_SET = ['play', 'pause', 'restart', 'step', 'fullscreen', 'speed'];
const PRIMITIVE_TYPES = ['node', 'edge', 'bar', 'text', 'matrixCell', 'timelineEvent', 'flowBox'];
const BLOCKED_PATTERN = /\b(import|require|XMLHttpRequest|WebSocket|eval|localStorage|sessionStorage|child_process|script|iframe|onload|onclick|onerror)\b|\bnew\s+Function\b|\bfetch\s*\(|(?:window|document|parent|top|globalThis|process|fs)\s*\./i;

const TOPIC_PROMPT = `You are the Topic Understanding Agent for VisuaLearn.
Analyze the learner query for an educational simulation.

Return ONLY valid JSON:
{
  "topic": "short concept name",
  "domain": "one of: ${DOMAINS.join(', ')}",
  "complexity": "beginner | intermediate | advanced",
  "educationalIntent": "short phrase",
  "simulationType": "one of: ${SIMULATION_TYPES.join(', ')}",
  "supported": true,
  "confidence": 0.0
}

Rules:
- Do not use predefined topic lists.
- Decide from the meaning of the query.
- supported=false only when the query is not educational or cannot benefit from a visual explanation.`;

const PLAN_PROMPT = `You are the Simulation Planning Agent.
Create a complete simulation plan from the topic understanding.

Return ONLY valid JSON:
{
  "components": ["..."],
  "interactions": ["..."],
  "animationFlow": ["..."],
  "controls": ["play", "pause", "restart", "step", "fullscreen", "speed"]
}

Rules:
- Use only the listed controls.
- Keep the plan concise and renderable.
- No executable code.`;

const SPEC_PROMPT = `You are the Simulation Spec Generation Agent.
Generate ONLY a declarative simulation spec. Never generate React, JavaScript functions, HTML, CSS selectors, npm packages, imports, external URLs, network requests, filesystem access, window/document access, or backend execution.

Return ONLY valid JSON:
{
  "version": 1,
  "type": "graph visualization | timeline | process animation | matrix visualization | node network | sequence animation | interactive concept model | flow visualization",
  "layout": "network | timeline | matrix | flow | sequence | mixed",
  "explanation": "short learner-facing explanation",
  "controls": ["play", "pause", "restart", "step", "fullscreen", "speed"],
  "steps": [
    {
      "id": "step-1",
      "title": "short title",
      "description": "what changes in this step",
      "activePrimitiveIds": ["primitive-id"]
    }
  ],
  "primitives": [
    {
      "id": "unique id",
      "type": "node | edge | bar | text | matrixCell | timelineEvent | flowBox",
      "label": "visible label",
      "from": "source id for edge only",
      "to": "target id for edge only",
      "x": 10,
      "y": 10,
      "w": 12,
      "h": 8,
      "value": 50,
      "row": 0,
      "col": 0,
      "color": "#111827"
    }
  ],
  "animations": [
    { "stepId": "step-1", "primitiveId": "primitive-id", "effect": "fade | pulse | move | highlight" }
  ],
  "interactionHints": ["..."]
}

Hard limits:
- max 100 primitives
- max 200 steps
- coordinates x/y/w/h are percentages 0..100
- use cream/white/black/deep-violet friendly colors
- every step must activate at least one primitive
- edges must reference existing primitive ids
- no executable code or URLs anywhere.`;

function parseJsonObject(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

async function safeJsonCompletion({ system, payload, maxTokens = 1200, temperature = 0.2, timeoutMs = MAX_GENERATION_TIME_MS }) {
  const text = await withTimeout(
    createTextCompletion({
      system,
      messages: [{ role: 'user', content: typeof payload === 'string' ? payload : JSON.stringify(payload) }],
      maxTokens,
      temperature,
    }),
    timeoutMs,
    'Agent generation',
  );
  return parseJsonObject(text);
}

function safeText(value, fallback = '', max = 180) {
  const text = String(value ?? fallback).replace(/[<>]/g, '').trim();
  if (!text || BLOCKED_PATTERN.test(text)) return fallback;
  return text.slice(0, max);
}

function safeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function safeNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function safeColor(value, fallback = '#4c1d95') {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
}

function buildGenericUnderstanding(query) {
  return {
    topic: safeText(query, 'Learning concept', 80),
    domain: 'general education',
    complexity: 'beginner',
    educationalIntent: 'visual explanation',
    simulationType: 'interactive concept model',
    supported: Boolean(String(query || '').trim()),
    confidence: 0.5,
  };
}

export async function topicUnderstandingAgent(query) {
  const fallback = buildGenericUnderstanding(query);
  try {
    const parsed = await safeJsonCompletion({
      system: TOPIC_PROMPT,
      payload: query,
      maxTokens: 450,
      temperature: 0.1,
    });
    if (!parsed) return fallback;
    return {
      topic: safeText(parsed.topic, fallback.topic, 80),
      domain: safeEnum(parsed.domain, DOMAINS, fallback.domain),
      complexity: safeEnum(parsed.complexity, ['beginner', 'intermediate', 'advanced'], fallback.complexity),
      educationalIntent: safeText(parsed.educationalIntent, fallback.educationalIntent, 120),
      simulationType: safeEnum(parsed.simulationType, SIMULATION_TYPES, fallback.simulationType),
      supported: parsed.supported !== false,
      confidence: safeNumber(parsed.confidence, 0, 1, fallback.confidence),
    };
  } catch {
    return fallback;
  }
}

export async function simulationPlanningAgent(query, topicUnderstanding, feedbackContext = null, retryMode = 'full simulation') {
  const fallback = {
    components: ['concept map', 'step sequence', 'explanation panel'],
    interactions: ['step through the concept', 'adjust speed', 'restart'],
    animationFlow: ['introduce the concept', 'show relationships', 'highlight changes', 'summarize the result'],
    controls: CONTROL_SET,
  };
  try {
    const parsed = await safeJsonCompletion({
      system: PLAN_PROMPT,
      payload: { query, topicUnderstanding, feedbackContext, retryMode },
      maxTokens: 700,
      temperature: retryMode === 'full simulation' ? 0.25 : 0.15,
    });
    if (!parsed) return fallback;
    return {
      components: normalizeStringArray(parsed.components, fallback.components, 12),
      interactions: normalizeStringArray(parsed.interactions, fallback.interactions, 12),
      animationFlow: normalizeStringArray(parsed.animationFlow, fallback.animationFlow, 20),
      controls: normalizeControls(parsed.controls),
    };
  } catch {
    return fallback;
  }
}

export async function simulationSpecGenerationAgent(query, topicUnderstanding, plan, attempt = 1) {
  const retryMode = [
    'full simulation',
    'stricter constraints',
    'reduced complexity',
    'simplified visual simulation',
    'guided interactive visualization',
  ][Math.min(attempt - 1, 4)];

  try {
    return await safeJsonCompletion({
      system: SPEC_PROMPT,
      payload: { query, topicUnderstanding, plan, retryMode },
      maxTokens: attempt <= 2 ? 2600 : 1800,
      temperature: attempt === 1 ? 0.3 : 0.15,
    });
  } catch {
    return null;
  }
}

function normalizeStringArray(value, fallback = [], max = 20) {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  return source.slice(0, max).map(item => safeText(item, '', 120)).filter(Boolean);
}

function normalizeControls(value) {
  const source = Array.isArray(value) ? value : CONTROL_SET;
  const selected = source.filter(control => CONTROL_SET.includes(control));
  return Array.from(new Set([...selected, ...CONTROL_SET]));
}

function normalizePrimitive(raw, index) {
  const type = safeEnum(raw?.type, PRIMITIVE_TYPES, 'node');
  return {
    id: safeText(raw?.id, `p-${index}`, 48).replace(/\s+/g, '-'),
    type,
    label: safeText(raw?.label, type, 80),
    from: safeText(raw?.from, '', 48).replace(/\s+/g, '-'),
    to: safeText(raw?.to, '', 48).replace(/\s+/g, '-'),
    x: safeNumber(raw?.x, 0, 100, 10 + (index % 6) * 14),
    y: safeNumber(raw?.y, 0, 100, 20 + Math.floor(index / 6) * 14),
    w: safeNumber(raw?.w, 2, 100, 14),
    h: safeNumber(raw?.h, 2, 100, 8),
    value: safeNumber(raw?.value, 0, 100, 50),
    row: Math.round(safeNumber(raw?.row, 0, 20, 0)),
    col: Math.round(safeNumber(raw?.col, 0, 20, index)),
    color: safeColor(raw?.color),
  };
}

function normalizeStep(raw, index, primitiveIds) {
  const active = Array.isArray(raw?.activePrimitiveIds)
    ? raw.activePrimitiveIds.map(id => safeText(id, '', 48).replace(/\s+/g, '-')).filter(id => primitiveIds.has(id))
    : [];
  return {
    id: safeText(raw?.id, `step-${index + 1}`, 48).replace(/\s+/g, '-'),
    title: safeText(raw?.title, `Step ${index + 1}`, 80),
    description: safeText(raw?.description, 'Observe the highlighted visual change.', 240),
    activePrimitiveIds: active,
  };
}

function normalizeAnimation(raw, index, stepIds, primitiveIds) {
  return {
    stepId: stepIds.has(raw?.stepId) ? raw.stepId : Array.from(stepIds)[Math.min(index, stepIds.size - 1)],
    primitiveId: primitiveIds.has(raw?.primitiveId) ? raw.primitiveId : Array.from(primitiveIds)[index % Math.max(primitiveIds.size, 1)],
    effect: safeEnum(raw?.effect, ['fade', 'pulse', 'move', 'highlight'], 'highlight'),
  };
}

function buildFallbackSpec(topicUnderstanding, plan) {
  const words = [...new Set([
    ...topicUnderstanding.topic.split(/\s+/),
    ...plan.animationFlow.join(' ').split(/\s+/),
  ].map(word => word.replace(/[^a-z0-9]/gi, '')).filter(word => word.length > 2))].slice(0, 6);
  const labels = words.length >= 3 ? words : ['Concept', 'Relationship', 'Change', 'Result'];
  const primitives = labels.map((label, index) => ({
    id: `p-${index}`,
    type: 'node',
    label,
    x: 12 + index * (76 / Math.max(labels.length - 1, 1)),
    y: index % 2 === 0 ? 38 : 58,
    w: 12,
    h: 8,
    value: 50 + index * 5,
    row: 0,
    col: index,
    color: index === 0 ? '#4c1d95' : '#111827',
  }));
  const edges = primitives.slice(1).map((primitive, index) => ({
    id: `e-${index}`,
    type: 'edge',
    label: '',
    from: primitives[index].id,
    to: primitive.id,
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    value: 0,
    row: 0,
    col: 0,
    color: '#7c3aed',
  }));
  const allPrimitives = [...primitives, ...edges];
  return {
    version: 1,
    type: topicUnderstanding.simulationType,
    layout: 'flow',
    explanation: `A guided visual model for ${topicUnderstanding.topic}.`,
    controls: CONTROL_SET,
    steps: primitives.map((primitive, index) => ({
      id: `step-${index + 1}`,
      title: primitive.label,
      description: plan.animationFlow[index] || `Focus on ${primitive.label} and how it connects to the concept.`,
      activePrimitiveIds: allPrimitives.slice(0, primitives.length + index).map(item => item.id),
    })),
    primitives: allPrimitives,
    animations: primitives.map((primitive, index) => ({
      stepId: `step-${index + 1}`,
      primitiveId: primitive.id,
      effect: 'highlight',
    })),
    interactionHints: ['Use step controls to inspect each visual state.', 'Restart to replay the concept from the beginning.'],
  };
}

export function validationAgent(spec, topicUnderstanding, plan) {
  const errors = [];
  if (!spec || typeof spec !== 'object') errors.push('spec_not_object');

  const raw = JSON.stringify(spec || {});
  if (BLOCKED_PATTERN.test(raw)) errors.push('dangerous_operation');
  if (raw.length > 120000) errors.push('excessive_complexity');

  const primitiveInput = Array.isArray(spec?.primitives) ? spec.primitives : [];
  if (primitiveInput.length === 0) errors.push('missing_primitives');
  if (primitiveInput.length > MAX_NODES) errors.push('too_many_nodes');

  const primitives = primitiveInput.slice(0, MAX_NODES).map(normalizePrimitive);
  const primitiveIds = new Set(primitives.map(primitive => primitive.id));
  const duplicateIds = primitives.length !== primitiveIds.size;
  if (duplicateIds) errors.push('duplicate_primitive_ids');

  const edgeErrors = primitives
    .filter(primitive => primitive.type === 'edge')
    .filter(edge => !primitiveIds.has(edge.from) || !primitiveIds.has(edge.to));
  if (edgeErrors.length > 0) errors.push('invalid_edge_reference');

  const stepInput = Array.isArray(spec?.steps) ? spec.steps : [];
  if (stepInput.length === 0) errors.push('missing_steps');
  if (stepInput.length > MAX_STEPS) errors.push('too_many_steps');

  let steps = stepInput.slice(0, MAX_STEPS).map((step, index) => normalizeStep(step, index, primitiveIds));
  steps = steps.map((step, index) => ({
    ...step,
    activePrimitiveIds: step.activePrimitiveIds.length > 0
      ? step.activePrimitiveIds
      : primitives.slice(0, Math.min(primitives.length, index + 1)).map(primitive => primitive.id),
  }));

  const stepIds = new Set(steps.map(step => step.id));
  const animations = (Array.isArray(spec?.animations) ? spec.animations : [])
    .slice(0, MAX_STEPS)
    .map((animation, index) => normalizeAnimation(animation, index, stepIds, primitiveIds));

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    spec: {
      version: 1,
      type: safeEnum(spec.type, SIMULATION_TYPES, topicUnderstanding.simulationType),
      layout: safeEnum(spec.layout, ['network', 'timeline', 'matrix', 'flow', 'sequence', 'mixed'], 'mixed'),
      explanation: safeText(spec.explanation, `Interactive simulation for ${topicUnderstanding.topic}.`, 500),
      controls: normalizeControls(spec.controls),
      steps,
      primitives,
      animations,
      interactionHints: normalizeStringArray(spec.interactionHints, plan.interactions, 8),
    },
  };
}

async function loadFeedbackContext(userId, topic) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('feedback')
      .select('type, content, metadata, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8);
    if (error) return null;
    return (data || []).map(item => ({
      type: item.type,
      content: item.content,
      simulationTopic: item.metadata?.simulationTopic,
      reason: item.metadata?.reason,
    })).filter(item => !topic || !item.simulationTopic || item.simulationTopic === topic);
  } catch {
    return null;
  }
}

async function persistTelemetry(telemetry) {
  try {
    const { error } = await supabase.from('simulation_telemetry').insert(telemetry);
    if (!error) return { stored: true, table: 'simulation_telemetry' };
  } catch {
    // Fall through to asset_cache compatibility storage.
  }

  try {
    await supabase.from('asset_cache').insert({
      prompt_hash: telemetry.simulation_id,
      asset_type: 'simulation',
      content: JSON.stringify(telemetry),
      metadata: { telemetry: true, ...telemetry },
      access_count: 1,
    });
    return { stored: true, table: 'asset_cache' };
  } catch {
    return { stored: false, table: null };
  }
}

export async function recordSimulationFeedback({ simulationId, userId, type, score = null, reason = null }) {
  const normalizedType = {
    helpful: 'thumbs_up',
    not_useful: 'thumbs_down',
    regenerate: 'suggestion',
  }[type] || type;

  const metadata = {
    simulationId,
    originalType: type,
    feedbackScore: score,
    reason,
    source: 'simulation_feedback',
  };

  const { data, error } = await supabase
    .from('feedback')
    .insert({
      user_id: userId || null,
      message_id: null,
      type: normalizedType,
      content: reason || null,
      metadata,
      processed: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save simulation feedback: ${error.message}`);
  return data;
}

export async function generateAdaptiveSimulation(query, options = {}) {
  const startedAt = Date.now();
  const simulationId = randomUUID();
  const validationErrors = [];
  const feedbackContext = options.feedbackContext || await loadFeedbackContext(options.userId, query);
  const topicUnderstanding = await topicUnderstandingAgent(query);
  const supported = topicUnderstanding.supported !== false;
  const plan = await simulationPlanningAgent(query, topicUnderstanding, feedbackContext);

  let finalSpec = null;
  let attemptCount = 0;
  let fallbackUsed = false;
  const retryModes = ['full simulation', 'stricter constraints', 'reduced complexity', 'simplified visual simulation'];

  if (supported) {
    for (let index = 0; index < retryModes.length; index += 1) {
      attemptCount = index + 1;
      const generated = await simulationSpecGenerationAgent(query, topicUnderstanding, plan, attemptCount);
      const validation = validationAgent(generated, topicUnderstanding, plan);
      if (validation.valid) {
        finalSpec = validation.spec;
        break;
      }
      validationErrors.push(...validation.errors);
    }
  }

  if (!finalSpec) {
    fallbackUsed = true;
    attemptCount = Math.max(attemptCount, 4);
    const fallbackSpec = buildFallbackSpec(topicUnderstanding, plan);
    const validation = validationAgent(fallbackSpec, topicUnderstanding, plan);
    finalSpec = validation.valid ? validation.spec : validationAgent(buildFallbackSpec(buildGenericUnderstanding(query), plan), topicUnderstanding, plan).spec;
  }

  const generationTimeMs = Date.now() - startedAt;
  const telemetry = {
    simulation_id: simulationId,
    topic: topicUnderstanding.topic,
    domain: topicUnderstanding.domain,
    generation_time_ms: generationTimeMs,
    render_time_ms: null,
    attempt_count: attemptCount,
    retry_count: Math.max(attemptCount - 1, 0),
    validation_errors: validationErrors,
    feedback_score: null,
    fallback_used: fallbackUsed,
    created_at: new Date().toISOString(),
  };
  const telemetryStorage = await persistTelemetry(telemetry);

  return {
    success: true,
    supported,
    simulationId,
    spec: finalSpec,
    topicUnderstanding,
    plan,
    telemetry: { ...telemetry, storage: telemetryStorage },
    fallbackUsed,
  };
}
