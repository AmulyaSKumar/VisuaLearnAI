export function buildAnimations(topicAnalysis, objects) {
  const family = topicAnalysis.family;
  if (family === 'spatial') return spatialAnimations(objects);
  if (family === 'structure') return structureAnimations(objects);
  if (family === 'network') return networkAnimations(objects);
  if (family === 'physics') return physicsAnimations(objects);
  if (family === 'algorithm') return algorithmAnimations(objects);
  return abstractAnimations(objects);
}

export function defaultControls() {
  return ['zoom', 'rotate', 'pan', 'play', 'pause', 'speed', 'select', 'restart', 'fullscreen'];
}

function spatialAnimations(objects) {
  return objects.flatMap((object, index) => {
    if (/planet|body/i.test(object.type)) {
      return [{ targetId: object.id, type: 'orbit', speed: 0.35 + index * 0.08, radius: Math.max(2.5, Math.abs(object.position[0]) || 4), axis: 'y' }];
    }
    if (/galaxy|star_field|disk|cosmic/i.test(object.type)) {
      return [{ targetId: object.id, type: 'rotate', speed: 0.25 + index * 0.05, axis: 'y' }];
    }
    if (/particle|matter/i.test(object.type)) {
      return [{ targetId: object.id, type: 'particle_motion', speed: 0.6 }];
    }
    return [{ targetId: object.id, type: 'pulse', speed: 0.4 }];
  });
}

function structureAnimations(objects) {
  return objects.map((object, index) => ({
    targetId: object.id,
    type: /helix|dna/i.test(object.type) ? 'rotate' : index % 2 === 0 ? 'split' : 'flow',
    speed: 0.4 + index * 0.08,
    axis: /helix|dna/i.test(object.type) ? 'y' : undefined,
  }));
}

function networkAnimations(objects) {
  return objects.map((object, index) => ({
    targetId: object.id,
    type: /flow|connector/i.test(object.type) ? 'flow' : 'pulse',
    speed: 0.7 + index * 0.05,
  }));
}

function physicsAnimations(objects) {
  return objects.map((object, index) => ({
    targetId: object.id,
    type: /field|trajectory/i.test(object.type) ? 'flow' : /test_body|orbiting/i.test(object.type) ? 'orbit' : 'pulse',
    speed: 0.45 + index * 0.08,
    radius: /test_body|orbiting/i.test(object.type) ? 4 : undefined,
  }));
}

function algorithmAnimations(objects) {
  return objects.map((object, index) => ({
    targetId: object.id,
    type: index === 0 ? 'move' : index === objects.length - 1 ? 'merge' : 'flow',
    speed: 0.7,
  }));
}

function abstractAnimations(objects) {
  return objects.map((object, index) => ({
    targetId: object.id,
    type: /return|flow/i.test(object.type) ? 'flow' : index % 2 === 0 ? 'expand' : 'pulse',
    speed: 0.5 + index * 0.06,
  }));
}
