export function buildSceneLayout(topicAnalysis) {
  const family = topicAnalysis.family;
  if (family === 'spatial') return spatialLayout(topicAnalysis);
  if (family === 'structure') return structureLayout(topicAnalysis);
  if (family === 'network') return networkLayout(topicAnalysis);
  if (family === 'physics') return physicsLayout(topicAnalysis);
  if (family === 'algorithm') return algorithmLayout(topicAnalysis);
  return abstractLayout(topicAnalysis);
}

function spatialLayout(topic) {
  if (/solar system/i.test(topic.topic)) {
    return {
      layout: 'orbital_system',
      objects: [
        { type: 'star', name: 'Sun', role: 'center', position: [0, 0, 0] },
        { type: 'planet', name: 'Inner Planet', role: 'orbiting body', position: [3, 0, 0] },
        { type: 'planet', name: 'Earth-like Planet', role: 'orbiting body', position: [5.5, 0, 0] },
        { type: 'planet', name: 'Outer Planet', role: 'orbiting body', position: [8, 0, 0] },
        { type: 'orbit_path', name: 'Orbital Paths', role: 'motion guide', position: [0, 0, 0] },
      ],
    };
  }

  if (/black hole/i.test(topic.topic)) {
    return {
      layout: 'accretion_scene',
      objects: [
        { type: 'black_hole', name: 'Event Horizon', role: 'boundary where escape becomes impossible', position: [0, 0, 0] },
        { type: 'accretion_disk', name: 'Accretion Disk', role: 'heated matter spiraling inward', position: [0, 0, 0] },
        { type: 'particle_stream', name: 'Falling Matter', role: 'matter flow', position: [0, 0, 0] },
        { type: 'label', name: 'Gravity Well', role: 'concept label', position: [0, 3, 0] },
      ],
    };
  }

  return {
    layout: 'space_cluster',
    objects: [
      { type: 'galaxy', name: 'Galaxy Cluster', role: 'large-scale structure', position: [0, 0, 0] },
      { type: 'star_field', name: 'Star Field', role: 'visible stars', position: [0, 0, 0] },
      { type: 'planet', name: 'Planet System', role: 'local orbital model', position: [5, 0, 0] },
      { type: 'cosmic_web', name: 'Cosmic Web', role: 'large-scale connections', position: [-5, 0, 0] },
    ],
  };
}

function structureLayout(topic) {
  if (/dna/i.test(topic.topic)) {
    return {
      layout: 'molecular_helix',
      objects: [
        { type: 'helix', name: 'DNA Double Helix', role: 'template strands', position: [0, 0, 0] },
        { type: 'enzyme', name: 'Helicase', role: 'unzips DNA', position: [-2.6, 0, 0] },
        { type: 'enzyme', name: 'DNA Polymerase', role: 'builds new strand', position: [2.6, 0, 0] },
        { type: 'nucleotide', name: 'New Nucleotides', role: 'incoming bases', position: [0, -2.6, 0] },
      ],
    };
  }

  return {
    layout: 'component_exploded_view',
    objects: [
      { type: 'core', name: `${topic.topic} Core`, role: 'central idea', position: [0, 0, 0] },
      { type: 'component', name: 'Component A', role: 'major part', position: [-3, 0, 0] },
      { type: 'component', name: 'Component B', role: 'major part', position: [3, 0, 0] },
      { type: 'connector', name: 'Relationship', role: 'how parts connect', position: [0, 0, 0] },
    ],
  };
}

function networkLayout(topic) {
  return {
    layout: 'layered_network',
    objects: [
      { type: 'layer', name: 'Input Layer', role: 'receives signals', position: [-5, 0, 0] },
      { type: 'layer', name: 'Hidden Layer', role: 'transforms information', position: [0, 0, 0] },
      { type: 'layer', name: 'Output Layer', role: 'produces result', position: [5, 0, 0] },
      { type: 'flow', name: 'Signal Flow', role: 'communication between nodes', position: [0, 0, 0] },
    ],
  };
}

function physicsLayout(topic) {
  if (/gravity/i.test(topic.topic)) {
    return {
      layout: 'field_and_orbit',
      objects: [
        { type: 'massive_body', name: 'Massive Body', role: 'source of gravity', position: [0, 0, 0] },
        { type: 'test_body', name: 'Orbiting Object', role: 'responds to gravity', position: [5, 0, 0] },
        { type: 'field_lines', name: 'Gravity Field', role: 'direction of attraction', position: [0, 0, 0] },
        { type: 'trajectory', name: 'Curved Path', role: 'motion under gravity', position: [0, 0, 0] },
      ],
    };
  }

  return {
    layout: 'physics_demonstration',
    objects: [
      { type: 'source', name: 'Cause', role: 'initial force or condition', position: [-3, 0, 0] },
      { type: 'body', name: 'Object', role: 'thing being affected', position: [0, 0, 0] },
      { type: 'effect', name: 'Effect', role: 'visible result', position: [3, 0, 0] },
    ],
  };
}

function algorithmLayout(topic) {
  return {
    layout: 'state_machine',
    objects: [
      { type: 'input', name: 'Input State', role: 'starting data', position: [-4, 0, 0] },
      { type: 'process', name: 'Step Logic', role: 'repeated operation', position: [0, 0, 0] },
      { type: 'output', name: 'Result State', role: 'final answer', position: [4, 0, 0] },
    ],
  };
}

function abstractLayout(topic) {
  if (/recursion/i.test(topic.topic)) {
    return {
      layout: 'nested_call_stack',
      objects: [
        { type: 'call', name: 'Original Call', role: 'starts the recursion', position: [0, 3, 0] },
        { type: 'call', name: 'Smaller Call', role: 'solves a smaller version', position: [0, 1, 0] },
        { type: 'base_case', name: 'Base Case', role: 'stops recursion', position: [0, -1, 0] },
        { type: 'return_flow', name: 'Return Flow', role: 'answers combine upward', position: [3, 1, 0] },
      ],
    };
  }

  return {
    layout: 'concept_model',
    objects: [
      { type: 'idea', name: 'Main Idea', role: 'central concept', position: [0, 0, 0] },
      { type: 'part', name: 'Cause', role: 'what starts it', position: [-3, 1, 0] },
      { type: 'part', name: 'Change', role: 'what happens', position: [0, -2, 0] },
      { type: 'part', name: 'Result', role: 'what it becomes', position: [3, 1, 0] },
    ],
  };
}
