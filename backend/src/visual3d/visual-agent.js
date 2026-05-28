import { buildAnimations, defaultControls } from './animation-tool.js';
import { getCachedBlueprint, setCachedBlueprint } from './cache-manager.js';
import { buildGeometryObjects } from './geometry-tool.js';
import { buildSceneLayout } from './scene-tool.js';
import { analyzeTopic } from './topic-tool.js';
import { safeJsonParse, VISUAL_3D_VERSION } from './schema.js';
import { validateAndNormalizeBlueprint, validateTopicAnalysis } from './validation-tool.js';

const SYSTEM_PROMPT = `You are VisuaLearn's backend 3D scene planner.
Return one JSON object only. Do not include Markdown, code fences, JSX, HTML, JavaScript, imports, URLs, package installs, or explanations outside JSON.

Create a procedural educational 3D Scene Blueprint. Use only these families:
algorithm, spatial, structure, network, physics, abstract.

Use only these geometry primitives:
sphere, cube, cylinder, cone, ring, line, particle_system, helix, plane, text_label.

Use only these animation types:
orbit, rotate, move, expand, split, merge, pulse, fade, flow, particle_motion.

Every object needs id, type, name, description, position, scale, geometry, material, and facts.
Keep object count under 16 unless the topic clearly needs more. Keep total particles under 2500.`;

export class VisualAgent {
  constructor(options = {}) {
    this.maxReasoningLoops = 3;
    this.useModel = options.useModel !== false;
  }

  async generate(input = {}) {
    const topicInput = input.topic || input.prompt || input.query || '';
    const debug = Boolean(input.debug);
    const useCache = input.useCache !== false && !input.candidateBlueprint;
    const trace = [];

    const stage1Start = performance.now();
    const topicAnalysis = analyzeTopic({ topic: topicInput });
    const topicValidation = validateTopicAnalysis(topicAnalysis);
    trace.push(stageTrace('understand_topic', stage1Start, { topicInput }, topicAnalysis, topicValidation.valid));

    if (!topicValidation.valid) {
      return {
        success: false,
        topic: topicAnalysis.topic,
        topicAnalysis,
        validation: topicValidation,
        blueprint: null,
        trace,
      };
    }

    if (input.candidateBlueprint) {
      const validation = validateAndNormalizeBlueprint(input.candidateBlueprint, {
        source: 'candidate',
        topic: topicAnalysis.topic,
        domain: topicAnalysis.domain,
        family: topicAnalysis.family,
      });
      trace.push(stageTrace('validate_scene', performance.now(), { source: 'candidate' }, validation, validation.valid));
      return formatResult({ topicAnalysis, rawBlueprint: input.candidateBlueprint, validation, trace, fromCache: false, debug });
    }

    if (useCache) {
      const cached = await getCachedBlueprint(topicAnalysis.topic, { version: VISUAL_3D_VERSION });
      if (cached.value?.blueprint) {
        trace.push(stageTrace('cache_lookup', performance.now(), { key: cached.key }, { hit: true }, true));
        return {
          success: true,
          topic: topicAnalysis.topic,
          topicAnalysis,
          blueprint: cached.value.blueprint,
          validation: cached.value.validation,
          cache: { hit: true, key: cached.key },
          trace,
          ...(debug ? { toolOutputs: cached.value.toolOutputs || null, rawBlueprint: cached.value.rawBlueprint || null } : {}),
        };
      }
      trace.push(stageTrace('cache_lookup', performance.now(), { key: cached.key }, { hit: false }, true));
    }

    const stage2Start = performance.now();
    const toolOutputs = buildDeterministicToolOutputs(topicAnalysis);
    let rawBlueprint = null;
    let source = 'deterministic';
    let modelError = null;

    if (this.useModel) {
      try {
        rawBlueprint = await this.buildWithModel(topicAnalysis, toolOutputs);
        source = 'model';
      } catch (error) {
        modelError = error instanceof Error ? error.message : 'Model generation failed.';
      }
    }

    if (!rawBlueprint) {
      rawBlueprint = toolOutputs.blueprint;
    }

    trace.push(stageTrace('build_scene_plan', stage2Start, { topicAnalysis }, {
      source,
      modelError,
      objectCount: rawBlueprint?.objects?.length || 0,
      animationCount: rawBlueprint?.animations?.length || 0,
    }, true));

    const stage3Start = performance.now();
    const validation = validateAndNormalizeBlueprint(rawBlueprint, {
      source,
      topic: topicAnalysis.topic,
      domain: topicAnalysis.domain,
      family: topicAnalysis.family,
    });
    trace.push(stageTrace('validate_scene', stage3Start, { source }, validation, validation.valid));

    const result = formatResult({ topicAnalysis, rawBlueprint, validation, trace, fromCache: false, debug, toolOutputs });

    if (result.success && useCache) {
      const key = await setCachedBlueprint(topicAnalysis.topic, {
        blueprint: result.blueprint,
        validation: result.validation,
        rawBlueprint: debug ? rawBlueprint : null,
        toolOutputs: debug ? toolOutputs : null,
      }, { version: VISUAL_3D_VERSION });
      result.cache = { hit: false, key };
    } else {
      result.cache = { hit: false, key: null };
    }

    return result;
  }

  async buildWithModel(topicAnalysis, toolOutputs) {
    const { createJsonCompletion } = await import('../services/openai/azure-client.js');
    const prompt = {
      task: 'Create one Scene Blueprint JSON for an educational interactive 3D scene.',
      topicAnalysis,
      deterministicToolPlan: toolOutputs,
      requiredShape: {
        topic: 'string',
        domain: 'string',
        family: 'algorithm | spatial | structure | network | physics | abstract',
        objects: 'array of procedural objects',
        animations: 'array of animation descriptors',
        controls: 'array of control strings',
        camera: { position: [0, 6, 14], target: [0, 0, 0] },
      },
    };

    const text = await createJsonCompletion({
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(prompt) }],
      maxTokens: 4096,
      temperature: 0.2,
    });
    return safeJsonParse(text);
  }
}

function buildDeterministicToolOutputs(topicAnalysis) {
  const sceneLayout = buildSceneLayout(topicAnalysis);
  const objects = buildGeometryObjects(topicAnalysis, sceneLayout);
  const animations = buildAnimations(topicAnalysis, objects);
  const blueprint = {
    version: VISUAL_3D_VERSION,
    topic: topicAnalysis.topic,
    domain: topicAnalysis.domain,
    family: topicAnalysis.family,
    objects,
    animations,
    controls: defaultControls(),
    camera: cameraFor(topicAnalysis.family),
    metadata: {
      generatedBy: 'VisualAgent',
      source: 'deterministic',
      confidence: topicAnalysis.confidence,
      layout: sceneLayout.layout,
    },
  };

  return {
    topic: topicAnalysis,
    scene: sceneLayout,
    geometry: objects,
    animation: animations,
    blueprint,
  };
}

function cameraFor(family) {
  if (family === 'spatial') return { position: [0, 8, 16], target: [0, 0, 0] };
  if (family === 'structure') return { position: [0, 4, 12], target: [0, 0, 0] };
  if (family === 'network') return { position: [0, 5, 13], target: [0, 0, 0] };
  if (family === 'physics') return { position: [0, 6, 14], target: [0, 0, 0] };
  return { position: [0, 5, 12], target: [0, 0, 0] };
}

function formatResult({ topicAnalysis, rawBlueprint, validation, trace, fromCache, debug, toolOutputs = null }) {
  return {
    success: validation.valid,
    topic: topicAnalysis.topic,
    topicAnalysis,
    blueprint: validation.blueprint,
    validation: {
      valid: validation.valid,
      score: validation.score,
      warnings: validation.warnings,
      errors: validation.errors,
    },
    cache: { hit: fromCache },
    trace,
    ...(debug ? { toolOutputs, rawBlueprint } : {}),
  };
}

function stageTrace(stage, startTime, input, output, success) {
  return {
    stage,
    input,
    output,
    durationMs: Math.round((performance.now() - startTime) * 100) / 100,
    success,
  };
}
