/**
 * 3D Visualization API
 * Dedicated endpoint for generating 3D widgets separately from chat
 * @module api/visualization
 */

import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/environment.js';
import { logger } from '../../utils/logger.js';
import {
  CDN_VERSIONS,
  build3DSceneSpecPrompt,
  build3DCodePrompt,
  build3DCriticPrompt,
} from '../../services/anthropic/prompts.js';
import { should3DVisualize, get3DComplexityLevel } from '../../agents/visual-intelligence.js';
import {
  sanitizeWidgetCode,
  validate3DWidgetSafety,
  inject3DSafetyWrapper,
} from '../../utils/sanitize-widget.js';

const router = Router();

const client = new Anthropic({
  apiKey: config.anthropic.apiKey,
  baseURL: config.anthropic.baseUrl,
});

const model = config.anthropic.model || 'claude-sonnet-4-5';

/**
 * Generate 3D visualization widget
 * POST /api/generate-3d
 */
router.post('/generate-3d', async (req, res) => {
  const { query, topic, context, deviceCapabilities = {} } = req.body;

  const detectionInput = query || topic;
  const generationTopic = topic || query;

  logger.info({ query: query?.slice(0, 80), topic }, 'POST /api/generate-3d');

  if (!detectionInput) {
    return res.status(400).json({ error: 'query or topic is required' });
  }

  const detection = should3DVisualize(detectionInput);
  if (!detection.use3D) {
    logger.info({ detectionInput: detectionInput.slice(0, 80), score: detection.score, reason: detection.reason }, '3D not appropriate, skipping');
    return res.json({
      skip: true,
      reason: detection.reason,
      score: detection.score,
    });
  }

  if (deviceCapabilities.webgl === false) {
    logger.info({ topic: generationTopic }, 'WebGL not supported, skipping 3D');
    return res.json({
      skip: true,
      reason: 'WebGL not supported on device',
    });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const sendSSE = (data) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (e) {
      logger.error({ error: e.message }, '3D SSE write error');
    }
  };

  let aborted = false;
  const complexity = get3DComplexityLevel(deviceCapabilities);

  sendSSE({ type: 'start', topic: generationTopic });

  const withAbortGuard = (fn) => {
    if (aborted) return null;
    return fn();
  };

  try {
    sendSSE({ type: 'phase', phase: 'planning' });
    const sceneSpec = await generateSceneSpec(generationTopic, context, complexity);
    if (!sceneSpec) {
      sendSSE({ type: 'skip', reason: 'Failed to generate a valid 3D scene specification' });
      return res.end();
    }

    sendSSE({ type: 'phase', phase: 'generation' });
    let sceneLogic = await generateSceneLogic(sceneSpec, context, complexity);
    if (!sceneLogic) {
      sendSSE({ type: 'skip', reason: 'Failed to generate 3D scene logic' });
      return res.end();
    }

    let assembledCode = assemble3DWidget(sceneSpec, sceneLogic);
    let qualityCheck = validateGeneratedScene(sceneLogic, assembledCode, sceneSpec);

    if (!qualityCheck.valid) {
      sendSSE({ type: 'phase', phase: 'fixing', issues: qualityCheck.issues });
      const fixedSceneLogic = await fixSceneLogic(sceneSpec, sceneLogic, qualityCheck.issues);
      if (fixedSceneLogic) {
        sceneLogic = fixedSceneLogic;
        assembledCode = assemble3DWidget(sceneSpec, sceneLogic);
        qualityCheck = validateGeneratedScene(sceneLogic, assembledCode, sceneSpec);
      }
    }

    if (!qualityCheck.valid) {
      logger.warn({ issues: qualityCheck.issues, topic: generationTopic }, '3D widget failed validation after fixer');
      sendSSE({ type: 'skip', reason: qualityCheck.issues.join('; ') });
      return res.end();
    }

    const sanitizeResult = sanitizeWidgetCode(assembledCode, { allowFetch: true });
    if (!sanitizeResult.safe) {
      logger.warn({ violations: sanitizeResult.violations }, '3D widget sanitization failed');
      sendSSE({ type: 'skip', reason: 'Widget code failed security check' });
      return res.end();
    }

    let finalCode = assembledCode;
    const safetyCheck = validate3DWidgetSafety(assembledCode);
    if (!safetyCheck.valid) {
      finalCode = inject3DSafetyWrapper(assembledCode);
    }

    const widget = {
      id: `3d_${Date.now()}`,
      title: `${generationTopic.replace(/\s+/g, '_').toLowerCase()}_3d`,
      code: finalCode,
      widget_type: '3d',
      topic: generationTopic,
      generationMeta: {
        sceneSpec,
        criticApplied: qualityCheck.fixedByCritic === true,
        qualityLevel: sceneSpec.qualityLevel || complexity,
      },
    };

    sendSSE({ type: 'complete', widget });
    sendSSE({ type: 'done' });
    res.end();
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, '3D generation error');
    withAbortGuard(() => sendSSE({ type: 'error', error: error.message }));
    res.end();
  }

  res.on('close', () => {
    aborted = true;
  });
});

async function generateSceneSpec(topic, context, complexity) {
  const prompt = build3DSceneSpecPrompt(topic, context, complexity);
  const text = await runAnthropicText(prompt, 1800);
  const parsed = extractJsonObject(text);
  if (!parsed) {
    logger.warn({ topic, preview: text.slice(0, 300) }, '3D planner returned invalid JSON');
    return null;
  }

  if (!Array.isArray(parsed.components) || parsed.components.length < 1) {
    logger.warn({ topic, parsed }, '3D planner returned incomplete component list');
    return null;
  }

  return parsed;
}

async function generateSceneLogic(sceneSpec, context, complexity) {
  const prompt = build3DCodePrompt(JSON.stringify(sceneSpec, null, 2), context, complexity);
  const text = await runAnthropicText(prompt, 3200);
  return extractSceneLogic(text);
}

async function fixSceneLogic(sceneSpec, sceneLogic, issues) {
  const prompt = build3DCriticPrompt(
    JSON.stringify(sceneSpec, null, 2),
    serializeSceneLogic(sceneLogic),
    issues,
  );
  const text = await runAnthropicText(prompt, 3200);
  const fixed = extractSceneLogic(text);
  if (fixed) {
    fixed.fixedByCritic = true;
  }
  return fixed;
}

async function runAnthropicText(prompt, maxTokens) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  return (response.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
}

function extractJsonObject(text) {
  if (!text) return null;

  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] || text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function extractSceneLogic(text) {
  if (!text) return null;

  const setup = extractTag(text, 'setup');
  const update = extractTag(text, 'update');
  const label = extractTag(text, 'label');
  const metadataRaw = extractTag(text, 'metadata');
  const metadata = metadataRaw ? extractJsonObject(metadataRaw) : null;

  if (!setup || !update || !label || !metadata) {
    return null;
  }

  return { setup, update, label, metadata };
}

function extractTag(text, tagName) {
  const regex = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*</${tagName}>`, 'i');
  const match = text.match(regex);
  return match?.[1]?.trim() || '';
}

function serializeSceneLogic(sceneLogic) {
  return `<setup>\n${sceneLogic.setup}\n</setup>\n<update>\n${sceneLogic.update}\n</update>\n<label>\n${sceneLogic.label}\n</label>\n<metadata>\n${JSON.stringify(sceneLogic.metadata, null, 2)}\n</metadata>`;
}

function validateGeneratedScene(sceneLogic, assembledCode, sceneSpec) {
  const issues = [];
  const componentCount = sceneLogic.metadata?.componentCount || 0;
  const expectedComponents = Array.isArray(sceneSpec.components) ? sceneSpec.components.length : 0;
  const meshCount = (assembledCode.match(/new\s+THREE\.(Mesh|Line|Points)\s*\(/g) || []).length;

  if (componentCount < Math.min(3, Math.max(expectedComponents, 3))) {
    issues.push(`Scene metadata reports too few components (${componentCount})`);
  }

  if (meshCount < Math.min(3, Math.max(expectedComponents, 3))) {
    issues.push(`Rendered scene contains too few visible objects (${meshCount})`);
  }

  if (!sceneLogic.label.includes('return')) {
    issues.push('Status label logic must return a string');
  }

  const safetyCheck = validate3DWidgetSafety(assembledCode);
  if (!safetyCheck.valid) {
    issues.push(...safetyCheck.missing);
  }

  return {
    valid: issues.length === 0,
    issues,
    fixedByCritic: sceneLogic.fixedByCritic === true,
  };
}

function assemble3DWidget(sceneSpec, sceneLogic) {
  const title = sceneSpec.title || sceneSpec.topic || '3D Visualization';
  const labels = Array.isArray(sceneSpec.labels) ? sceneSpec.labels : [];
  const qualityLevel = sceneSpec.qualityLevel || 'medium';
  const interactionMode = sceneSpec.interactionMode || 'continuous';
  const cameraPosition = normalizeVector(sceneSpec.camera?.position, [4.5, 3.5, 6]);
  const cameraTarget = normalizeVector(sceneSpec.camera?.target, [0, 1.5, 0]);
  const cameraFov = typeof sceneSpec.camera?.fov === 'number' ? sceneSpec.camera.fov : 45;

  return `
<style>
  #container {
    width: 100%;
    height: 400px;
    position: relative;
    background: var(--color-background, #161616);
    border-radius: 8px;
    overflow: hidden;
  }
  .ve-controls {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 8px;
    z-index: 3;
  }
  .ve-controls button {
    border: none;
    border-radius: 999px;
    padding: 8px 12px;
    background: var(--color-primary, #c96442);
    color: white;
    cursor: pointer;
    font: 600 12px system-ui, sans-serif;
  }
  .ve-pill {
    position: absolute;
    z-index: 3;
    font: 600 12px system-ui, sans-serif;
    border-radius: 999px;
    padding: 8px 12px;
    color: white;
    background: rgba(15, 23, 42, 0.72);
    backdrop-filter: blur(6px);
  }
  #status-pill {
    top: 12px;
    right: 12px;
  }
  #quality-pill {
    top: 52px;
    right: 12px;
    opacity: 0.9;
  }
  #legend-panel {
    position: absolute;
    right: 12px;
    bottom: 12px;
    min-width: 180px;
    background: rgba(15, 23, 42, 0.72);
    color: white;
    border-radius: 12px;
    padding: 12px;
    font: 500 12px system-ui, sans-serif;
    z-index: 3;
  }
  #legend-panel h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
    opacity: 0.85;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  #legend-panel ul {
    margin: 0;
    padding-left: 16px;
  }
  #legend-panel li {
    margin-bottom: 4px;
  }
  #footer-hint {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    z-index: 3;
    border-radius: 999px;
    padding: 8px 14px;
    background: rgba(15, 23, 42, 0.72);
    color: white;
    font: 500 12px system-ui, sans-serif;
    white-space: nowrap;
  }
</style>

<div id="container">
  <div class="ve-controls">
    <button id="playPauseBtn">Pause</button>
    <button id="speedBtn">1x Speed</button>
  </div>
  <div id="status-pill" class="ve-pill">${escapeHtml(title)}</div>
  <div id="quality-pill" class="ve-pill">${escapeHtml(qualityLevel)} detail</div>
  <div id="legend-panel">
    <h4>Learning Focus</h4>
    <ul>${labels.map(label => `<li>${escapeHtml(label)}</li>`).join('')}</ul>
  </div>
  <div id="footer-hint">Drag to rotate • Scroll to zoom • Inspect the model</div>
</div>

<script src="${CDN_VERSIONS.threejs}"></script>
<script src="${CDN_VERSIONS.orbitControls}"></script>
<script>
(function() {
  var container = document.getElementById('container');
  if (!container || !window.THREE || !window.THREE.OrbitControls) {
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--color-muted-foreground);">3D runtime unavailable.</div>';
    return;
  }

  var canvas = document.createElement('canvas');
  var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) {
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--color-muted-foreground);"><p style="font-size:48px;margin-bottom:16px;">⚠️</p><p style="font-size:14px;margin:0;">3D visualization not supported</p><p style="font-size:12px;margin-top:8px;opacity:0.7;">Your browser does not support WebGL.</p></div>';
    return;
  }

  var THREE = window.THREE;
  var scene = new THREE.Scene();
  scene.background = null;

  var camera = new THREE.PerspectiveCamera(${cameraFov}, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(${cameraPosition.join(', ')});

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = ${interactionMode === 'continuous' ? 'true' : 'false'};
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(${cameraTarget.join(', ')});
  controls.minDistance = 2.5;
  controls.maxDistance = 14;

  var ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  var keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
  keyLight.position.set(5, 8, 6);
  keyLight.castShadow = true;
  scene.add(keyLight);

  var fillLight = new THREE.DirectionalLight(0x99bbff, 0.55);
  fillLight.position.set(-4, 4, 3);
  scene.add(fillLight);

  var rimLight = new THREE.PointLight(0xffddaa, 0.35, 30);
  rimLight.position.set(-3, 5, -4);
  scene.add(rimLight);

  var floor = new THREE.Mesh(
    new THREE.CircleGeometry(4.8, 48),
    new THREE.MeshStandardMaterial({ color: 0x20242d, roughness: 0.95, metalness: 0.05, transparent: true, opacity: 0.45 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);

  var runtime = {
    THREE: THREE,
    scene: scene,
    camera: camera,
    renderer: renderer,
    controls: controls,
    container: container,
    statusPill: document.getElementById('status-pill'),
    footerHint: document.getElementById('footer-hint'),
    qualityPill: document.getElementById('quality-pill'),
    deltaClock: new THREE.Clock(),
  };

  var state = {
    isVisible: true,
    isPlaying: ${interactionMode === 'continuous' ? 'true' : 'false'},
    speedMultiplier: 1,
    animationId: null,
    elapsed: 0,
    qualityLevel: ${JSON.stringify(qualityLevel)},
    interactionMode: ${JSON.stringify(interactionMode)},
    labels: ${JSON.stringify(labels)},
    sceneTitle: ${JSON.stringify(title)},
  };

  function safeRender() {
    controls.update();
    renderer.render(scene, camera);
  }

  function updateScene(state, runtime, deltaSeconds) {
${indentBlock(sceneLogic.update, 4)}
  }

  function getStatusLabel(state, runtime) {
${indentBlock(sceneLogic.label, 4)}
  }

  try {
${indentBlock(sceneLogic.setup, 4)}
  } catch (error) {
    console.error('Scene setup failed', error);
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--color-muted-foreground);">3D setup failed.</div>';
    return;
  }

  function tick() {
    state.animationId = window.requestAnimationFrame(tick);
    var deltaSeconds = runtime.deltaClock.getDelta();
    if (state.isVisible && state.isPlaying) {
      state.elapsed += deltaSeconds * state.speedMultiplier;
      updateScene(state, runtime, deltaSeconds);
    }
    runtime.statusPill.textContent = getStatusLabel(state, runtime) || state.sceneTitle;
    safeRender();
  }

  controls.addEventListener('change', function() {
    if (!state.isPlaying) safeRender();
  });

  function handleResize() {
    var width = container.clientWidth || 1;
    var height = container.clientHeight || 1;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    safeRender();
  }

  window.addEventListener('resize', handleResize);
  var observer = new IntersectionObserver(function(entries) {
    state.isVisible = !!entries[0]?.isIntersecting;
    if (state.isVisible) safeRender();
  }, { threshold: 0.1 });
  observer.observe(container);

  document.getElementById('playPauseBtn').addEventListener('click', function() {
    state.isPlaying = !state.isPlaying;
    this.textContent = state.isPlaying ? 'Pause' : 'Play';
    safeRender();
  });

  document.getElementById('speedBtn').addEventListener('click', function() {
    if (state.speedMultiplier === 1) state.speedMultiplier = 0.5;
    else if (state.speedMultiplier === 0.5) state.speedMultiplier = 2;
    else state.speedMultiplier = 1;
    this.textContent = state.speedMultiplier + 'x Speed';
  });

  window.addEventListener('beforeunload', function() {
    if (state.animationId) window.cancelAnimationFrame(state.animationId);
    observer.disconnect();
    renderer.dispose();
    scene.traverse(function(obj) {
      if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(function(material) {
            if (material.dispose) material.dispose();
          });
        } else if (obj.material.dispose) {
          obj.material.dispose();
        }
      }
    });
  });

  safeRender();
  tick();
})();
</script>
`;
}

function normalizeVector(value, fallback) {
  if (!Array.isArray(value) || value.length !== 3 || value.some(v => typeof v !== 'number' || Number.isNaN(v))) {
    return fallback;
  }
  return value;
}

function indentBlock(text, spaces) {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map(line => `${pad}${line}`)
    .join('\n');
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default router;
