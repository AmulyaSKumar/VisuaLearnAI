import { randomUUID } from 'crypto';
import { performance } from 'node:perf_hooks';

const MAX_BUNDLE_BYTES = 240000;
const MAX_STEPS = 160;
const MAX_FIELD_LENGTH = 120000;
const SANDBOX_VERSION = '1.0';

const BLOCKED_JS_PATTERNS = [
  { code: 'network_fetch', pattern: /\bfetch\s*\(/i },
  { code: 'xml_http_request', pattern: /\bXMLHttpRequest\b/i },
  { code: 'websocket', pattern: /\bWebSocket\b/i },
  { code: 'event_source', pattern: /\bEventSource\b/i },
  { code: 'storage_local', pattern: /\blocalStorage\b/i },
  { code: 'storage_session', pattern: /\bsessionStorage\b/i },
  { code: 'indexed_db', pattern: /\bindexedDB\b/i },
  { code: 'cookie_access', pattern: /\bdocument\s*\.\s*cookie\b/i },
  { code: 'eval', pattern: /\beval\s*\(/i },
  { code: 'function_constructor', pattern: /\bnew\s+Function\b|\bFunction\s*\(/i },
  { code: 'dynamic_import', pattern: /\bimport\s*\(/i },
  { code: 'static_import', pattern: /^\s*import\s+/im },
  { code: 'commonjs_require', pattern: /\brequire\s*\(/i },
  { code: 'parent_access', pattern: /\bwindow\s*\.\s*(parent|top|opener)\b|\b(parent|top|opener)\s*\./i },
  { code: 'navigation', pattern: /\blocation\s*\.\s*(assign|replace|href)\b|\bhistory\s*\./i },
  { code: 'popup', pattern: /\bwindow\s*\.\s*open\s*\(/i },
];

const BLOCKED_HTML_PATTERNS = [
  { code: 'full_document_html', pattern: /<\s*\/?\s*(html|head|body)\b/i },
  { code: 'script_tag_in_html', pattern: /<\s*script\b/i },
  { code: 'iframe_tag', pattern: /<\s*iframe\b/i },
  { code: 'object_tag', pattern: /<\s*object\b/i },
  { code: 'embed_tag', pattern: /<\s*embed\b/i },
  { code: 'form_tag', pattern: /<\s*form\b/i },
  { code: 'external_link', pattern: /<\s*link\b[^>]*(href\s*=|rel\s*=\s*["']?stylesheet)/i },
  { code: 'external_resource', pattern: /\b(src|href)\s*=\s*["']\s*(https?:|\/\/|data:text\/html|javascript:)/i },
  { code: 'event_handler', pattern: /\son[a-z]+\s*=/i },
];

const BLOCKED_CSS_PATTERNS = [
  { code: 'css_import', pattern: /@import/i },
  { code: 'css_external_url', pattern: /url\s*\(\s*["']?\s*(https?:|\/\/|javascript:|data:text\/html)/i },
  { code: 'css_expression', pattern: /expression\s*\(/i },
];

const GENERATION_SYSTEM_PROMPT = `You are the VisuaLearn Sandboxed Simulation Agent.
Return ONLY valid JSON. Generate an educational simulation as either declarative data or a sandbox bundle.

Allowed sandbox bundle shape:
{
  "type": "sandbox_simulation",
  "title": "short title",
  "html": "body-only HTML, no script/link/iframe/form",
  "css": "scoped CSS, no imports or external URLs",
  "js": "plain browser JS for the sandbox document only",
  "defaultData": {},
  "steps": [{ "id": "step-1", "title": "...", "description": "..." }],
  "metadata": { "requiresSandbox": true }
}

Rules:
- Use sandbox_simulation only when custom layout or animation is useful.
- Prefer a clear educational visual over decorative design.
- No React, JSX, imports, packages, network, fetch, storage, cookies, external URLs, iframes, popups, parent/top/opener access, navigation, eval, or Function constructor.
- JS may use document.querySelector inside the sandbox document, addEventListener, setInterval, and local variables.
- Include Play, Previous, Next, Restart controls in HTML when useful.
- For merge sort, show array splitting into levels/tree and merging upward.
- For bubble sort, show bars or array cells with compare/swap/pass steps.`;

function nowMs(startTime) {
  return Math.round((performance.now() - startTime) * 100) / 100;
}

function safeText(value, fallback = '', max = 160) {
  return String(value ?? fallback).replace(/[<>]/g, '').trim().slice(0, max);
}

function parseJsonObject(text) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function tracePush(trace, stage, startTime, payload = {}) {
  const entry = {
    stage,
    durationMs: nowMs(startTime),
    success: payload.success !== false,
    ...payload,
  };
  trace.push(entry);
  console.log({ simulationSandbox: entry });
  return entry;
}

function normalizeQuery(query) {
  return String(query || '').trim().replace(/\s+/g, ' ');
}

function isExplicitVisualizationRequest(query, requestedArtifact = null) {
  return requestedArtifact === 'simulation'
    || requestedArtifact === 'visualization'
    || /\b(visuali[sz]e|simulate|simulation|animation|animate|show\s+(?:me\s+)?(?:a\s+)?visual|interactive visual)\b/i.test(String(query || ''));
}

function inferTopic(query) {
  const text = normalizeQuery(query);
  const lower = text.toLowerCase();
  if (/\b(recursion|recursive|factorial recursion|call stack)\b/.test(lower)) {
    return {
      topic: 'Recursion',
      family: 'abstract',
      domain: 'computer science',
      complexity: 'intermediate',
      supported: true,
      confidence: 0.9,
      simulationType: 'abstract_stack',
      requiresSandbox: false,
      reason: 'Recursion is best simulated as stack frames growing to a base case and unwinding.',
    };
  }
  if (/\b(quadratic|parabola|function graph|graph function|derivative|slope|integral|sine|cosine|trigonometry|linear equation|equation)\b/.test(lower)) {
    return {
      topic: lower.includes('derivative') || lower.includes('slope') ? 'Derivative and Slope' : 'Function Graph',
      family: 'mathematics',
      domain: 'mathematics',
      complexity: 'intermediate',
      supported: true,
      confidence: 0.88,
      simulationType: 'math_function',
      requiresSandbox: false,
      reason: 'Math functions can be simulated by plotting points and highlighting how parameters change the graph.',
    };
  }
  if (/\bmerge\s*sort\b/.test(lower)) {
    return {
      topic: 'Merge Sort',
      domain: 'algorithms',
      complexity: 'intermediate',
      supported: true,
      confidence: 0.96,
      simulationType: 'sandbox_simulation',
      requiresSandbox: true,
      reason: 'Merge sort benefits from showing recursive splits and merge levels.',
    };
  }
  if (/\bbubble\s*sort\b/.test(lower)) {
    return {
      topic: 'Bubble Sort',
      domain: 'algorithms',
      complexity: 'beginner',
      supported: true,
      confidence: 0.96,
      simulationType: 'sandbox_simulation',
      requiresSandbox: false,
      reason: 'Bubble sort can be shown with array bars and compare/swap steps.',
    };
  }
  if (/\bheap\s*sort\b/.test(lower)) {
    return {
      topic: 'Heap Sort',
      family: 'algorithm_sorting',
      domain: 'algorithms',
      complexity: 'intermediate',
      supported: true,
      confidence: 0.94,
      simulationType: 'sandbox_simulation',
      requiresSandbox: true,
      reason: 'Heap sort benefits from showing heap construction, root swaps, and heapify steps.',
    };
  }
  if (/\bquick\s*sort\b/.test(lower)) {
    return {
      topic: 'Quick Sort',
      domain: 'algorithms',
      complexity: 'intermediate',
      supported: true,
      confidence: 0.94,
      simulationType: 'sandbox_simulation',
      requiresSandbox: true,
      reason: 'Quick sort benefits from showing pivot selection, partitioning, and recursive subarrays.',
    };
  }
  if (/\bbinary\s*search\b/.test(lower)) {
    return {
      topic: 'Binary Search',
      domain: 'algorithms',
      complexity: 'beginner',
      supported: true,
      confidence: 0.92,
      simulationType: 'sandbox_simulation',
      requiresSandbox: false,
      reason: 'Binary search benefits from showing low, mid, high, and discarded halves.',
    };
  }
  if (/\b(round\s*robin|cpu scheduling|process scheduling)\b/.test(lower)) {
    return {
      topic: 'CPU Scheduling',
      domain: 'operating systems',
      complexity: 'intermediate',
      supported: true,
      confidence: 0.82,
      simulationType: 'timeline',
      requiresSandbox: false,
      reason: 'Scheduling can be simulated as a queue and timeline.',
    };
  }
  if (/\b(dfs|depth[-\s]?first|breadth[-\s]?first|bfs|graph traversal)\b/.test(lower)) {
    return {
      topic: /bfs|breadth/i.test(text) ? 'Breadth First Search' : 'Depth First Search',
      family: 'algorithm',
      domain: 'algorithms',
      complexity: 'intermediate',
      supported: true,
      confidence: 0.88,
      simulationType: 'graph_traversal',
      requiresSandbox: false,
      reason: 'Graph traversal benefits from showing visited nodes, frontier/stack, and traversal order.',
    };
  }
  if (/\b(digestion|photosynthesis|water cycle|blood circulation)\b/.test(lower)) {
    return {
      topic: lower.includes('photosynthesis') ? 'Photosynthesis' : lower.includes('digestion') ? 'Digestion' : 'Flow Process',
      family: 'flow_process',
      domain: lower.includes('photosynthesis') || lower.includes('digestion') ? 'biology' : 'general education',
      complexity: 'beginner',
      supported: true,
      confidence: 0.86,
      simulationType: 'flow_process',
      requiresSandbox: false,
      reason: 'A flow process can be simulated by moving material or energy through ordered stages.',
    };
  }
  if (/\b(pendulum|gravity|projectile|spring|orbit force)\b/.test(lower)) {
    return {
      topic: lower.includes('pendulum') ? 'Pendulum' : 'Gravity',
      family: 'physical_system',
      domain: 'physics',
      complexity: 'intermediate',
      supported: true,
      confidence: 0.86,
      simulationType: 'physical_system',
      requiresSandbox: true,
      reason: 'A physical system benefits from dynamic motion and changing state over time.',
    };
  }
  if (/\b(tcp|api flow|http request|client server|packet|communication)\b/.test(lower)) {
    return {
      topic: lower.includes('tcp') ? 'TCP Handshake' : 'API Flow',
      family: 'network',
      domain: 'networking',
      complexity: 'intermediate',
      supported: true,
      confidence: 0.86,
      simulationType: 'network_communication',
      requiresSandbox: false,
      reason: 'Network communication can be simulated as messages moving between nodes.',
    };
  }
  if (/\b(universe|history|timeline|evolution of|industrial revolution|world war)\b/.test(lower)) {
    return {
      topic: lower.includes('universe') ? 'Universe Timeline' : 'History Timeline',
      family: 'timeline',
      domain: lower.includes('universe') ? 'astronomy' : 'history',
      complexity: 'beginner',
      supported: true,
      confidence: 0.82,
      simulationType: 'timeline',
      requiresSandbox: false,
      reason: 'Timeline topics are best simulated as ordered events with highlighted progression.',
    };
  }
  if (/\b(dna|cpu architecture|cpu components|cell structure|atom structure|neuron)\b/.test(lower)) {
    return {
      topic: lower.includes('dna') ? 'DNA Structure' : lower.includes('cpu') ? 'CPU Structure' : 'Component Structure',
      family: 'structure',
      domain: lower.includes('dna') ? 'biology' : 'computer science',
      complexity: 'beginner',
      supported: true,
      confidence: 0.84,
      simulationType: 'structure_explorer',
      requiresSandbox: false,
      reason: 'Structure topics work well as component explorers with highlighted parts and relationships.',
    };
  }
  if (/\b(decision|if else|if\/else|decision tree|choose|branching)\b/.test(lower)) {
    return {
      topic: 'Decision Process',
      family: 'decision_process',
      domain: 'reasoning',
      complexity: 'beginner',
      supported: true,
      confidence: 0.8,
      simulationType: 'decision_tree',
      requiresSandbox: false,
      reason: 'Decision topics can be simulated as branching choices and outcomes.',
    };
  }
  if (/\b(probability|random|distribution|histogram|statistics|coin toss|dice)\b/.test(lower)) {
    return {
      topic: 'Probability',
      family: 'statistical',
      domain: 'mathematics',
      complexity: 'beginner',
      supported: true,
      confidence: 0.84,
      simulationType: 'statistical_trials',
      requiresSandbox: true,
      reason: 'Probability is best simulated with repeated trials and a changing distribution.',
    };
  }
  if (/\b(solar system|planet|orbit|map|spatial|geometry space)\b/.test(lower)) {
    return {
      topic: 'Solar System',
      family: 'spatial',
      domain: 'astronomy',
      complexity: 'beginner',
      supported: true,
      confidence: 0.86,
      simulationType: 'spatial_scene',
      requiresSandbox: true,
      reason: 'Spatial topics benefit from relative positions, orbits, and motion.',
    };
  }
  if (/\bwhat\s+is\s+cpu\b|\bdefine\s+cpu\b|\bcpu\b/.test(lower)) {
    return {
      topic: 'CPU',
      domain: 'computer science',
      complexity: 'beginner',
      supported: false,
      confidence: 0.28,
      simulationType: 'concept',
      requiresSandbox: false,
      reason: 'A CPU definition is better as an explanation unless the user asks for an architecture/process simulation.',
    };
  }
  const processLike = /\b(sort|search|algorithm|graph|tree|queue|stack|process|cycle|simulation|simulate|visuali[sz]e)\b/i.test(text);
  return {
    topic: safeText(text || 'Learning concept', 'Learning concept', 80),
    domain: processLike ? 'general education' : 'general education',
    complexity: 'beginner',
    supported: processLike,
    confidence: processLike ? 0.62 : 0.32,
    simulationType: processLike ? 'sandbox_simulation' : 'concept',
    requiresSandbox: processLike,
    reason: processLike
      ? 'The query appears to describe a process that can be visualized.'
      : 'The query does not clearly describe a process or state change to simulate.',
  };
}

export function planSandboxSimulation(query, topicUnderstanding = inferTopic(query)) {
  if (!topicUnderstanding.supported) {
    return {
      components: ['explanation panel'],
      interactions: [],
      animationFlow: [],
      outputMode: 'unsupported',
      requiresSandbox: false,
      prompt: `Explain why ${topicUnderstanding.topic} is not a strong simulation candidate.`,
    };
  }

  if (topicUnderstanding.topic === 'Merge Sort') {
    return {
      components: ['array cells', 'split tree levels', 'merge rows', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: [
        'show the original array',
        'split into left and right halves recursively',
        'show leaf arrays',
        'merge sorted subarrays upward',
        'show the final sorted array',
      ],
      outputMode: 'sandbox_simulation',
      requiresSandbox: true,
      defaultData: { array: [8, 3, 5, 1, 7, 2] },
      prompt: 'Generate a merge sort sandbox showing recursive split levels and upward merge steps.',
    };
  }

  if (topicUnderstanding.topic === 'Bubble Sort') {
    return {
      components: ['array bars', 'comparison highlight', 'swap highlight', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: [
        'show initial array',
        'compare adjacent values',
        'swap when left value is greater',
        'lock the largest value after each pass',
        'show the sorted result',
      ],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: { array: [5, 2, 4, 1] },
      prompt: 'Generate a bubble sort sandbox with bars and adjacent compare/swap steps.',
    };
  }

  if (topicUnderstanding.topic === 'Heap Sort') {
    return {
      components: ['array cells', 'binary heap view', 'root highlight', 'heap boundary', 'sorted suffix', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: [
        'show initial array',
        'heapify parent nodes from bottom to top',
        'build a max heap',
        'swap the root with the end of the heap',
        'shrink the heap boundary and heapify again',
        'show the sorted result',
      ],
      outputMode: 'sandbox_simulation',
      requiresSandbox: true,
      defaultData: { array: [4, 10, 3, 5, 1, 8] },
      prompt: 'Generate a heap sort sandbox showing max-heap construction, root swaps, and the sorted suffix.',
    };
  }

  if (topicUnderstanding.topic === 'Quick Sort') {
    return {
      components: ['array bars', 'pivot highlight', 'partition boundary', 'recursive ranges', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: [
        'show initial array',
        'choose a pivot',
        'compare items against the pivot',
        'partition smaller items to the left and larger items to the right',
        'repeat on subarrays',
        'show the sorted result',
      ],
      outputMode: 'sandbox_simulation',
      requiresSandbox: true,
      defaultData: { array: [8, 3, 5, 1, 7, 2] },
      prompt: 'Generate a quick sort sandbox with pivot selection and partition steps.',
    };
  }

  if (topicUnderstanding.topic === 'Binary Search') {
    return {
      components: ['sorted array cells', 'low marker', 'mid marker', 'high marker', 'discarded range', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: [
        'show sorted array and target',
        'choose the middle item',
        'compare target with middle',
        'discard the impossible half',
        'repeat until the target is found or absent',
      ],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: { array: [1, 3, 5, 7, 9, 11, 13], target: 9 },
      prompt: 'Generate a binary search sandbox with low, mid, high, and discarded ranges.',
    };
  }

  if (topicUnderstanding.topic === 'CPU Scheduling') {
    return {
      components: ['ready queue', 'Gantt timeline', 'remaining burst table', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: [
        'show processes in the ready queue',
        'run the active process for one quantum',
        'move unfinished process to the back of the queue',
        'mark completed processes',
        'show turnaround and waiting time summary',
      ],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: {
        processes: [
          { id: 'P1', burst: 5 },
          { id: 'P2', burst: 3 },
          { id: 'P3', burst: 7 },
        ],
        quantum: 2,
      },
      prompt: 'Generate a round robin CPU scheduling sandbox with ready queue and Gantt timeline.',
    };
  }

  if (topicUnderstanding.family === 'algorithm') {
    return {
      components: ['graph nodes', 'visited highlight', 'frontier stack or queue', 'traversal order', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['start at source node', 'mark current node visited', 'update frontier', 'advance traversal order'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: {},
      prompt: `Generate a graph traversal sandbox for ${topicUnderstanding.topic}.`,
    };
  }

  if (topicUnderstanding.family === 'flow_process') {
    return {
      components: ['source stage', 'process stages', 'moving token', 'output stage', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['introduce input', 'move through each stage', 'transform material or energy', 'show final output'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: {},
      prompt: `Generate a flow-process sandbox for ${topicUnderstanding.topic}.`,
    };
  }

  if (topicUnderstanding.family === 'physical_system') {
    return {
      components: ['object', 'force/motion path', 'state readout', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['show initial state', 'apply force or displacement', 'show motion over time', 'show changed energy/state'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: true,
      defaultData: topicUnderstanding.topic === 'Pendulum'
        ? { length: 1, angle: 28, gravity: 9.8 }
        : { height: 100, velocity: 0, gravity: 9.8 },
      prompt: `Generate a physical-system sandbox for ${topicUnderstanding.topic}.`,
    };
  }

  if (topicUnderstanding.family === 'network') {
    return {
      components: ['sender node', 'receiver node', 'intermediate node', 'message packet', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['send request/message', 'acknowledge receipt', 'process response', 'complete communication'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: {},
      prompt: `Generate a network communication sandbox for ${topicUnderstanding.topic}.`,
    };
  }

  if (topicUnderstanding.family === 'timeline') {
    return {
      components: ['event rail', 'event cards', 'cause-effect highlight', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['show first event', 'advance chronologically', 'highlight consequence', 'summarize final state'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: {},
      prompt: `Generate a timeline sandbox for ${topicUnderstanding.topic}.`,
    };
  }

  if (topicUnderstanding.family === 'structure') {
    return {
      components: ['central structure', 'labeled components', 'relationship links', 'detail panel', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['show whole structure', 'highlight each component', 'explain component role', 'show how parts work together'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: {},
      prompt: `Generate a structure explorer sandbox for ${topicUnderstanding.topic}.`,
    };
  }

  if (topicUnderstanding.family === 'decision_process') {
    return {
      components: ['decision node', 'branches', 'conditions', 'outcomes', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['start with input', 'evaluate condition', 'follow branch', 'reach outcome'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: {},
      prompt: 'Generate a decision-process sandbox with branching outcomes.',
    };
  }

  if (topicUnderstanding.family === 'statistical') {
    return {
      components: ['trial generator', 'running counts', 'histogram bars', 'probability readout', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['run one trial', 'record outcome', 'update counts', 'show distribution stabilizing'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: true,
      defaultData: { trials: ['H', 'T', 'H', 'H', 'T', 'T', 'H', 'T', 'H', 'H'] },
      prompt: 'Generate a probability sandbox with repeated trials and a dynamic histogram.',
    };
  }

  if (topicUnderstanding.family === 'spatial') {
    return {
      components: ['central body', 'orbiting bodies', 'position labels', 'motion path', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['show spatial layout', 'advance orbital positions', 'compare distances', 'summarize relationship'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: true,
      defaultData: {},
      prompt: `Generate a spatial sandbox for ${topicUnderstanding.topic}.`,
    };
  }

  if (topicUnderstanding.family === 'abstract') {
    return {
      components: ['call stack', 'current frame', 'base case marker', 'return value path', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['push recursive calls', 'hit base case', 'return values', 'unwind stack'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: { expression: 'factorial(4)' },
      prompt: `Generate an abstract process sandbox for ${topicUnderstanding.topic}.`,
    };
  }

  if (topicUnderstanding.family === 'mathematics') {
    return {
      components: ['coordinate plane', 'function points', 'moving highlight', 'slope/value readout', 'step controls'],
      interactions: ['play', 'previous', 'next', 'restart'],
      animationFlow: ['plot the function', 'move along x values', 'highlight y value', 'show slope or turning behavior'],
      outputMode: 'sandbox_simulation',
      requiresSandbox: false,
      defaultData: { equation: 'y = x^2 - 4', points: [-3, -2, -1, 0, 1, 2, 3] },
      prompt: `Generate a math function sandbox for ${topicUnderstanding.topic}.`,
    };
  }

  return {
    components: ['state nodes', 'transition highlights', 'step controls'],
    interactions: ['play', 'previous', 'next', 'restart'],
    animationFlow: ['show initial state', 'highlight transition', 'show result'],
    outputMode: topicUnderstanding.requiresSandbox ? 'sandbox_simulation' : 'declarative',
    requiresSandbox: topicUnderstanding.requiresSandbox,
    defaultData: {},
    prompt: `Generate a safe educational simulation for ${topicUnderstanding.topic}.`,
  };
}

export function detectSandboxSimulationSupport(query, options = {}) {
  const topicUnderstanding = inferTopic(query);
  const plan = planSandboxSimulation(query, topicUnderstanding);
  return {
    success: true,
    supported: topicUnderstanding.supported,
    topic: topicUnderstanding.topic,
    family: topicUnderstanding.family || 'specific',
    domain: topicUnderstanding.domain,
    complexity: topicUnderstanding.complexity,
    simulationType: topicUnderstanding.simulationType,
    confidence: topicUnderstanding.confidence,
    requiresSandbox: topicUnderstanding.requiresSandbox,
    explicit: isExplicitVisualizationRequest(options.explicitQuery || query, options.requestedArtifact),
    reason: topicUnderstanding.reason,
    plan,
  };
}

function bubbleSortStates(input) {
  const values = [...input];
  const steps = [{
    id: 'step-1',
    title: 'Start',
    description: `Start with [${values.join(', ')}].`,
    array: [...values],
    compare: [],
    swapped: false,
    sortedIndices: [],
  }];
  let stepIndex = 2;

  for (let pass = 0; pass < values.length - 1; pass += 1) {
    for (let index = 0; index < values.length - pass - 1; index += 1) {
      const left = values[index];
      const right = values[index + 1];
      const sortedIndices = Array.from({ length: pass }, (_, offset) => values.length - 1 - offset);
      const swapped = left > right;
      steps.push({
        id: `step-${stepIndex}`,
        title: `Compare ${left} and ${right}`,
        description: swapped ? `${left} is greater than ${right}, so swap.` : `${left} and ${right} stay in order.`,
        array: [...values],
        compare: [index, index + 1],
        swapped: false,
        sortedIndices,
      });
      stepIndex += 1;
      if (swapped) {
        [values[index], values[index + 1]] = [values[index + 1], values[index]];
        steps.push({
          id: `step-${stepIndex}`,
          title: `Swap ${left} and ${right}`,
          description: `Array becomes [${values.join(', ')}].`,
          array: [...values],
          compare: [index, index + 1],
          swapped: true,
          sortedIndices,
        });
        stepIndex += 1;
      }
    }
    steps.push({
      id: `step-${stepIndex}`,
      title: `Pass ${pass + 1} complete`,
      description: `${values[values.length - 1 - pass]} is locked in sorted position.`,
      array: [...values],
      compare: [],
      swapped: false,
      sortedIndices: Array.from({ length: pass + 1 }, (_, offset) => values.length - 1 - offset),
    });
    stepIndex += 1;
  }

  steps.push({
    id: `step-${stepIndex}`,
    title: 'Sorted',
    description: `Final sorted array: [${values.join(', ')}].`,
    array: [...values],
    compare: [],
    swapped: false,
    sortedIndices: values.map((_, index) => index),
  });
  return steps;
}

function heapSortStates(input) {
  const values = [...input];
  const steps = [{
    id: 'step-1',
    title: 'Start',
    description: `Start with [${values.join(', ')}].`,
    array: [...values],
    compare: [],
    swapped: false,
    sortedIndices: [],
    heapSize: values.length,
  }];
  let stepIndex = 2;

  function pushStep(title, description, compare = [], swapped = false, heapSize = values.length) {
    steps.push({
      id: `step-${stepIndex}`,
      title,
      description,
      array: [...values],
      compare,
      swapped,
      sortedIndices: Array.from({ length: values.length - heapSize }, (_, offset) => heapSize + offset),
      heapSize,
    });
    stepIndex += 1;
  }

  function heapify(heapSize, rootIndex) {
    let largest = rootIndex;
    const left = 2 * rootIndex + 1;
    const right = 2 * rootIndex + 2;
    const compared = [rootIndex];

    if (left < heapSize) compared.push(left);
    if (right < heapSize) compared.push(right);
    pushStep(
      `Heapify index ${rootIndex}`,
      `Compare parent ${values[rootIndex]} with its children inside the heap boundary.`,
      compared,
      false,
      heapSize,
    );

    if (left < heapSize && values[left] > values[largest]) largest = left;
    if (right < heapSize && values[right] > values[largest]) largest = right;

    if (largest !== rootIndex) {
      const parentValue = values[rootIndex];
      const childValue = values[largest];
      [values[rootIndex], values[largest]] = [values[largest], values[rootIndex]];
      pushStep(
        `Move ${childValue} upward`,
        `${childValue} is larger than ${parentValue}, so swap to restore the max heap.`,
        [rootIndex, largest],
        true,
        heapSize,
      );
      heapify(heapSize, largest);
    }
  }

  for (let index = Math.floor(values.length / 2) - 1; index >= 0; index -= 1) {
    heapify(values.length, index);
  }

  pushStep('Max heap built', `The largest value ${values[0]} is at the root.`, [0], false, values.length);

  for (let end = values.length - 1; end > 0; end -= 1) {
    const root = values[0];
    const boundary = values[end];
    [values[0], values[end]] = [values[end], values[0]];
    pushStep(
      `Lock ${root}`,
      `Swap root ${root} with ${boundary}; ${root} moves into the sorted suffix.`,
      [0, end],
      true,
      end,
    );
    heapify(end, 0);
  }

  steps.push({
    id: `step-${stepIndex}`,
    title: 'Sorted',
    description: `Final sorted array: [${values.join(', ')}].`,
    array: [...values],
    compare: [],
    swapped: false,
    sortedIndices: values.map((_, index) => index),
    heapSize: 0,
  });

  return steps.slice(0, 80);
}

function quickSortStates(input) {
  const values = [...input];
  const steps = [{
    id: 'step-1',
    title: 'Start',
    description: `Start quick sort with [${values.join(', ')}].`,
    array: [...values],
    compare: [],
    swapped: false,
    sortedIndices: [],
  }];
  let stepIndex = 2;
  const sorted = new Set();

  function partition(low, high) {
    if (low > high) return;
    if (low === high) {
      sorted.add(low);
      steps.push({
        id: `step-${stepIndex}`,
        title: `Single item ${values[low]}`,
        description: `${values[low]} is already in its final subarray.`,
        array: [...values],
        compare: [low],
        swapped: false,
        sortedIndices: [...sorted],
      });
      stepIndex += 1;
      return;
    }

    const pivot = values[high];
    let store = low;
    steps.push({
      id: `step-${stepIndex}`,
      title: `Choose pivot ${pivot}`,
      description: `Use ${pivot} as the pivot for positions ${low} to ${high}.`,
      array: [...values],
      compare: [high],
      swapped: false,
      sortedIndices: [...sorted],
    });
    stepIndex += 1;

    for (let index = low; index < high; index += 1) {
      const shouldMove = values[index] <= pivot;
      steps.push({
        id: `step-${stepIndex}`,
        title: `Compare ${values[index]} with pivot ${pivot}`,
        description: shouldMove
          ? `${values[index]} belongs on the left side of the pivot.`
          : `${values[index]} stays on the right side of the pivot.`,
        array: [...values],
        compare: [index, high],
        swapped: false,
        sortedIndices: [...sorted],
      });
      stepIndex += 1;

      if (shouldMove) {
        const left = values[index];
        const right = values[store];
        [values[index], values[store]] = [values[store], values[index]];
        steps.push({
          id: `step-${stepIndex}`,
          title: `Move ${left} left`,
          description: `Swap ${left} with ${right}; array becomes [${values.join(', ')}].`,
          array: [...values],
          compare: [store, index],
          swapped: true,
          sortedIndices: [...sorted],
        });
        stepIndex += 1;
        store += 1;
      }
    }

    [values[store], values[high]] = [values[high], values[store]];
    sorted.add(store);
    steps.push({
      id: `step-${stepIndex}`,
      title: `Place pivot ${pivot}`,
      description: `${pivot} lands at index ${store}; left values are smaller and right values are larger.`,
      array: [...values],
      compare: [store],
      swapped: true,
      sortedIndices: [...sorted],
    });
    stepIndex += 1;

    partition(low, store - 1);
    partition(store + 1, high);
  }

  partition(0, values.length - 1);

  steps.push({
    id: `step-${stepIndex}`,
    title: 'Sorted',
    description: `Final sorted array: [${values.join(', ')}].`,
    array: [...values],
    compare: [],
    swapped: false,
    sortedIndices: values.map((_, index) => index),
  });

  return steps.slice(0, 60);
}

function mergeSortStates(input) {
  function branchLabel(path) {
    const branch = String(path || 'root').replace(/^root/, '');
    if (!branch) return 'whole array';
    return branch
      .split('')
      .map(part => (part === 'L' ? 'left' : 'right'))
      .join(' then ');
  }

  const steps = [{
    id: 'step-1',
    title: 'Start',
    description: `Start with [${input.join(', ')}].`,
    groups: [{ values: input, level: 0, role: 'root' }],
    active: [0],
    result: [],
  }];
  let stepIndex = 2;

  function split(values, level = 0, path = 'root') {
    if (values.length <= 1) {
      steps.push({
        id: `step-${stepIndex}`,
        title: 'Single item',
        description: `[${values.join(', ')}] has one item, so the ${branchLabel(path)} branch is already sorted.`,
        groups: [{ values, level, role: 'leaf', path }],
        active: [path],
        result: [],
      });
      stepIndex += 1;
      return values;
    }

    const middle = Math.floor(values.length / 2);
    const left = values.slice(0, middle);
    const right = values.slice(middle);
    steps.push({
      id: `step-${stepIndex}`,
      title: `Split [${values.join(', ')}]`,
      description: `Break into [${left.join(', ')}] and [${right.join(', ')}].`,
      groups: [
        { values, level, role: 'parent', path },
        { values: left, level: level + 1, role: 'left', path: `${path}L` },
        { values: right, level: level + 1, role: 'right', path: `${path}R` },
      ],
      active: [`${path}L`, `${path}R`],
      result: [],
    });
    stepIndex += 1;

    const sortedLeft = split(left, level + 1, `${path}L`);
    const sortedRight = split(right, level + 1, `${path}R`);
    const merged = [];
    let leftIndex = 0;
    let rightIndex = 0;
    while (leftIndex < sortedLeft.length || rightIndex < sortedRight.length) {
      const leftValue = sortedLeft[leftIndex];
      const rightValue = sortedRight[rightIndex];
      const takeLeft = rightIndex >= sortedRight.length
        || (leftIndex < sortedLeft.length && sortedLeft[leftIndex] <= sortedRight[rightIndex]);

      if (leftIndex < sortedLeft.length && rightIndex < sortedRight.length) {
        steps.push({
          id: `step-${stepIndex}`,
          title: `Compare ${leftValue} and ${rightValue}`,
          description: `${Math.min(leftValue, rightValue)} is smaller, so it moves into the merged branch next.`,
          groups: [
            { values: sortedLeft.slice(), level: level + 1, role: 'left', path: `${path}L` },
            { values: sortedRight.slice(), level: level + 1, role: 'right', path: `${path}R` },
            { values: merged.slice(), level, role: 'merged', path },
          ],
          active: [`${path}L`, `${path}R`, path],
          result: merged.slice(),
          compareValues: [leftValue, rightValue],
        });
        stepIndex += 1;
      }

      if (takeLeft) {
        merged.push(leftValue);
        leftIndex += 1;
      } else {
        merged.push(rightValue);
        rightIndex += 1;
      }

      steps.push({
        id: `step-${stepIndex}`,
        title: path === 'root' ? `Build final [${merged.join(', ')}]` : `Merge into [${merged.join(', ')}]`,
        description: `Merged branch is now [${merged.join(', ')}].`,
        groups: [
          { values: sortedLeft.slice(), level: level + 1, role: 'left', path: `${path}L` },
          { values: sortedRight.slice(), level: level + 1, role: 'right', path: `${path}R` },
          { values: merged.slice(), level, role: 'merged', path },
        ],
        active: [path],
        result: merged.slice(),
      });
      stepIndex += 1;
    }
    return merged;
  }

  const sorted = split(input);
  steps.push({
    id: `step-${stepIndex}`,
    title: 'Sorted',
    description: `Final sorted array: [${sorted.join(', ')}].`,
    groups: [{ values: sorted, level: 0, role: 'final', path: 'root' }],
    active: ['root'],
    result: sorted,
  });
  return steps.slice(0, MAX_STEPS);
}

function binarySearchStates(input, target) {
  const array = [...input].sort((a, b) => a - b);
  const steps = [{
    id: 'step-1',
    title: 'Start',
    description: `Search for ${target} in [${array.join(', ')}].`,
    array,
    target,
    low: 0,
    high: array.length - 1,
    mid: null,
    found: false,
    discarded: [],
  }];
  let low = 0;
  let high = array.length - 1;
  let stepIndex = 2;
  const discarded = new Set();

  while (low <= high && stepIndex < MAX_STEPS) {
    const mid = Math.floor((low + high) / 2);
    const value = array[mid];
    steps.push({
      id: `step-${stepIndex}`,
      title: `Check middle ${value}`,
      description: `Low=${low}, high=${high}, so mid=${mid}. Compare ${target} with ${value}.`,
      array,
      target,
      low,
      high,
      mid,
      found: value === target,
      discarded: [...discarded],
    });
    stepIndex += 1;

    if (value === target) {
      steps.push({
        id: `step-${stepIndex}`,
        title: 'Found',
        description: `${target} is found at index ${mid}.`,
        array,
        target,
        low,
        high,
        mid,
        found: true,
        discarded: [...discarded],
      });
      return steps;
    }

    if (target > value) {
      for (let index = low; index <= mid; index += 1) discarded.add(index);
      low = mid + 1;
      steps.push({
        id: `step-${stepIndex}`,
        title: 'Discard left half',
        description: `${target} is greater than ${value}, so discard indexes up to ${mid}.`,
        array,
        target,
        low,
        high,
        mid,
        found: false,
        discarded: [...discarded],
      });
    } else {
      for (let index = mid; index <= high; index += 1) discarded.add(index);
      high = mid - 1;
      steps.push({
        id: `step-${stepIndex}`,
        title: 'Discard right half',
        description: `${target} is less than ${value}, so discard indexes from ${mid} upward.`,
        array,
        target,
        low,
        high,
        mid,
        found: false,
        discarded: [...discarded],
      });
    }
    stepIndex += 1;
  }

  steps.push({
    id: `step-${stepIndex}`,
    title: 'Not found',
    description: `${target} is not in the array.`,
    array,
    target,
    low,
    high,
    mid: null,
    found: false,
    discarded: array.map((_, index) => index),
  });
  return steps;
}

function roundRobinStates(processes, quantum) {
  const runtime = processes.map(process => ({
    id: process.id,
    burst: process.burst,
    remaining: process.burst,
    completionTime: null,
  }));
  const queue = runtime.map((_, index) => index);
  const timeline = [];
  const steps = [{
    id: 'step-1',
    title: 'Ready queue',
    description: `Start with ${runtime.map(process => `${process.id}=${process.burst}ms`).join(', ')} and quantum ${quantum}ms.`,
    time: 0,
    activeProcessId: null,
    queue: runtime.map(process => process.id),
    timeline: [],
    processes: runtime.map(process => ({ ...process })),
    metrics: [],
  }];
  let time = 0;
  let stepIndex = 2;

  while (queue.length > 0 && stepIndex < MAX_STEPS) {
    const processIndex = queue.shift();
    const process = runtime[processIndex];
    const runFor = Math.min(quantum, process.remaining);
    const start = time;
    time += runFor;
    process.remaining -= runFor;
    const completed = process.remaining === 0;
    if (completed) {
      process.completionTime = time;
    } else {
      queue.push(processIndex);
    }
    timeline.push({ processId: process.id, start, end: time, duration: runFor, completed });
    steps.push({
      id: `step-${stepIndex}`,
      title: `${process.id} runs`,
      description: completed
        ? `${process.id} runs for ${runFor}ms and completes at ${time}ms.`
        : `${process.id} runs for ${runFor}ms and returns to the queue with ${process.remaining}ms left.`,
      time,
      activeProcessId: process.id,
      queue: queue.map(index => runtime[index].id),
      timeline: [...timeline],
      processes: runtime.map(item => ({ ...item })),
      metrics: [],
    });
    stepIndex += 1;
  }

  const metrics = runtime.map(process => {
    const turnaround = process.completionTime || time;
    return {
      id: process.id,
      burst: process.burst,
      turnaround,
      waiting: Math.max(0, turnaround - process.burst),
    };
  });
  steps.push({
    id: `step-${stepIndex}`,
    title: 'Schedule complete',
    description: `All processes complete at ${time}ms.`,
    time,
    activeProcessId: null,
    queue: [],
    timeline,
    processes: runtime.map(item => ({ ...item })),
    metrics,
  });
  return steps;
}

function graphTraversalStates(topic) {
  const mode = topic.includes('Breadth') ? 'queue' : 'stack';
  const order = mode === 'queue' ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'D', 'E', 'C'];
  return order.map((node, index) => ({
    id: `step-${index + 1}`,
    title: index === 0 ? `Start at ${node}` : `Visit ${node}`,
    description: `${mode === 'queue' ? 'BFS uses a queue' : 'DFS uses a stack'}; mark ${node} visited.`,
    nodes: ['A', 'B', 'C', 'D', 'E'].map(id => ({
      id,
      x: { A: 50, B: 25, C: 75, D: 20, E: 45 }[id],
      y: { A: 10, B: 42, C: 42, D: 75, E: 75 }[id],
      visited: order.slice(0, index + 1).includes(id),
      active: id === node,
    })),
    edges: [['A', 'B'], ['A', 'C'], ['B', 'D'], ['B', 'E']],
    frontier: order.slice(index + 1, index + 3),
  }));
}

function flowProcessStates(topic) {
  const isPhoto = topic === 'Photosynthesis';
  const stages = isPhoto
    ? ['Sunlight', 'Chlorophyll', 'Water + CO2', 'Glucose', 'Oxygen']
    : ['Mouth', 'Stomach', 'Small Intestine', 'Bloodstream', 'Energy'];
  return stages.map((stage, index) => ({
    id: `step-${index + 1}`,
    title: stage,
    description: isPhoto
      ? `${stage} is part of converting light energy into stored chemical energy.`
      : `${stage} is part of breaking food into usable nutrients.`,
    stages,
    activeIndex: index,
    token: isPhoto ? 'energy' : 'nutrients',
  }));
}

function physicalSystemStates(topic) {
  if (topic === 'Pendulum') {
    return [-28, -14, 0, 14, 28, 14, 0, -14].map((angle, index) => ({
      id: `step-${index + 1}`,
      title: `Angle ${angle} degrees`,
      description: angle === 0 ? 'Speed is highest near the center.' : 'Potential energy increases near the side of the swing.',
      angle,
      energy: Math.abs(angle) > 20 ? 'high potential' : 'high kinetic',
    }));
  }
  return [100, 80, 55, 25, 0].map((height, index) => ({
    id: `step-${index + 1}`,
    title: `Height ${height}m`,
    description: height > 0 ? 'Gravity accelerates the object downward.' : 'The object reaches the ground.',
    height,
    velocity: Math.round(index * 9.8),
  }));
}

function networkStates(topic) {
  const tcp = topic === 'TCP Handshake';
  const messages = tcp
    ? ['SYN', 'SYN-ACK', 'ACK', 'Data']
    : ['Request', 'Route', 'Process', 'Response'];
  return messages.map((message, index) => ({
    id: `step-${index + 1}`,
    title: message,
    description: tcp
      ? `${message} moves the connection toward an established state.`
      : `${message} moves through the API communication path.`,
    nodes: tcp ? ['Client', 'Server'] : ['Client', 'API Gateway', 'Service', 'Database'],
    message,
    activeIndex: index,
  }));
}

function timelineStates(topic) {
  const events = topic === 'Universe Timeline'
    ? [
      ['Big Bang', 'Space, time, and energy begin expanding.'],
      ['First atoms', 'Hydrogen and helium form as the universe cools.'],
      ['First stars', 'Gravity gathers matter into stars.'],
      ['Galaxies', 'Large structures form over billions of years.'],
      ['Solar System', 'The Sun and planets form.'],
    ]
    : [
      ['Cause', 'A pressure or need starts the historical change.'],
      ['Early event', 'The first major action shifts the situation.'],
      ['Turning point', 'A key decision changes the outcome.'],
      ['Consequence', 'Effects spread to people and systems.'],
    ];
  return events.map(([title, description], index) => ({
    id: `step-${index + 1}`,
    title,
    description,
    events: events.map(([eventTitle], eventIndex) => ({ title: eventTitle, active: eventIndex === index, done: eventIndex < index })),
  }));
}

function structureStates(topic) {
  const components = topic === 'DNA Structure'
    ? [
      ['Sugar-phosphate backbone', 'The outer rails give DNA structure.'],
      ['Base pairs', 'A pairs with T; C pairs with G.'],
      ['Double helix', 'The molecule twists into a stable spiral.'],
      ['Gene segment', 'A sequence can encode biological information.'],
    ]
    : [
      ['Control Unit', 'Coordinates instruction flow.'],
      ['ALU', 'Performs arithmetic and logic.'],
      ['Registers', 'Hold tiny fast pieces of data.'],
      ['Cache', 'Keeps frequent data close to the CPU.'],
    ];
  return components.map(([name, description], index) => ({
    id: `step-${index + 1}`,
    title: name,
    description,
    components: components.map(([componentName, componentDescription], componentIndex) => ({
      name: componentName,
      description: componentDescription,
      active: componentIndex === index,
    })),
  }));
}

function decisionStates() {
  const steps = [
    ['Input', 'Start with a value that must be classified.', 'Start'],
    ['Condition', 'Check whether score is at least 50.', 'score >= 50?'],
    ['Pass branch', 'If true, follow the pass branch.', 'Pass'],
    ['Fail branch', 'If false, follow the fail branch.', 'Fail'],
  ];
  return steps.map(([title, description, active], index) => ({
    id: `step-${index + 1}`,
    title,
    description,
    nodes: ['Start', 'score >= 50?', 'Pass', 'Fail'].map(name => ({ name, active: name === active })),
    edges: [['Start', 'score >= 50?'], ['score >= 50?', 'Pass'], ['score >= 50?', 'Fail']],
  }));
}

function statisticalStates(trials) {
  const counts = { H: 0, T: 0 };
  return trials.map((outcome, index) => {
    counts[outcome] += 1;
    return {
      id: `step-${index + 1}`,
      title: `Trial ${index + 1}: ${outcome}`,
      description: `Record ${outcome}; update the running distribution.`,
      outcome,
      counts: { ...counts },
      total: index + 1,
    };
  });
}

function spatialStates() {
  return [0, 45, 90, 135, 180, 225].map((angle, index) => ({
    id: `step-${index + 1}`,
    title: `Orbital position ${index + 1}`,
    description: 'Planets keep relative distance while changing position around the Sun.',
    bodies: [
      { name: 'Sun', orbit: 0, angle: 0, size: 34 },
      { name: 'Mercury', orbit: 55, angle: angle * 1.7, size: 10 },
      { name: 'Earth', orbit: 95, angle, size: 16 },
      { name: 'Mars', orbit: 130, angle: angle * 0.8, size: 13 },
    ],
  }));
}

function recursionStates() {
  const calls = ['factorial(4)', 'factorial(3)', 'factorial(2)', 'factorial(1)'];
  const steps = calls.map((call, index) => ({
    id: `step-${index + 1}`,
    title: `Call ${call}`,
    description: `${call} is pushed onto the call stack.`,
    stack: calls.slice(0, index + 1),
    phase: 'calling',
  }));
  steps.push({
    id: `step-${steps.length + 1}`,
    title: 'Base case',
    description: 'factorial(1) returns 1.',
    stack: calls,
    phase: 'base',
    returnValue: 1,
  });
  [2, 6, 24].forEach((value, index) => {
    steps.push({
      id: `step-${steps.length + 1}`,
      title: `Return ${value}`,
      description: `Return value moves back to ${calls[calls.length - index - 2] || 'the caller'}.`,
      stack: calls.slice(0, calls.length - index - 1),
      phase: 'returning',
      returnValue: value,
    });
  });
  return steps;
}

function mathFunctionStates() {
  const xs = [-3, -2, -1, 0, 1, 2, 3];
  const points = xs.map(x => ({ x, y: (x * x) - 4 }));
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const slope = index === 0 ? null : ((point.y - previous.y) / (point.x - previous.x));
    return {
      id: `step-${index + 1}`,
      title: `x = ${point.x}`,
      description: slope == null
        ? `Plot the first point (${point.x}, ${point.y}) on y = x^2 - 4.`
        : `Move to (${point.x}, ${point.y}); approximate slope from the previous point is ${slope}.`,
      equation: 'y = x^2 - 4',
      points,
      activeIndex: index,
      slope,
    };
  });
}

function buildSandboxBundle({ title, steps, defaultData, variant }) {
  const stateJson = JSON.stringify({ steps, defaultData, variant }).replace(/</g, '\\u003c');
  const html = `
<main class="sim-shell">
  <header class="sim-header">
    <div class="input-panel">
      <label id="data-label" for="data-input">Data</label>
      <input id="data-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" />
      <input id="target-input" type="number" inputmode="numeric" />
      <span id="input-status" aria-live="polite"></span>
    </div>
    <div class="control-bar" aria-label="Simulation controls">
      <button id="restart" class="secondary" type="button" aria-label="Restart" title="Restart">↻</button>
      <button id="prev" class="secondary" type="button" aria-label="Previous" title="Previous">←</button>
      <button id="play" class="primary" type="button" aria-label="Play" title="Play">▶</button>
      <button id="next" class="secondary" type="button" aria-label="Next" title="Next">→</button>
    </div>
  </header>
  <section id="stage" class="stage" aria-live="polite"></section>
  <aside class="step-panel">
    <div class="step-heading">
      <span id="step-icon" aria-hidden="true">•</span>
      <strong id="step-title"></strong>
    </div>
    <div class="step-copy">
      <p class="label">What happens</p>
      <p id="step-description"></p>
      <p class="label">Key idea</p>
      <p id="step-key"></p>
    </div>
  </aside>
</main>`.trim();

  const css = `
:root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; --bg:#faf7f2; --paper:#ffffff; --muted:#f3eee7; --border:#e7e1d7; --ink:#111111; --soft:#4b5563; --primary:#111111; --accent:#0f766e; --warn:#f59e0b; --danger:#dc2626; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); }
.sim-shell { padding: clamp(10px, 1.4vw, 18px); display: grid; grid-template-rows: auto auto auto; gap: 10px; }
.sim-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 0 48px 0 0; }
h1 { margin: 0; font-size: 24px; line-height: 1.1; }
.subtitle { margin: 5px 0 0; color: var(--soft); font-size: 13px; font-weight: 650; }
.input-panel { display: flex; align-items: center; justify-content: flex-start; gap: 8px; flex-wrap: wrap; min-width: 0; }
.input-panel label { color: var(--soft); font-size: 12px; font-weight: 850; }
.input-panel input { min-height: 36px; border: 1px solid var(--border); border-radius: 8px; background: var(--paper); color: var(--ink); padding: 8px 10px; font: inherit; font-size: 13px; font-weight: 700; outline: none; }
.input-panel input:focus { border-color: var(--ink); box-shadow: 0 0 0 3px #11111114; }
#data-input { width: min(100%, 300px); }
#target-input { width: 92px; display: none; }
#input-status { min-width: 72px; color: var(--soft); font-size: 12px; font-weight: 750; }
button, select { font: inherit; }
button { border: 1px solid var(--border); border-radius: 8px; background: var(--paper); color: var(--ink); width: 38px; min-width: 38px; height: 38px; padding: 0; display: inline-grid; place-items: center; font-size: 18px; line-height: 1; font-weight: 850; cursor: pointer; }
button:hover { border-color: var(--ink); }
.stage { min-height: clamp(300px, 48dvh, 520px); border: 1px solid var(--border); border-radius: 8px; background: var(--paper); padding: clamp(12px, 2vw, 22px); overflow: auto; display: grid; place-items: center; }
.array-row, .group-row { display: flex; align-items: end; justify-content: center; gap: 10px; margin: 12px 0; flex-wrap: wrap; width: 100%; }
.array-row { min-height: 240px; }
.bar-wrap { display: grid; gap: 6px; justify-items: center; opacity: .56; transition: opacity .2s, transform .2s; }
.bar-wrap.active, .bar-wrap.sorted { opacity: 1; }
.bar { width: clamp(44px, 8vw, 68px); min-height: 34px; display: grid; place-items: end center; border-radius: 7px 7px 4px 4px; background: var(--ink); color: white; font-size: 13px; font-weight: 850; padding: 7px; transition: height .25s, background .2s, transform .2s, box-shadow .2s; }
.bar.compare { background: var(--warn); color: var(--ink); transform: translateY(-8px); box-shadow: 0 10px 24px #f59e0b33; }
.bar.sorted { background: var(--accent); }
.bar.swap { background: var(--danger); transform: translateY(-10px); box-shadow: 0 10px 24px #dc262633; }
.cell { min-width: 40px; min-height: 36px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 8px; background: var(--paper); font-weight: 850; }
.cell.mid { background: var(--warn); color: var(--ink); }
.cell.low, .cell.high { border-color: var(--ink); box-shadow: 0 0 0 3px #11111118; }
.cell.discarded { opacity: .35; text-decoration: line-through; }
.cell.found { background: var(--accent); color: white; }
.merge-tree { width: min(100%, 1040px); min-height: clamp(260px, 42dvh, 500px); display: grid; place-items: center; }
.tree-node { position: relative; display: inline-grid; justify-items: center; align-items: start; gap: 10px; min-width: 84px; transition: transform .2s; }
.tree-node.visible { opacity: 1; }
.tree-node.active { transform: translateY(-3px); }
.tree-node.merge-active { transform: translateY(3px); }
.tree-group { display: inline-flex; gap: 6px; align-items: center; align-self: start; border: 1px solid var(--border); border-radius: 8px; background: var(--paper); padding: 8px; box-shadow: 0 8px 20px #1111110d; opacity: .24; transition: opacity .2s, border-color .2s, box-shadow .2s; }
.tree-node.visible > .tree-group { opacity: .62; }
.tree-node.active > .tree-group { opacity: 1; border-color: var(--ink); box-shadow: 0 0 0 4px #11111114, 0 12px 26px #11111112; animation: focusPulse 1.2s ease-in-out infinite; }
.tree-node.merge-active > .tree-group { border-color: var(--accent); box-shadow: 0 0 0 4px #0f766e22, 0 12px 26px #0f766e18; }
.tree-children { display: flex; justify-content: center; gap: clamp(18px, 4vw, 48px); position: relative; padding-top: 26px; }
.tree-children:before { content: ""; position: absolute; top: 8px; left: 18%; right: 18%; border-top: 1px solid var(--border); }
.tree-children > .tree-node:before { content: ""; position: absolute; top: -18px; left: 50%; height: 18px; border-left: 1px solid var(--border); }
.merge-arrow { color: var(--accent); font-size: 20px; font-weight: 900; }
.merge-note { margin: 14px 0 0; color: var(--soft); font-size: 13px; font-weight: 760; text-align: center; }
@keyframes focusPulse { 0%,100% { box-shadow: 0 0 0 4px #11111112, 0 12px 26px #11111110; } 50% { box-shadow: 0 0 0 7px #1111111f, 0 16px 30px #11111118; } }
.group { display: inline-flex; gap: 6px; align-items: center; border: 1px solid var(--border); border-radius: 8px; background: var(--paper); padding: 8px; }
.group.active, .flow-stage.active, .node-card.active { border-color: var(--ink); box-shadow: 0 0 0 4px #11111114; background: var(--muted); animation: focusPulse 1.2s ease-in-out infinite; }
.timeline { display: flex; min-height: 56px; align-items: stretch; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--paper); }
.slice { display: grid; place-items: center; min-width: 50px; background: var(--ink); color: white; border-right: 1px solid #ffffff55; font-weight: 850; }
.queue { display: flex; gap: 10px; flex-wrap: wrap; margin: 14px 0; justify-content: center; }
.process-card { border: 1px solid var(--border); border-radius: 8px; background: var(--paper); padding: 10px; min-width: 96px; opacity: .55; }
.process-card.active { opacity: 1; border-color: var(--warn); box-shadow: 0 0 0 4px #f59e0b33; }
.metrics { display: grid; gap: 8px; margin-top: 14px; }
.metric-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.flow-line { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; min-height: 300px; width: 100%; }
.flow-stage, .node-card { border: 1px solid var(--border); border-radius: 8px; background: var(--paper); padding: 14px; min-width: 120px; text-align: center; font-weight: 850; opacity: .58; }
.flow-stage.active, .node-card.active { opacity: 1; }
.arrow { color: var(--soft); font-weight: 900; }
.canvas { position: relative; min-height: 330px; width: min(100%, 760px); border-radius: 8px; background: linear-gradient(#ffffff, var(--muted)); overflow: hidden; }
.pendulum-arm { position: absolute; left: 50%; top: 34px; width: 3px; height: 190px; background: var(--ink); transform-origin: top center; transition: transform .28s; }
.bob { position: absolute; left: calc(50% - 22px); top: 212px; width: 44px; height: 44px; border-radius: 999px; background: var(--accent); box-shadow: 0 12px 26px #0f766e2e; }
.falling-object { position: absolute; left: 50%; width: 40px; height: 40px; border-radius: 8px; background: var(--accent); transition: top .25s; }
.network-row, .structure-grid, .decision-grid, .stats-grid { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; min-height: 300px; width: 100%; }
.packet { padding: 8px 12px; border-radius: 999px; background: var(--warn); color: var(--ink); font-weight: 900; }
.event-row { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 12px; align-items: start; margin: 12px 0; width: min(100%, 640px); }
.event-dot { width: 18px; height: 18px; border-radius: 999px; background: #d1d5db; margin-top: 3px; }
.event-dot.done { background: var(--accent); }
.event-dot.active { background: var(--ink); box-shadow: 0 0 0 4px #11111118; }
.hist-bar { width: 100px; min-height: 28px; display: grid; place-items: end center; background: var(--ink); color: white; border-radius: 7px 7px 4px 4px; padding: 7px; font-weight: 900; }
.orbit { position: absolute; left: 50%; top: 50%; border: 1px dashed #9ca3af; border-radius: 999px; transform: translate(-50%, -50%); }
.body { position: absolute; display: grid; place-items: center; border-radius: 999px; background: var(--accent); color: white; font-size: 10px; font-weight: 900; transform: translate(-50%, -50%); }
.stack { display: flex; flex-direction: column-reverse; align-items: center; gap: 10px; min-height: 310px; justify-content: center; width: 100%; }
.frame { min-width: 210px; border: 1px solid var(--border); border-radius: 8px; background: var(--paper); padding: 12px; text-align: center; font-weight: 850; }
.return-value { display: inline-block; margin-top: 12px; padding: 8px 12px; border-radius: 999px; background: var(--accent); color: white; font-weight: 900; }
.plot { position: relative; width: min(100%, 680px); height: 320px; margin: 0 auto; border: 1px solid var(--border); border-radius: 8px; background: linear-gradient(#ffffff, var(--muted)); }
.axis-x, .axis-y { position: absolute; background: var(--soft); }
.axis-x { left: 8%; right: 8%; top: 50%; height: 1px; }
.axis-y { top: 8%; bottom: 8%; left: 50%; width: 1px; }
.point { position: absolute; width: 14px; height: 14px; border-radius: 999px; background: var(--ink); transform: translate(-50%, -50%); opacity: .5; }
.point.active { width: 24px; height: 24px; opacity: 1; background: var(--warn); box-shadow: 0 0 0 6px #f59e0b33; }
.readout { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; margin-top: 14px; font-weight: 850; }
.step-panel { border: 1px solid var(--border); border-radius: 8px; background: var(--paper); padding: 12px 14px; display: grid; gap: 8px; }
.step-heading { display: flex; align-items: center; gap: 8px; font-size: 14px; line-height: 1.25; }
#step-icon { width: 20px; height: 20px; border-radius: 999px; display: grid; place-items: center; background: var(--ink); color: white; font-size: 11px; font-weight: 800; flex: 0 0 auto; }
#step-title { font-weight: 700; }
.step-copy { display: grid; grid-template-columns: minmax(82px, auto) 1fr; gap: 5px 10px; align-items: start; }
.step-panel p { margin: 0; color: var(--soft); line-height: 1.4; font-size: 13px; }
.label { color: var(--ink) !important; font-size: 11px; font-weight: 760; }
.control-bar { display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-wrap: wrap; }
.secondary { background: var(--paper); color: var(--soft); }
.primary { width: 46px; min-width: 46px; height: 40px; background: var(--ink); color: white; border-color: var(--ink); font-size: 18px; }
select { border: 1px solid var(--border); border-radius: 8px; background: var(--paper); color: var(--ink); padding: 7px 8px; font-weight: 800; }
@media (max-width: 760px) { .sim-header { grid-template-columns: 1fr; align-items: stretch; padding-right: 44px; } .input-panel { justify-content: stretch; } #data-input { flex: 1 1 160px; width: auto; } .control-bar { justify-content: flex-start; } .stage { min-height: 48dvh; } .tree-children { gap: 12px; } .cell { min-width: 32px; min-height: 32px; } .step-copy { grid-template-columns: 1fr; } }`.trim();

  const js = `
const SIM_STATE = ${stateJson};
let index = 0;
let timer = null;
let speedMs = 900;
const stage = document.querySelector('#stage');
const title = document.querySelector('#step-title');
const description = document.querySelector('#step-description');
const keyIdea = document.querySelector('#step-key');
const icon = document.querySelector('#step-icon');
const play = document.querySelector('#play');
const dataInput = document.querySelector('#data-input');
const targetInput = document.querySelector('#target-input');
const dataLabel = document.querySelector('#data-label');
const inputStatus = document.querySelector('#input-status');
let inputTimer = null;
function cell(value) {
  return '<span class="cell">' + String(value) + '</span>';
}
function currentPhase(step) {
  const text = String(step.title || '').toLowerCase();
  if (text.includes('split')) return 'split';
  if (text.includes('merge') || text.includes('sorted')) return 'merge';
  if (text.includes('compare')) return 'compare';
  if (text.includes('swap')) return 'swap';
  return 'focus';
}
function phaseIcon(phase) {
  return { split: '↓', merge: '↑', compare: '?', swap: '↔', focus: '•' }[phase] || '•';
}
function cleanArrayInput(raw) {
  return String(raw || '')
    .split(/[\\s,]+/)
    .map(item => Number(item.trim()))
    .filter(Number.isFinite)
    .slice(0, 10);
}
function makeBubbleSteps(input) {
  const values = input.slice();
  const steps = [{ id: 'step-1', title: 'Start', description: 'Start with [' + values.join(', ') + '].', array: values.slice(), compare: [], swapped: false, sortedIndices: [] }];
  let stepNumber = 2;
  for (let pass = 0; pass < values.length; pass += 1) {
    for (let itemIndex = 0; itemIndex < values.length - 1 - pass; itemIndex += 1) {
      const left = values[itemIndex];
      const right = values[itemIndex + 1];
      const sortedIndices = Array.from({ length: pass }, (_, offset) => values.length - 1 - offset);
      const shouldSwap = left > right;
      steps.push({ id: 'step-' + stepNumber, title: 'Compare ' + left + ' and ' + right, description: shouldSwap ? left + ' is bigger than ' + right + ', so they swap.' : left + ' is already before ' + right + '.', array: values.slice(), compare: [itemIndex, itemIndex + 1], swapped: false, sortedIndices });
      stepNumber += 1;
      if (shouldSwap) {
        values[itemIndex] = right;
        values[itemIndex + 1] = left;
        steps.push({ id: 'step-' + stepNumber, title: 'Swap ' + left + ' and ' + right, description: 'Array becomes [' + values.join(', ') + '].', array: values.slice(), compare: [itemIndex, itemIndex + 1], swapped: true, sortedIndices });
        stepNumber += 1;
      }
    }
  }
  steps.push({ id: 'step-' + stepNumber, title: 'Sorted', description: 'Final sorted array: [' + values.join(', ') + '].', array: values.slice(), compare: [], swapped: false, sortedIndices: values.map((_, itemIndex) => itemIndex) });
  return steps.slice(0, 80);
}
function makeHeapSteps(input) {
  const values = input.slice();
  const steps = [{ id: 'step-1', title: 'Start', description: 'Start with [' + values.join(', ') + '].', array: values.slice(), compare: [], swapped: false, sortedIndices: [], heapSize: values.length }];
  let stepNumber = 2;
  function sortedSuffix(heapSize) {
    return Array.from({ length: values.length - heapSize }, (_, offset) => heapSize + offset);
  }
  function addStep(title, description, compare, swapped, heapSize) {
    steps.push({ id: 'step-' + stepNumber, title, description, array: values.slice(), compare: compare || [], swapped: !!swapped, sortedIndices: sortedSuffix(heapSize), heapSize });
    stepNumber += 1;
  }
  function heapify(heapSize, rootIndex) {
    if (steps.length > 76) return;
    let largest = rootIndex;
    const left = rootIndex * 2 + 1;
    const right = rootIndex * 2 + 2;
    const compared = [rootIndex];
    if (left < heapSize) compared.push(left);
    if (right < heapSize) compared.push(right);
    addStep('Heapify index ' + rootIndex, 'Compare parent ' + values[rootIndex] + ' with its children inside the heap boundary.', compared, false, heapSize);
    if (left < heapSize && values[left] > values[largest]) largest = left;
    if (right < heapSize && values[right] > values[largest]) largest = right;
    if (largest !== rootIndex) {
      const parentValue = values[rootIndex];
      const childValue = values[largest];
      values[rootIndex] = childValue;
      values[largest] = parentValue;
      addStep('Move ' + childValue + ' upward', childValue + ' is larger than ' + parentValue + ', so swap to restore the max heap.', [rootIndex, largest], true, heapSize);
      heapify(heapSize, largest);
    }
  }
  for (let itemIndex = Math.floor(values.length / 2) - 1; itemIndex >= 0; itemIndex -= 1) heapify(values.length, itemIndex);
  addStep('Max heap built', 'The largest value ' + values[0] + ' is at the root.', [0], false, values.length);
  for (let end = values.length - 1; end > 0; end -= 1) {
    const root = values[0];
    const boundary = values[end];
    values[0] = boundary;
    values[end] = root;
    addStep('Lock ' + root, 'Swap root ' + root + ' with ' + boundary + '; ' + root + ' moves into the sorted suffix.', [0, end], true, end);
    heapify(end, 0);
  }
  steps.push({ id: 'step-' + stepNumber, title: 'Sorted', description: 'Final sorted array: [' + values.join(', ') + '].', array: values.slice(), compare: [], swapped: false, sortedIndices: values.map((_, itemIndex) => itemIndex), heapSize: 0 });
  return steps.slice(0, 80);
}
function makeQuickSteps(input) {
  const values = input.slice();
  const steps = [{ id: 'step-1', title: 'Start', description: 'Start quick sort with [' + values.join(', ') + '].', array: values.slice(), compare: [], swapped: false, sortedIndices: [] }];
  const sorted = new Set();
  let stepNumber = 2;
  function partition(low, high) {
    if (low > high || steps.length > 76) return;
    if (low === high) {
      sorted.add(low);
      steps.push({ id: 'step-' + stepNumber, title: 'Single item ' + values[low], description: values[low] + ' is already in its final subarray.', array: values.slice(), compare: [low], swapped: false, sortedIndices: Array.from(sorted) });
      stepNumber += 1;
      return;
    }
    const pivot = values[high];
    let store = low;
    steps.push({ id: 'step-' + stepNumber, title: 'Choose pivot ' + pivot, description: 'Use ' + pivot + ' as the pivot for positions ' + low + ' to ' + high + '.', array: values.slice(), compare: [high], swapped: false, sortedIndices: Array.from(sorted) });
    stepNumber += 1;
    for (let itemIndex = low; itemIndex < high; itemIndex += 1) {
      const shouldMove = values[itemIndex] <= pivot;
      steps.push({ id: 'step-' + stepNumber, title: 'Compare ' + values[itemIndex] + ' with pivot ' + pivot, description: shouldMove ? values[itemIndex] + ' belongs on the left side of the pivot.' : values[itemIndex] + ' stays on the right side of the pivot.', array: values.slice(), compare: [itemIndex, high], swapped: false, sortedIndices: Array.from(sorted) });
      stepNumber += 1;
      if (shouldMove) {
        const left = values[itemIndex];
        const right = values[store];
        values[itemIndex] = right;
        values[store] = left;
        steps.push({ id: 'step-' + stepNumber, title: 'Move ' + left + ' left', description: 'Array becomes [' + values.join(', ') + '].', array: values.slice(), compare: [store, itemIndex], swapped: true, sortedIndices: Array.from(sorted) });
        stepNumber += 1;
        store += 1;
      }
    }
    const oldStore = values[store];
    values[store] = values[high];
    values[high] = oldStore;
    sorted.add(store);
    steps.push({ id: 'step-' + stepNumber, title: 'Place pivot ' + pivot, description: pivot + ' lands at index ' + store + '.', array: values.slice(), compare: [store], swapped: true, sortedIndices: Array.from(sorted) });
    stepNumber += 1;
    partition(low, store - 1);
    partition(store + 1, high);
  }
  partition(0, values.length - 1);
  steps.push({ id: 'step-' + stepNumber, title: 'Sorted', description: 'Final sorted array: [' + values.join(', ') + '].', array: values.slice(), compare: [], swapped: false, sortedIndices: values.map((_, itemIndex) => itemIndex) });
  return steps.slice(0, 80);
}
function makeMergeSteps(input) {
  const steps = [{ id: 'step-1', title: 'Start', description: 'Start with [' + input.join(', ') + '].', groups: [{ values: input.slice(), level: 0, role: 'root', path: 'root' }], active: ['root'], result: [] }];
  let stepNumber = 2;
  function branchLabel(path) {
    const branch = String(path || 'root').replace(/^root/, '');
    return branch ? branch.split('').map(part => part === 'L' ? 'left' : 'right').join(' then ') : 'whole array';
  }
  function split(values, level, path) {
    if (steps.length > 76) return values.slice().sort((a, b) => a - b);
    if (values.length <= 1) {
      steps.push({ id: 'step-' + stepNumber, title: 'Single item', description: '[' + values.join(', ') + '] has one item, so the ' + branchLabel(path) + ' branch is already sorted.', groups: [{ values: values.slice(), level, role: 'leaf', path }], active: [path], result: [] });
      stepNumber += 1;
      return values.slice();
    }
    const middle = Math.floor(values.length / 2);
    const left = values.slice(0, middle);
    const right = values.slice(middle);
    steps.push({ id: 'step-' + stepNumber, title: 'Split [' + values.join(', ') + ']', description: 'Break into [' + left.join(', ') + '] and [' + right.join(', ') + '].', groups: [{ values: values.slice(), level, role: 'parent', path }, { values: left.slice(), level: level + 1, role: 'left', path: path + 'L' }, { values: right.slice(), level: level + 1, role: 'right', path: path + 'R' }], active: [path + 'L', path + 'R'], result: [] });
    stepNumber += 1;
    const sortedLeft = split(left, level + 1, path + 'L');
    const sortedRight = split(right, level + 1, path + 'R');
    const merged = [];
    let leftIndex = 0;
    let rightIndex = 0;
    while (leftIndex < sortedLeft.length || rightIndex < sortedRight.length) {
      const leftValue = sortedLeft[leftIndex];
      const rightValue = sortedRight[rightIndex];
      const takeLeft = rightIndex >= sortedRight.length || (leftIndex < sortedLeft.length && sortedLeft[leftIndex] <= sortedRight[rightIndex]);
      if (leftIndex < sortedLeft.length && rightIndex < sortedRight.length) {
        steps.push({ id: 'step-' + stepNumber, title: 'Compare ' + leftValue + ' and ' + rightValue, description: Math.min(leftValue, rightValue) + ' is smaller, so it moves into the merged branch next.', groups: [{ values: sortedLeft.slice(), level: level + 1, role: 'left', path: path + 'L' }, { values: sortedRight.slice(), level: level + 1, role: 'right', path: path + 'R' }, { values: merged.slice(), level, role: 'merge', path }], active: [path + 'L', path + 'R', path], result: merged.slice(), compareValues: [leftValue, rightValue] });
        stepNumber += 1;
      }
      if (takeLeft) {
        merged.push(leftValue);
        leftIndex += 1;
      } else {
        merged.push(rightValue);
        rightIndex += 1;
      }
      steps.push({ id: 'step-' + stepNumber, title: 'Merge into [' + merged.join(', ') + ']', description: 'Merged branch is now [' + merged.join(', ') + '].', groups: [{ values: sortedLeft.slice(), level: level + 1, role: 'left', path: path + 'L' }, { values: sortedRight.slice(), level: level + 1, role: 'right', path: path + 'R' }, { values: merged.slice(), level, role: 'merge', path }], active: [path], result: merged.slice() });
      stepNumber += 1;
    }
    return merged;
  }
  const result = split(input.slice(), 0, 'root');
  steps.push({ id: 'step-' + stepNumber, title: 'Sorted', description: 'Final sorted array: [' + result.join(', ') + '].', groups: [{ values: result.slice(), level: 0, role: 'result', path: 'root' }], active: ['root'], result: result.slice() });
  return steps.slice(0, 80);
}
function makeBinarySteps(input, target) {
  const values = input.slice().sort((a, b) => a - b);
  const steps = [{ id: 'step-1', title: 'Start', description: 'Search for ' + target + ' in [' + values.join(', ') + '].', array: values.slice(), low: 0, high: values.length - 1, mid: null, found: false, discarded: [] }];
  let low = 0;
  let high = values.length - 1;
  let stepNumber = 2;
  while (low <= high && steps.length < 40) {
    const mid = Math.floor((low + high) / 2);
    const discarded = values.map((_, itemIndex) => itemIndex).filter(itemIndex => itemIndex < low || itemIndex > high);
    const found = values[mid] === target;
    steps.push({ id: 'step-' + stepNumber, title: 'Check middle ' + values[mid], description: found ? target + ' is at index ' + mid + '.' : target < values[mid] ? 'Target is smaller, discard the right half.' : 'Target is larger, discard the left half.', array: values.slice(), low, high, mid, found, discarded });
    stepNumber += 1;
    if (found) return steps;
    if (target < values[mid]) high = mid - 1;
    else low = mid + 1;
  }
  steps.push({ id: 'step-' + stepNumber, title: 'Not found', description: target + ' is not in the array.', array: values.slice(), low, high, mid: null, found: false, discarded: values.map((_, itemIndex) => itemIndex) });
  return steps;
}
function rebuildFromInput() {
  if (!['bubble', 'merge', 'quick', 'heap', 'binary'].includes(SIM_STATE.variant)) return;
  if (timer) {
    clearInterval(timer);
    timer = null;
    play.textContent = '▶';
    play.setAttribute('aria-label', 'Play');
    play.setAttribute('title', 'Play');
  }
  const values = cleanArrayInput(dataInput.value);
  if (values.length < 2) {
    inputStatus.textContent = 'Enter at least 2 numbers.';
    return;
  }
  SIM_STATE.defaultData.array = values;
  if (SIM_STATE.variant === 'merge') SIM_STATE.steps = makeMergeSteps(values);
  else if (SIM_STATE.variant === 'quick') SIM_STATE.steps = makeQuickSteps(values);
  else if (SIM_STATE.variant === 'heap') SIM_STATE.steps = makeHeapSteps(values);
  else if (SIM_STATE.variant === 'binary') {
    const target = Number(targetInput.value);
    SIM_STATE.defaultData.target = Number.isFinite(target) ? target : values[0];
    SIM_STATE.steps = makeBinarySteps(values, SIM_STATE.defaultData.target);
  } else SIM_STATE.steps = makeBubbleSteps(values);
  inputStatus.textContent = '';
  setIndex(0);
  console.log('simulation_input_applied', { variant: SIM_STATE.variant, values });
}
function setupInputControls() {
  if (!['bubble', 'merge', 'quick', 'heap', 'binary'].includes(SIM_STATE.variant)) {
    dataInput.style.display = 'none';
    dataLabel.textContent = 'Generated simulation';
    inputStatus.textContent = '';
    return;
  }
  dataInput.value = (SIM_STATE.defaultData.array || []).join(', ');
  dataLabel.textContent = SIM_STATE.variant === 'binary' ? 'Sorted data' : 'Array';
  if (SIM_STATE.variant === 'binary') {
    targetInput.style.display = 'inline-block';
    targetInput.value = SIM_STATE.defaultData.target ?? '';
  }
  inputStatus.textContent = '';
  const schedule = () => {
    window.clearTimeout(inputTimer);
    inputTimer = window.setTimeout(rebuildFromInput, 250);
  };
  dataInput.addEventListener('input', schedule);
  targetInput.addEventListener('input', schedule);
}
function keyConcept(step) {
  if (SIM_STATE.variant === 'merge') {
    const phase = currentPhase(step);
    if (phase === 'split') return 'Divide the problem into smaller arrays until each piece is easy to sort.';
    if (phase === 'merge') return 'Merge Sort combines already sorted pieces to build the final sorted array.';
    return 'A one-item array is already sorted, so recursion can start returning upward.';
  }
  if (SIM_STATE.variant === 'heap') return 'A max heap keeps the largest remaining value at the root before locking it into the sorted suffix.';
  if (SIM_STATE.variant === 'physical') return 'The visual state changes because force, position, and energy change over time.';
  if (SIM_STATE.variant === 'math') return 'Each highlighted point connects an input value to the function output.';
  if (SIM_STATE.variant === 'network') return 'Communication is easier to understand when each message is shown in order.';
  if (SIM_STATE.variant === 'statistical') return 'More trials make the running distribution easier to compare.';
  if (SIM_STATE.variant === 'spatial') return 'Position changes are best read against a stable reference frame.';
  if (SIM_STATE.variant === 'graph') return 'The active frontier shows what the traversal can visit next.';
  return 'Watch the highlighted state; it marks the change made by this step.';
}
function renderBubble(step) {
  const max = Math.max(...step.array, 1);
  stage.innerHTML = '<div class="array-row">' + step.array.map((value, itemIndex) => {
    const classes = ['bar'];
    if ((step.compare || []).includes(itemIndex)) classes.push(step.swapped ? 'swap' : 'compare');
    if ((step.sortedIndices || []).includes(itemIndex)) classes.push('sorted');
    const wrapClasses = ['bar-wrap'];
    if ((step.compare || []).includes(itemIndex)) wrapClasses.push('active');
    if ((step.sortedIndices || []).includes(itemIndex)) wrapClasses.push('sorted');
    const height = 32 + Math.round((value / max) * 150);
    return '<div class="' + wrapClasses.join(' ') + '"><div class="' + classes.join(' ') + '" style="height:' + height + 'px">' + value + '</div><small>i=' + itemIndex + '</small></div>';
  }).join('') + '</div>';
}
function renderMerge(step) {
  function buildNode(values, path) {
    const middle = Math.floor(values.length / 2);
    const node = { values, path };
    if (values.length > 1) {
      node.left = buildNode(values.slice(0, middle), path + 'L');
      node.right = buildNode(values.slice(middle), path + 'R');
    }
    return node;
  }
  const visible = new Set(['root']);
  const valuesByPath = new Map();
  for (let stepIndex = 0; stepIndex <= index; stepIndex += 1) {
    (SIM_STATE.steps[stepIndex].groups || []).forEach(group => {
      const path = group.path || 'root';
      visible.add(path);
      if (Array.isArray(group.values)) valuesByPath.set(path, group.values);
    });
  }
  const active = new Set(step.active || []);
  const phase = currentPhase(step);
  function renderNode(node) {
    const isVisible = visible.has(node.path);
    const isActive = active.has(node.path);
    const classes = ['tree-node'];
    if (isVisible) classes.push('visible');
    if (isActive) classes.push('active');
    if (isActive && phase === 'merge') classes.push('merge-active');
    const children = node.left && node.right
      ? '<div class="tree-children">' + renderNode(node.left) + renderNode(node.right) + '</div>'
      : '';
    const marker = isActive && phase === 'merge' ? '<span class="merge-arrow">↑</span>' : '';
    const displayValues = valuesByPath.get(node.path) || node.values;
    return '<div class="' + classes.join(' ') + '">' + marker + '<div class="tree-group">' + displayValues.map(cell).join('') + '</div>' + children + '</div>';
  }
  const source = SIM_STATE.defaultData.array || (step.groups && step.groups[0] && step.groups[0].values) || [];
  const compare = Array.isArray(step.compareValues) ? '<p class="merge-note">Comparing ' + step.compareValues.join(' and ') + '</p>' : '';
  stage.innerHTML = '<div class="merge-tree">' + renderNode(buildNode(source, 'root')) + compare + '</div>';
}
function renderBinary(step) {
  stage.innerHTML = '<p><strong>Target:</strong> ' + SIM_STATE.defaultData.target + '</p><div class="array-row">' + step.array.map((value, itemIndex) => {
    const classes = ['cell'];
    if ((step.discarded || []).includes(itemIndex)) classes.push('discarded');
    if (itemIndex === step.low) classes.push('low');
    if (itemIndex === step.high) classes.push('high');
    if (itemIndex === step.mid) classes.push(step.found ? 'found' : 'mid');
    return '<span class="' + classes.join(' ') + '">' + value + '<small>i=' + itemIndex + '</small></span>';
  }).join('') + '</div><p>low=' + step.low + ' mid=' + (step.mid ?? '-') + ' high=' + step.high + '</p>';
}
function renderRoundRobin(step) {
  const maxEnd = Math.max(...(step.timeline || []).map(item => item.end), 1);
  stage.innerHTML = '<div class="timeline">' + (step.timeline || []).map(slice => {
    const width = Math.max(44, Math.round((slice.duration / maxEnd) * 420));
    return '<div class="slice" style="width:' + width + 'px">' + slice.processId + '<small>' + slice.start + '-' + slice.end + '</small></div>';
  }).join('') + '</div><div class="queue">' + (step.processes || []).map(process => {
    const active = process.id === step.activeProcessId ? ' active' : '';
    return '<div class="process-card' + active + '"><strong>' + process.id + '</strong><br><small>remaining: ' + process.remaining + 'ms</small></div>';
  }).join('') + '</div>' + ((step.metrics || []).length ? '<div class="metrics">' + step.metrics.map(metric => '<div class="metric-row"><strong>' + metric.id + '</strong><span>turnaround ' + metric.turnaround + 'ms</span><span>waiting ' + metric.waiting + 'ms</span></div>').join('') + '</div>' : '');
}
function renderGraph(step) {
  stage.innerHTML = '<div class="canvas">' + (step.nodes || []).map(node => {
    const active = node.active ? ' active' : '';
    const visited = node.visited ? ' found' : '';
    return '<div class="cell' + active + visited + '" style="position:absolute;left:' + node.x + '%;top:' + node.y + '%;transform:translate(-50%,-50%)">' + node.id + '</div>';
  }).join('') + '</div><p><strong>Frontier:</strong> ' + (step.frontier || []).join(', ') + '</p>';
}
function renderFlow(step) {
  stage.innerHTML = '<div class="flow-line">' + (step.stages || []).map((name, itemIndex) => {
    const active = itemIndex === step.activeIndex ? ' active' : '';
    const arrow = itemIndex < step.stages.length - 1 ? '<span class="arrow">→</span>' : '';
    return '<div class="flow-stage' + active + '">' + name + '</div>' + arrow;
  }).join('') + '</div><p><strong>Token:</strong> ' + (step.token || 'flow') + '</p>';
}
function renderPhysical(step) {
  if (typeof step.angle === 'number') {
    stage.innerHTML = '<div class="canvas"><div class="pendulum-arm" style="transform: rotate(' + step.angle + 'deg)"><div class="bob"></div></div></div><p><strong>Energy:</strong> ' + step.energy + '</p>';
  } else {
    const top = Math.max(15, Math.min(210, 230 - Number(step.height || 0) * 2));
    stage.innerHTML = '<div class="canvas"><div class="falling-object" style="top:' + top + 'px"></div></div><p><strong>Velocity:</strong> ' + step.velocity + ' m/s</p>';
  }
}
function renderNetwork(step) {
  stage.innerHTML = '<div class="network-row">' + (step.nodes || []).map((node, itemIndex) => {
    const active = itemIndex === step.activeIndex || itemIndex === step.activeIndex + 1 ? ' active' : '';
    const packet = itemIndex === step.activeIndex ? '<span class="packet">' + step.message + '</span>' : '';
    const arrow = itemIndex < step.nodes.length - 1 ? '<span class="arrow">→</span>' : '';
    return '<div class="node-card' + active + '">' + node + '<br>' + packet + '</div>' + arrow;
  }).join('') + '</div>';
}
function renderTimeline(step) {
  stage.innerHTML = (step.events || []).map(event => {
    const dot = event.active ? ' active' : event.done ? ' done' : '';
    return '<div class="event-row"><span class="event-dot' + dot + '"></span><div><strong>' + event.title + '</strong></div></div>';
  }).join('');
}
function renderStructure(step) {
  stage.innerHTML = '<div class="structure-grid">' + (step.components || []).map(component => {
    const active = component.active ? ' active' : '';
    return '<div class="node-card' + active + '"><strong>' + component.name + '</strong><br><small>' + component.description + '</small></div>';
  }).join('') + '</div>';
}
function renderDecision(step) {
  stage.innerHTML = '<div class="decision-grid">' + (step.nodes || []).map(node => {
    const active = node.active ? ' active' : '';
    return '<div class="node-card' + active + '">' + node.name + '</div>';
  }).join('<span class="arrow">→</span>') + '</div>';
}
function renderStatistical(step) {
  const max = Math.max(step.counts.H, step.counts.T, 1);
  stage.innerHTML = '<p><strong>Outcome:</strong> ' + step.outcome + ' after ' + step.total + ' trials</p><div class="stats-grid">' + ['H', 'T'].map(key => {
    const height = 30 + Math.round((step.counts[key] / max) * 150);
    return '<div class="bar-wrap"><div class="hist-bar" style="height:' + height + 'px">' + step.counts[key] + '</div><strong>' + key + '</strong></div>';
  }).join('') + '</div>';
}
function renderSpatial(step) {
  stage.innerHTML = '<div class="canvas">' + (step.bodies || []).map(body => {
    if (!body.orbit) {
      return '<div class="body" style="left:50%;top:50%;width:' + body.size + 'px;height:' + body.size + 'px;background:#f59e0b">' + body.name + '</div>';
    }
    const radians = (Number(body.angle || 0) * Math.PI) / 180;
    const x = 50 + Math.cos(radians) * (body.orbit / 3);
    const y = 50 + Math.sin(radians) * (body.orbit / 3);
    return '<div class="orbit" style="width:' + (body.orbit * 2) + 'px;height:' + (body.orbit * 2) + 'px"></div><div class="body" style="left:' + x + '%;top:' + y + '%;width:' + body.size + 'px;height:' + body.size + 'px">' + body.name + '</div>';
  }).join('') + '</div>';
}
function renderRecursion(step) {
  stage.innerHTML = '<div class="stack">' + (step.stack || []).map(frame => '<div class="frame">' + frame + '</div>').join('') + '</div>' + (step.returnValue ? '<span class="return-value">return ' + step.returnValue + '</span>' : '');
}
function renderMath(step) {
  const points = step.points || [];
  const minX = Math.min(...points.map(point => point.x), -3);
  const maxX = Math.max(...points.map(point => point.x), 3);
  const minY = Math.min(...points.map(point => point.y), -4);
  const maxY = Math.max(...points.map(point => point.y), 5);
  const pointHtml = points.map((point, itemIndex) => {
    const left = 8 + ((point.x - minX) / Math.max(maxX - minX, 1)) * 84;
    const top = 92 - ((point.y - minY) / Math.max(maxY - minY, 1)) * 84;
    const active = itemIndex === step.activeIndex ? ' active' : '';
    return '<span class="point' + active + '" style="left:' + left + '%;top:' + top + '%" title="(' + point.x + ',' + point.y + ')"></span>';
  }).join('');
  const activePoint = points[step.activeIndex] || points[0] || { x: 0, y: 0 };
  stage.innerHTML = '<div class="plot"><span class="axis-x"></span><span class="axis-y"></span>' + pointHtml + '</div><div class="readout"><span>' + step.equation + '</span><span>point (' + activePoint.x + ', ' + activePoint.y + ')</span><span>slope ' + (step.slope ?? '-') + '</span></div>';
}
function render() {
  const step = SIM_STATE.steps[index];
  const phase = currentPhase(step);
  title.textContent = step.title || 'Step';
  description.textContent = step.description || '';
  keyIdea.textContent = keyConcept(step);
  icon.textContent = phaseIcon(phase);
  if (SIM_STATE.variant === 'merge') renderMerge(step);
  else if (SIM_STATE.variant === 'binary') renderBinary(step);
  else if (SIM_STATE.variant === 'roundRobin') renderRoundRobin(step);
  else if (SIM_STATE.variant === 'graph') renderGraph(step);
  else if (SIM_STATE.variant === 'flow') renderFlow(step);
  else if (SIM_STATE.variant === 'physical') renderPhysical(step);
  else if (SIM_STATE.variant === 'network') renderNetwork(step);
  else if (SIM_STATE.variant === 'timeline') renderTimeline(step);
  else if (SIM_STATE.variant === 'structure') renderStructure(step);
  else if (SIM_STATE.variant === 'decision') renderDecision(step);
  else if (SIM_STATE.variant === 'statistical') renderStatistical(step);
  else if (SIM_STATE.variant === 'spatial') renderSpatial(step);
  else if (SIM_STATE.variant === 'recursion') renderRecursion(step);
  else if (SIM_STATE.variant === 'math') renderMath(step);
  else renderBubble(step);
  console.log('simulation_step', { index, title: step.title });
}
function setIndex(next) {
  index = Math.max(0, Math.min(SIM_STATE.steps.length - 1, next));
  render();
}
document.querySelector('#restart').addEventListener('click', () => setIndex(0));
document.querySelector('#prev').addEventListener('click', () => setIndex(index - 1));
document.querySelector('#next').addEventListener('click', () => setIndex(index + 1));
play.addEventListener('click', () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    play.textContent = '▶';
    play.setAttribute('aria-label', 'Play');
    play.setAttribute('title', 'Play');
    return;
  }
  play.textContent = '⏸';
  play.setAttribute('aria-label', 'Pause');
  play.setAttribute('title', 'Pause');
  timer = setInterval(() => {
    if (index >= SIM_STATE.steps.length - 1) {
      clearInterval(timer);
      timer = null;
      play.textContent = '▶';
      play.setAttribute('aria-label', 'Play');
      play.setAttribute('title', 'Play');
      return;
    }
    setIndex(index + 1);
  }, speedMs);
});
setupInputControls();
render();`.trim();

  return {
    type: 'sandbox_simulation',
    version: SANDBOX_VERSION,
    title,
    html,
    css,
    js,
    defaultData,
    steps,
    metadata: {
      requiresSandbox: true,
      generatedBy: 'sandbox-engine-fallback',
      variant,
    },
  };
}

function buildFallbackBundle(topicUnderstanding, plan) {
  if (topicUnderstanding.topic === 'Merge Sort') {
    const array = plan.defaultData?.array || [8, 3, 5, 1, 7, 2];
    return buildSandboxBundle({
      title: 'Merge Sort',
      steps: mergeSortStates(array),
      defaultData: { array },
      variant: 'merge',
    });
  }

  if (topicUnderstanding.topic === 'Binary Search') {
    const array = plan.defaultData?.array || [1, 3, 5, 7, 9, 11, 13];
    const target = Number.isFinite(Number(plan.defaultData?.target)) ? Number(plan.defaultData.target) : 9;
    return buildSandboxBundle({
      title: 'Binary Search',
      steps: binarySearchStates(array, target),
      defaultData: { array, target },
      variant: 'binary',
    });
  }

  if (topicUnderstanding.topic === 'Heap Sort') {
    const array = plan.defaultData?.array || [4, 10, 3, 5, 1, 8];
    return buildSandboxBundle({
      title: 'Heap Sort',
      steps: heapSortStates(array),
      defaultData: { array },
      variant: 'heap',
    });
  }

  if (topicUnderstanding.topic === 'Quick Sort') {
    const array = plan.defaultData?.array || [8, 3, 5, 1, 7, 2];
    return buildSandboxBundle({
      title: 'Quick Sort',
      steps: quickSortStates(array),
      defaultData: { array },
      variant: 'quick',
    });
  }

  if (topicUnderstanding.topic === 'CPU Scheduling') {
    const processes = Array.isArray(plan.defaultData?.processes) && plan.defaultData.processes.length > 0
      ? plan.defaultData.processes
      : [{ id: 'P1', burst: 5 }, { id: 'P2', burst: 3 }, { id: 'P3', burst: 7 }];
    const quantum = Math.max(1, Math.round(Number(plan.defaultData?.quantum) || 2));
    return buildSandboxBundle({
      title: 'Round Robin CPU Scheduling',
      steps: roundRobinStates(processes, quantum),
      defaultData: { processes, quantum },
      variant: 'roundRobin',
    });
  }

  if (topicUnderstanding.family === 'algorithm') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: graphTraversalStates(topicUnderstanding.topic),
      defaultData: { graph: 'sample-tree' },
      variant: 'graph',
    });
  }

  if (topicUnderstanding.family === 'flow_process') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: flowProcessStates(topicUnderstanding.topic),
      defaultData: {},
      variant: 'flow',
    });
  }

  if (topicUnderstanding.family === 'physical_system') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: physicalSystemStates(topicUnderstanding.topic),
      defaultData: plan.defaultData || {},
      variant: 'physical',
    });
  }

  if (topicUnderstanding.family === 'network') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: networkStates(topicUnderstanding.topic),
      defaultData: {},
      variant: 'network',
    });
  }

  if (topicUnderstanding.family === 'timeline') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: timelineStates(topicUnderstanding.topic),
      defaultData: {},
      variant: 'timeline',
    });
  }

  if (topicUnderstanding.family === 'structure') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: structureStates(topicUnderstanding.topic),
      defaultData: {},
      variant: 'structure',
    });
  }

  if (topicUnderstanding.family === 'decision_process') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: decisionStates(),
      defaultData: {},
      variant: 'decision',
    });
  }

  if (topicUnderstanding.family === 'statistical') {
    const trials = Array.isArray(plan.defaultData?.trials) ? plan.defaultData.trials : ['H', 'T', 'H', 'H', 'T'];
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: statisticalStates(trials),
      defaultData: { trials },
      variant: 'statistical',
    });
  }

  if (topicUnderstanding.family === 'spatial') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: spatialStates(),
      defaultData: {},
      variant: 'spatial',
    });
  }

  if (topicUnderstanding.family === 'abstract') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: recursionStates(),
      defaultData: plan.defaultData || { expression: 'factorial(4)' },
      variant: 'recursion',
    });
  }

  if (topicUnderstanding.family === 'mathematics') {
    return buildSandboxBundle({
      title: topicUnderstanding.topic,
      steps: mathFunctionStates(),
      defaultData: plan.defaultData || { equation: 'y = x^2 - 4' },
      variant: 'math',
    });
  }

  if (topicUnderstanding.topic === 'Bubble Sort') {
    const array = plan.defaultData?.array || [5, 2, 4, 1];
    return buildSandboxBundle({
      title: 'Bubble Sort',
      steps: bubbleSortStates(array),
      defaultData: { array },
      variant: 'bubble',
    });
  }

  return null;
}

function genericProcessStates(topic, plan = {}) {
  const components = Array.isArray(plan.components) && plan.components.length
    ? plan.components
    : ['Idea', 'Process', 'Result'];
  const flow = Array.isArray(plan.animationFlow) && plan.animationFlow.length
    ? plan.animationFlow
    : ['show the starting state', 'highlight the main transition', 'show the final state'];

  return flow.slice(0, 8).map((item, index) => ({
    id: `step-${index + 1}`,
    title: index === 0 ? 'Start' : index === flow.length - 1 ? 'Result' : `Stage ${index + 1}`,
    description: `${safeText(topic, 'This topic', 80)}: ${safeText(item, 'show the next state', 160)}.`,
    stages: components,
    activeIndex: Math.min(index, components.length - 1),
    token: safeText(topic, 'simulation', 80),
  }));
}

function buildGenericFallbackBundle(topicUnderstanding, plan) {
  const title = safeText(topicUnderstanding?.topic || 'Simulation', 'Simulation', 100);
  return buildSandboxBundle({
    title,
    steps: genericProcessStates(title, plan),
    defaultData: plan?.defaultData || {},
    variant: 'flow',
  });
}

function normalizeSandboxBundle(raw, fallbackTitle = 'Simulation') {
  return {
    type: 'sandbox_simulation',
    version: safeText(raw?.version, SANDBOX_VERSION, 12),
    title: safeText(raw?.title, fallbackTitle, 100),
    html: String(raw?.html || '').slice(0, MAX_FIELD_LENGTH),
    css: String(raw?.css || '').slice(0, MAX_FIELD_LENGTH),
    js: String(raw?.js || '').slice(0, MAX_FIELD_LENGTH),
    defaultData: raw?.defaultData && typeof raw.defaultData === 'object' ? raw.defaultData : {},
    steps: Array.isArray(raw?.steps) ? raw.steps.slice(0, MAX_STEPS) : [],
    metadata: raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
  };
}

function sortedNumbers(values = []) {
  return [...values].sort((a, b) => a - b);
}

function sameMultiset(left = [], right = []) {
  const sortedLeft = sortedNumbers(left).join(',');
  const sortedRight = sortedNumbers(right).join(',');
  return sortedLeft === sortedRight;
}

function isSortedAscending(values = []) {
  return values.every((value, index) => index === 0 || values[index - 1] <= value);
}

function validateAlgorithmFacts(bundle) {
  const errors = [];
  const title = String(bundle.title || '').toLowerCase();
  const variant = String(bundle.metadata?.variant || '').toLowerCase();
  const input = Array.isArray(bundle.defaultData?.array)
    ? bundle.defaultData.array.map(Number).filter(Number.isFinite)
    : [];
  const steps = Array.isArray(bundle.steps) ? bundle.steps : [];
  const finalStep = steps[steps.length - 1] || {};
  const finalArray = Array.isArray(finalStep.array)
    ? finalStep.array.map(Number).filter(Number.isFinite)
    : Array.isArray(finalStep.result)
      ? finalStep.result.map(Number).filter(Number.isFinite)
      : [];

  const isBubble = variant === 'bubble' || title.includes('bubble');
  const isMerge = variant === 'merge' || title.includes('merge sort');
  const isBinary = variant === 'binary' || title.includes('binary search');
  const isHeap = variant === 'heap' || title.includes('heap sort');
  if (!isBubble && !isMerge && !isBinary && !isHeap) return errors;

  if (input.length < 2) errors.push('missing_algorithm_input_array');
  if (finalArray.length < 2) errors.push('missing_final_algorithm_array');
  if (input.length >= 2 && finalArray.length >= 2 && !sameMultiset(input, finalArray)) {
    errors.push('final_array_does_not_preserve_input_values');
  }
  if (finalArray.length >= 2 && !isSortedAscending(finalArray)) {
    errors.push('final_array_not_sorted');
  }

  if (isBubble) {
    const invalidCompare = steps.some(step => (
      Array.isArray(step.compare)
      && step.compare.length === 2
      && Math.abs(Number(step.compare[0]) - Number(step.compare[1])) !== 1
    ));
    if (invalidCompare) errors.push('bubble_compare_not_adjacent');
  }

  if (isBinary) {
    const foundStep = steps.find(step => step?.found === true);
    const target = Number(bundle.defaultData?.target);
    if (!Number.isFinite(target)) errors.push('missing_binary_search_target');
    if (foundStep && Array.isArray(foundStep.array) && Number.isFinite(foundStep.mid)) {
      if (Number(foundStep.array[foundStep.mid]) !== target) errors.push('binary_found_step_wrong_target');
    }
  }

  return errors;
}

export function validateSandboxBundle(bundle) {
  const normalized = normalizeSandboxBundle(bundle);
  const errors = [];
  const warnings = [];

  if (bundle?.type !== 'sandbox_simulation') errors.push('invalid_type');
  if (!normalized.title) errors.push('missing_title');
  if (!normalized.html) errors.push('missing_html');
  if (!normalized.css) warnings.push('missing_css');
  if (!normalized.js) warnings.push('missing_js');
  if (normalized.steps.length === 0) errors.push('missing_steps');
  if (normalized.steps.length > MAX_STEPS) errors.push('too_many_steps');

  const bundleBytes = Buffer.byteLength(JSON.stringify(normalized), 'utf8');
  if (bundleBytes > MAX_BUNDLE_BYTES) errors.push('bundle_too_large');

  for (const { code, pattern } of BLOCKED_HTML_PATTERNS) {
    if (pattern.test(normalized.html)) errors.push(code);
  }
  for (const { code, pattern } of BLOCKED_CSS_PATTERNS) {
    if (pattern.test(normalized.css)) errors.push(code);
  }
  for (const { code, pattern } of BLOCKED_JS_PATTERNS) {
    if (pattern.test(normalized.js)) errors.push(code);
  }

  const stepErrors = normalized.steps
    .map((step, index) => (!step?.id || !step?.title ? `invalid_step_${index + 1}` : null))
    .filter(Boolean);
  errors.push(...stepErrors);
  errors.push(...validateAlgorithmFacts(normalized));

  return {
    valid: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
    bundle: normalized,
    limits: {
      maxBundleBytes: MAX_BUNDLE_BYTES,
      maxSteps: MAX_STEPS,
      bundleBytes,
    },
  };
}

export function createSandboxSrcDoc(bundle) {
  const normalized = normalizeSandboxBundle(bundle);
  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "font-src 'none'",
    "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');

  const bridge = `
(() => {
  const send = (type, payload) => {
    try { window.parent.postMessage({ source: 'visualearn-sandbox', type, payload }, '*'); } catch {}
  };
  const original = { log: console.log, warn: console.warn, error: console.error };
  for (const level of Object.keys(original)) {
    console[level] = (...args) => {
      send('console', { level, args: args.map(arg => {
        try { return typeof arg === 'object' ? JSON.stringify(arg) : String(arg); } catch { return String(arg); }
      }) });
      original[level](...args);
    };
  }
  window.addEventListener('error', event => send('runtime_error', { message: event.message, lineno: event.lineno, colno: event.colno }));
  window.addEventListener('unhandledrejection', event => send('runtime_error', { message: String(event.reason || 'Unhandled rejection') }));
})();`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <style>${normalized.css}</style>
</head>
<body>
${normalized.html}
<script>${bridge}</script>
<script>${normalized.js}</script>
</body>
</html>`;
}

async function generateWithLlm(query, topicUnderstanding, plan) {
  const { createTextCompletion } = await import('../services/openai/azure-client.js');
  const text = await createTextCompletion({
    system: GENERATION_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: JSON.stringify({
        query,
        topicUnderstanding,
        plan,
        contract: 'Return only JSON for sandbox_simulation. No markdown.',
      }),
    }],
    maxTokens: 3200,
    temperature: 0.25,
  });
  return parseJsonObject(text);
}

export async function generateSandboxSimulation(query, options = {}) {
  const trace = [];
  const startedAt = performance.now();
  const normalizedQuery = normalizeQuery(query);
  tracePush(trace, 'simulationRequested', startedAt, {
    input: { query: normalizedQuery, options: { useLlm: options.useLlm !== false } },
  });

  const topicStart = performance.now();
  const topicUnderstanding = inferTopic(normalizedQuery);
  tracePush(trace, 'topicUnderstanding', topicStart, { output: topicUnderstanding });

  const planStart = performance.now();
  const plan = planSandboxSimulation(normalizedQuery, topicUnderstanding);
  tracePush(trace, 'planning', planStart, { output: plan });

  if (!topicUnderstanding.supported) {
    return {
      success: true,
      simulationId: randomUUID(),
      supported: false,
      topicUnderstanding,
      plan,
      generated: null,
      validation: { valid: false, errors: ['unsupported_topic'], warnings: [] },
      final: null,
      trace,
      durationMs: nowMs(startedAt),
    };
  }

  let generated = null;
  let generationSource = 'llm';
  const generationStart = performance.now();
  if (options.useLlm !== false) {
    try {
      generated = await generateWithLlm(normalizedQuery, topicUnderstanding, plan);
    } catch (error) {
      generationSource = 'fallback';
      tracePush(trace, 'generation', generationStart, {
        success: false,
        error: error.message,
        source: 'llm',
      });
    }
  } else {
    generationSource = 'fallback';
  }

  if (!generated || generated.type !== 'sandbox_simulation') {
    generated = buildFallbackBundle(topicUnderstanding, plan) || buildGenericFallbackBundle(topicUnderstanding, plan);
    generationSource = 'fallback';
  }

  if (!trace.some(entry => entry.stage === 'generation')) {
    tracePush(trace, 'generation', generationStart, {
      source: generationSource,
      outputType: generated?.type || 'none',
      title: generated?.title || null,
    });
  }

  const validationStart = performance.now();
  let validation = validateSandboxBundle(generated);
  if (!validation.valid && generationSource === 'llm') {
    tracePush(trace, 'validation', validationStart, {
      success: false,
      errors: validation.errors,
      recovery: 'fallback_bundle',
    });
    generated = buildFallbackBundle(topicUnderstanding, plan) || buildGenericFallbackBundle(topicUnderstanding, plan);
    validation = validateSandboxBundle(generated);
  }

  if (!trace.some(entry => entry.stage === 'validation' && entry.recovery === 'fallback_bundle')) {
    tracePush(trace, 'validation', validationStart, {
      success: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  } else {
    tracePush(trace, 'validationRecovery', validationStart, {
      success: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  }

  const finalBundle = validation.valid ? validation.bundle : null;
  const final = finalBundle
    ? {
      ...finalBundle,
      sandbox: {
        iframeSandbox: 'allow-scripts',
        csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'",
        srcDoc: createSandboxSrcDoc(finalBundle),
      },
    }
    : null;

  return {
    success: validation.valid,
    simulationId: randomUUID(),
    supported: topicUnderstanding.supported,
    topicUnderstanding,
    plan,
    generated,
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      limits: validation.limits,
    },
    final,
    trace,
    durationMs: nowMs(startedAt),
  };
}

export default {
  generateSandboxSimulation,
  planSandboxSimulation,
  validateSandboxBundle,
  createSandboxSrcDoc,
};
