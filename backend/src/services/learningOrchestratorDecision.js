import { SIMULATION_CONFIG } from '../config/simulation.js';
import { detectSandboxSimulationSupport } from '../simulation/sandbox-engine.js';

const EXPLICIT_SIMULATION_PATTERN = /\b(simulate|simulation|visuali[sz]e|show\s+(?:me\s+)?(?:an?\s+)?(?:animation|visual|interactive)|animate|animation|interactive)\b/i;
const EXPLICIT_3D_PATTERN = /\b(3d|three[-\s]?d|spatial|in\s+3d|three dimensional)\b/i;
const QUIZ_PATTERN = /\b(quiz|test me|ask me questions|practice questions|question me)\b/i;
const FLASHCARD_PATTERN = /\b(flashcards?|cards?|revise with cards)\b/i;
const MINDMAP_PATTERN = /\b(mind\s?map|concept map|map this)\b/i;
const LEARN_PATTERN = /\b(teach me|learn deeply|deep dive|learning mode|explore)\b/i;
const CONTEXTUAL_REFERENCE_PATTERN = /\b(this|it|that|the topic|same topic|above)\b/i;

const HIGH_VALUE_SIMULATION_PATTERNS = [
  /\b(bubble|quick|merge|insertion|selection|heap)\s+sort\b/i,
  /\b(binary search|graph traversal|breadth[-\s]?first|depth[-\s]?first|dijkstra|a\*)\b/i,
  /\b(stack|queue|linked list|tree traversal|hash table|recursion)\b/i,
  /\b(neural network|gradient descent|backpropagation|clustering|classification)\b/i,
  /\b(cpu scheduling|process scheduling|paging|deadlock|cache memory)\b/i,
  /\b(photosynthesis|cell division|mitosis|meiosis|orbit|wave|circuit)\b/i,
];

const MEDIUM_VALUE_SIMULATION_PATTERNS = [
  /\b(machine learning|algorithm|data structure|operating system|network|protocol)\b/i,
  /\b(process|workflow|pipeline|cycle|architecture|system)\b/i,
];

const DEFINITION_ONLY_PATTERN = /\b(define|definition of|what is|who is|when was)\b/i;
const LOW_VISUAL_VALUE_PATTERN = /\b(cpu|ram|api|http|html|css|javascript|java|python|database|sql)\b/i;

function clamp01(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function cleanTopic(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\b(?:in\s+)?(?:3d|three[-\s]?d|three dimensional)\b/gi, '')
    .replace(/\b(?:visuali[sz]e|simulate|simulation|animate|animation|interactive)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || null;
}

function traceStage(stage, { input = null, output = null, startTime = performance.now(), success = true } = {}) {
  console.log({
    stage,
    input,
    output,
    duration: Math.round((performance.now() - startTime) * 100) / 100,
    success,
  });
}

function extractTopicFromQuery(query = '') {
  const text = String(query || '').trim();
  const patterns = [
    /\b(?:explain|define|describe|teach me about|help me understand|what is|what are|visuali[sz]e|simulate|show(?: me)?|quiz me on|quiz me about)\s+(.+?)(?:[?.!]|$)/i,
    /\b(?:about|topic:)\s+(.+?)(?:[?.!]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanTopic(match[1]);
  }

  return cleanTopic(text);
}

function resolveTopic(query, conversationState = {}) {
  const activeTopic = cleanTopic(conversationState.activeTopic);
  const extracted = extractTopicFromQuery(query);
  const isContextual = CONTEXTUAL_REFERENCE_PATTERN.test(query);
  const onlyArtifactRequest = /^(?:please\s+)?(?:visuali[sz]e|simulate|animate|show(?: me)?(?: this| it| that)?(?: in 3d)?|quiz me|test me|make flashcards?|make a mind\s?map)(?:\s+(?:this|it|that))?[?.!]*$/i.test(String(query || '').trim());

  if (activeTopic && (isContextual || onlyArtifactRequest)) {
    return activeTopic;
  }

  return extracted || activeTopic || null;
}

function simulationScore(query, topic, explicitSimulation, explicit3D) {
  const target = `${query || ''} ${topic || ''}`;
  if (explicitSimulation || explicit3D) return 0.96;
  if (HIGH_VALUE_SIMULATION_PATTERNS.some(pattern => pattern.test(target))) return 0.95;
  if (DEFINITION_ONLY_PATTERN.test(query) && LOW_VISUAL_VALUE_PATTERN.test(target)) return 0.22;
  if (DEFINITION_ONLY_PATTERN.test(query)) return 0.42;
  if (MEDIUM_VALUE_SIMULATION_PATTERNS.some(pattern => pattern.test(target))) return 0.62;
  if (/\b(explain|how does|how do|why does)\b/i.test(query) && /\b(sort|search|algorithm|cycle|process|flow|network)\b/i.test(target)) return 0.86;
  return 0.28;
}

function artifactList(query, requestedArtifact = null) {
  const artifacts = new Set();
  if (requestedArtifact && !['simulation', '3d_scene'].includes(requestedArtifact)) {
    artifacts.add(requestedArtifact);
  }
  if (QUIZ_PATTERN.test(query)) artifacts.add('quiz');
  if (FLASHCARD_PATTERN.test(query)) artifacts.add('flashcards');
  if (MINDMAP_PATTERN.test(query)) artifacts.add('mindmap');
  if (LEARN_PATTERN.test(query)) artifacts.add('learn');
  return [...artifacts];
}

export function buildConversationState({ query, previousState = {}, decision = null } = {}) {
  const activeTopic = cleanTopic(decision?.activeTopic) || resolveTopic(query, previousState);
  const lastArtifact = decision?.artifacts?.[0]
    || (decision?.scene3D?.needed ? '3d_scene' : null)
    || (decision?.simulation?.needed ? 'simulation' : null)
    || previousState.lastArtifact
    || null;

  return {
    activeTopic,
    subTopic: cleanTopic(previousState.subTopic),
    lastArtifact,
    mode: decision?.mode || previousState.mode || 'chat',
  };
}

export function LearningOrchestratorDecision({
  query,
  mode = 'chat',
  conversationState = {},
  requestedArtifact = null,
} = {}) {
  const startTime = performance.now();
  const normalizedMode = mode === 'learning' ? 'learning' : 'chat';
  const text = String(query || '');
  const activeTopic = resolveTopic(text, conversationState);
  const explicit3D = EXPLICIT_3D_PATTERN.test(text);
  const explicitSimulation = EXPLICIT_SIMULATION_PATTERN.test(text) || requestedArtifact === 'simulation';
  const artifacts = artifactList(text, requestedArtifact);
  const score = clamp01(simulationScore(text, activeTopic, explicitSimulation, explicit3D));
  const autoRender = score > SIMULATION_CONFIG.AUTO_RENDER_THRESHOLD;
  const suggested = score > SIMULATION_CONFIG.SUGGEST_THRESHOLD && score <= SIMULATION_CONFIG.AUTO_RENDER_THRESHOLD;
  const simulationNeeded = Boolean(explicitSimulation || explicit3D || (normalizedMode === 'learning' && requestedArtifact === 'simulation') || autoRender);
  const scene3DNeeded = Boolean(explicit3D);

  const decision = {
    mode: normalizedMode,
    simulation: {
      needed: simulationNeeded,
      confidence: score,
      explicit: Boolean(explicitSimulation || explicit3D),
      suggested: !simulationNeeded && suggested,
      fallback: false,
    },
    scene3D: {
      needed: scene3DNeeded,
      confidence: explicit3D ? Math.max(score, 0.93) : Math.min(score, 0.45),
      explicit: explicit3D,
    },
    artifacts,
    activeTopic,
    resolvedQuery: activeTopic && CONTEXTUAL_REFERENCE_PATTERN.test(text)
      ? `${text} (${activeTopic})`
      : text,
    thresholds: {
      autoRender: SIMULATION_CONFIG.AUTO_RENDER_THRESHOLD,
      suggest: SIMULATION_CONFIG.SUGGEST_THRESHOLD,
      minEngine: SIMULATION_CONFIG.MIN_ENGINE_CONFIDENCE,
    },
  };

  const output = {
    ...decision,
    conversationState: buildConversationState({ query: text, previousState: conversationState, decision }),
  };

  traceStage('decisionComplete', {
    input: { query: text, mode: normalizedMode, conversationState, requestedArtifact },
    output: {
      mode: output.mode,
      simulation: output.simulation,
      scene3D: output.scene3D,
      artifacts: output.artifacts,
      activeTopic: output.activeTopic,
    },
    startTime,
  });

  return output;
}

export async function getSimulationSupport(query) {
  const startTime = performance.now();
  const support = detectSandboxSimulationSupport(query, { requestedArtifact: 'simulation' });
  const output = {
    supported: support.supported,
    topic: support.topic,
    domain: support.domain,
    complexity: support.complexity,
    educationalIntent: support.reason,
    simulationType: support.simulationType,
    confidence: clamp01(support.confidence, 0),
  };
  traceStage('simulationDetection', {
    input: { query },
    output,
    startTime,
  });
  return output;
}

export async function applySimulationSupportGuard(decision, query) {
  if (!decision?.simulation?.needed) return decision;

  const support = await getSimulationSupport(query || decision.activeTopic || decision.resolvedQuery);
  const guarded = {
    ...decision,
    simulation: { ...decision.simulation },
    scene3D: { ...decision.scene3D },
    simulationSupport: support,
  };

  if (
    !guarded.simulation.explicit &&
    (!support.supported || support.confidence < SIMULATION_CONFIG.MIN_ENGINE_CONFIDENCE)
  ) {
    guarded.simulation.needed = false;
    guarded.simulation.fallback = true;
    guarded.simulation.suggested = support.confidence > SIMULATION_CONFIG.SUGGEST_THRESHOLD;
  }

  return {
    ...guarded,
    conversationState: buildConversationState({
      query,
      previousState: decision.conversationState,
      decision: guarded,
    }),
  };
}

export { SIMULATION_CONFIG };
