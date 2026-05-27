const GENERIC_RESPONSE_PATTERNS = [
  /^\s*(?:oh yeah|no worries|of course|sure|absolutely|happy to help|glad to help)[,!.:\s-]*/i,
  /^\s*(?:i can help you with|i'll help you with|let's learn about|let's dive into)[^.\n]*[.\n]*/i,
  /(?:\n|\s)*(?:if you want|would you like|i can also help|i can also explain|i can help with|happy to help|glad to help|let me know|want me to|do you want me to)[\s\S]*$/i,
];

const PROCESS_PATTERNS = [
  /\b(bubble|quick|merge|insertion|selection|heap)\s+sort\b/i,
  /\b(binary search|linear search|graph traversal|dns|photosynthesis|recursion)\b/i,
  /\b(how does|how do|process|algorithm|cycle|workflow|step by step)\b/i,
];

const SIMPLE_DEFINITION_PATTERN = /\b(what is|define|definition of)\b/i;
const SIMULATION_SPEC_MARKERS = [
  /"spec_type"\s*:\s*"(algorithm|cpuScheduling|network|math|system|scientific|process|machineLearning|biology|chemistry|physics|database|softwareEngineering|economics|concept)"/i,
  /"defaultData"\s*:/i,
  /"customInputs"\s*:/i,
  /"visualization"\s*:/i,
  /"rendererOwnsExecution"\s*:/i,
];

function cleanText(value, fallback = '') {
  return String(value ?? fallback).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
}

export function stripGenericChatEnding(text = '') {
  let output = stripVisibleToolLeak(text);
  output = stripVisibleSimulationSpec(output);
  for (const pattern of GENERIC_RESPONSE_PATTERNS) {
    output = output.replace(pattern, '');
  }
  return output.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const sanitizeAssistantResponse = stripGenericChatEnding;

function stripCodeFence(value = '') {
  return String(value)
    .replace(/^\s*```(?:json|js|javascript)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function stripVisibleToolLeak(value = '') {
  const output = String(value || '');
  const hasWidgetLeak = /to=show_widget/i.test(output);
  const hasVisualSpec = /"spec_type"\s*:/.test(output) && /"objects"\s*:/.test(output);

  if (hasWidgetLeak && hasVisualSpec) {
    const leakStart = output.search(/to=show_widget/i);
    const prefix = leakStart > 0 ? output.slice(0, leakStart).trim() : '';
    return prefix.length > 0 && prefix.length < 220 ? prefix : '';
  }

  if (hasVisualSpec && /^\s*[\[{]/.test(output.trim())) {
    return '';
  }

  return output;
}

function isSimulationSpecLike(value = '') {
  const text = stripCodeFence(value);
  if (!text) return false;
  const markerCount = SIMULATION_SPEC_MARKERS.reduce(
    (count, pattern) => count + (pattern.test(text) ? 1 : 0),
    0,
  );
  if (markerCount >= 2) return true;

  try {
    const parsed = JSON.parse(text);
    const spec = parsed?.type === 'simulation' && parsed?.spec ? parsed.spec : parsed;
    return Boolean(
      spec
      && typeof spec === 'object'
      && spec.spec_type
      && (spec.defaultData || spec.customInputs || spec.visualization),
    );
  } catch {
    return false;
  }
}

function stripVisibleSimulationSpec(text = '') {
  const value = String(text || '');
  const trimmed = value.trim();
  if (!trimmed) return value;

  if (/^(?:```(?:json|js|javascript)?\s*)?[\[{]/i.test(trimmed)) {
    return isSimulationSpecLike(trimmed) || /"type"\s*:\s*"simulation"|"?spec_type"?\s*:/i.test(trimmed)
      ? ''
      : '';
  }

  if (isSimulationSpecLike(trimmed)) {
    return '';
  }

  return value.replace(/```(?:json|js|javascript)?\s*[\s\S]*?"spec_type"\s*:\s*"(?:algorithm|cpuScheduling|network|math|system|scientific|process|machineLearning|biology|chemistry|physics|database|softwareEngineering|economics|concept)"[\s\S]*?```/gi, '');
}

function isProcessLike(query = '', decision = {}) {
  const target = `${query} ${decision.activeTopic || ''}`;
  return Boolean(decision.simulation?.needed || PROCESS_PATTERNS.some(pattern => pattern.test(target)));
}

function isSimpleDefinition(query = '', decision = {}) {
  return SIMPLE_DEFINITION_PATTERN.test(query) && !isProcessLike(query, decision);
}

function buildBubbleSortExplanation() {
  return {
    title: 'Bubble Sort',
    summary: 'Imagine four students standing by height: 5, 2, 4, 1. Bubble sort keeps comparing neighbors and swapping them until the largest values drift to the end.',
    concepts: [
      {
        title: 'Neighbor Check',
        description: 'The value on the left compares itself with the value beside it.',
      },
      {
        title: 'Swap',
        description: 'If the left value is bigger, the two values trade places.',
      },
      {
        title: 'One Round',
        description: 'After one full pass, the largest value has moved to the end.',
      },
    ],
    examples: [
      {
        title: 'Round 1',
        description: '5 looks at 2 and swaps: 2 5 4 1. Then 5 looks at 4 and swaps again: 2 4 5 1.',
        real_world_context: 'The tallest student keeps moving right until they reach the end of the line.',
      },
    ],
    keyTakeaways: [
      'Bubble sort compares neighboring values.',
      'Large values drift toward the end like bubbles rising in water.',
      'Each round reduces the unsorted part of the list.',
    ],
    interactiveBlocks: [
      {
        type: 'hook',
        title: 'Story',
        items: [
          { title: 'Height line', body: 'Imagine students standing by height: 5, 2, 4, 1.' },
        ],
      },
      {
        type: 'steps',
        title: 'Round 1',
        items: [
          { title: '5 meets 2', body: '5 asks: Am I taller? Yes. Swap places: 2 5 4 1.' },
          { title: '5 meets 4', body: '5 is still taller. Swap again: 2 4 5 1.' },
          { title: '5 moves right', body: 'The biggest value slowly reaches the end of the list.' },
        ],
      },
      {
        type: 'emphasis',
        title: 'Key Idea',
        items: [
          { title: 'Bubble motion', body: 'Big values keep drifting toward the end like bubbles rising in water.' },
        ],
      },
    ],
  };
}

function buildProcessExplanation(query, decision) {
  const topic = cleanText(decision.activeTopic || query, 'this process');
  if (/bubble\s+sort/i.test(topic)) return buildBubbleSortExplanation();

  return {
    title: topic,
    summary: `${topic} is easiest to understand as a sequence of small changes rather than one static definition.`,
    concepts: [
      { title: 'Starting State', description: `Identify what ${topic} begins with.` },
      { title: 'Repeated Rule', description: 'Apply the same core rule step by step.' },
      { title: 'Result', description: 'Watch how each step changes the state until the process finishes.' },
    ],
    examples: [
      {
        title: 'Concrete Walkthrough',
        description: `Use a small example and track each change made by ${topic}.`,
        real_world_context: 'Small examples make the moving parts visible.',
      },
    ],
    keyTakeaways: [
      `${topic} should be learned by following states over time.`,
      'The important part is the rule that repeats.',
    ],
    interactiveBlocks: [
      {
        type: 'steps',
        title: 'Step Cards',
        items: [
          { title: 'Observe', body: 'Look at the current state.' },
          { title: 'Apply', body: 'Use the main rule once.' },
          { title: 'Update', body: 'Move to the next state and repeat.' },
        ],
      },
    ],
  };
}

export function buildSuggestedActions({ query = '', decision = {} } = {}) {
  const topic = cleanText(decision.activeTopic || query, 'this topic');
  if (isSimpleDefinition(query, decision)) {
    return [
      { type: 'chat', label: 'Examples', prompt: `Give me simple examples of ${topic}.` },
    ];
  }

  if (!isProcessLike(query, decision)) return [];

  const actions = [];
  if (decision.simulation?.needed || decision.simulation?.suggested || decision.simulation?.confidence >= 0.5) {
    actions.push({ type: 'simulation', label: 'Visualize', prompt: `Visualize ${topic}.` });
  }
  actions.push({ type: 'quiz', label: 'Quick Quiz', prompt: `Quiz me on ${topic}.` });

  if (/\bsort|search|algorithm\b/i.test(topic)) {
    actions.push({ type: 'chat', label: 'Time Complexity', prompt: `Explain the time complexity of ${topic}.` });
  }

  return actions.slice(0, 3);
}

export function buildAdaptiveExplanation({ query = '', decision = {} } = {}) {
  if (!isProcessLike(query, decision)) return null;
  return buildProcessExplanation(query, decision);
}

export function buildResponseBehavior({ query = '', decision = {} } = {}) {
  return {
    responseKind: isSimpleDefinition(query, decision)
      ? 'simple_definition'
      : isProcessLike(query, decision)
        ? 'adaptive_process'
        : 'chat',
    adaptiveExplanation: buildAdaptiveExplanation({ query, decision }),
    suggestedActions: buildSuggestedActions({ query, decision }),
  };
}
