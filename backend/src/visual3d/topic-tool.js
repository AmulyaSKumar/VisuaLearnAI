import { normalizeTopic } from './schema.js';

const DOMAIN_RULES = [
  {
    domain: 'Astronomy',
    family: 'spatial',
    patterns: [/\buniverse\b/i, /\bsolar system\b/i, /\bplanet/i, /\bstar/i, /\bgalax/i, /\bblack hole\b/i, /\borbit/i],
    concepts: ['scale', 'orbits', 'gravity', 'celestial bodies'],
  },
  {
    domain: 'Biology',
    family: 'structure',
    patterns: [/\bdna\b/i, /\breplication\b/i, /\bcell\b/i, /\bprotein\b/i, /\bmitosis\b/i, /\bphotosynthesis\b/i],
    concepts: ['molecules', 'sequence', 'structure', 'process'],
  },
  {
    domain: 'Physics',
    family: 'physics',
    patterns: [/\bgravity\b/i, /\bforce\b/i, /\bpendulum\b/i, /\bwave\b/i, /\bfield\b/i, /\bmagnet/i, /\benergy\b/i],
    concepts: ['force', 'motion', 'fields', 'energy transfer'],
  },
  {
    domain: 'Computer Science',
    family: 'abstract',
    patterns: [/\brecursion\b/i, /\brecursive\b/i],
    concepts: ['self-reference', 'base case', 'call stack', 'return flow'],
  },
  {
    domain: 'Computer Science',
    family: 'network',
    patterns: [/\bneural networks?\b/i, /\bapi\b/i, /\btcp\b/i, /\bnetwork\b/i, /\bgraph\b/i],
    concepts: ['nodes', 'connections', 'flow', 'layers'],
  },
  {
    domain: 'Algorithms',
    family: 'algorithm',
    patterns: [/\bsort\b/i, /\bsearch\b/i, /\bdijkstra\b/i, /\bdfs\b/i, /\bbfs\b/i, /\balgorithm\b/i],
    concepts: ['steps', 'state changes', 'comparison', 'result'],
  },
];

export function analyzeTopic(input = {}) {
  const rawTopic = input.topic || input.prompt || input.query || '';
  const normalized = normalizeTopic(rawTopic) || String(rawTopic || 'Untitled topic').trim().slice(0, 160);
  const target = `${rawTopic} ${normalized}`;

  const matched = DOMAIN_RULES.find(rule => rule.patterns.some(pattern => pattern.test(target)));
  const domain = matched?.domain || 'General Education';
  const family = matched?.family || inferFallbackFamily(target);
  const concepts = matched?.concepts || fallbackConcepts(family);

  return {
    topic: titleCase(normalized || 'Educational topic'),
    domain,
    family,
    concepts,
    confidence: matched ? 0.88 : 0.62,
  };
}

function inferFallbackFamily(text) {
  if (/\b(process|cycle|flow|timeline|history)\b/i.test(text)) return 'abstract';
  if (/\b(component|structure|part|inside)\b/i.test(text)) return 'structure';
  if (/\b(system|network|connection|communication)\b/i.test(text)) return 'network';
  return 'abstract';
}

function fallbackConcepts(family) {
  return {
    spatial: ['space', 'scale', 'movement'],
    structure: ['parts', 'relationships', 'labels'],
    network: ['nodes', 'edges', 'flow'],
    physics: ['forces', 'motion', 'change'],
    algorithm: ['state', 'steps', 'result'],
    abstract: ['idea', 'model', 'transformation'],
  }[family] || ['concept', 'relationship', 'change'];
}

function titleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.length <= 3 && word === word.toUpperCase()
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
