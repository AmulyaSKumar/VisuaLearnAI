import { normalizeId } from './schema.js';

export function buildGeometryObjects(topicAnalysis, sceneLayout) {
  return sceneLayout.objects.map((item, index) => {
    const primitive = primitiveFor(item.type);
    const id = normalizeId(`${item.name}-${index + 1}`, `object-${index + 1}`);
    return {
      id,
      type: item.type,
      name: item.name,
      description: descriptionFor(topicAnalysis, item),
      position: item.position || autoPosition(index, sceneLayout.objects.length),
      scale: scaleFor(item.type),
      geometry: geometryFor(item.type, primitive),
      material: materialFor(item.type, primitive),
      facts: factsFor(topicAnalysis, item),
    };
  });
}

function primitiveFor(type) {
  if (/galaxy|star_field|particle|cosmic|flow|field/i.test(type)) return 'particle_system';
  if (/planet|body|star|sun|black_hole/i.test(type)) return 'sphere';
  if (/orbit|path|trajectory|connector|disk/i.test(type)) return 'ring';
  if (/helix|dna/i.test(type)) return 'helix';
  if (/line|edge|relationship/i.test(type)) return 'line';
  if (/label/i.test(type)) return 'text_label';
  if (/(?:^|_)layer$|\bplane\b/i.test(type)) return 'plane';
  if (/cone/i.test(type)) return 'cone';
  if (/enzyme|component|core|call|base|process|input|output|part|idea/i.test(type)) return 'cube';
  return 'sphere';
}

function geometryFor(type, primitive) {
  if (primitive === 'particle_system') {
    const count = /star_field/i.test(type) ? 900 : /galaxy/i.test(type) ? 600 : /cosmic/i.test(type) ? 500 : 600;
    return { primitive, count, radius: /field/i.test(type) ? 8 : 5 };
  }
  if (primitive === 'ring') {
    return { primitive, radius: /orbit|trajectory/i.test(type) ? 5 : 2.4, segments: 96 };
  }
  if (primitive === 'helix') {
    return { primitive, radius: 1.4, height: 6, segments: 64 };
  }
  if (primitive === 'line') {
    return { primitive, points: [[-2, 0, 0], [2, 0, 0]] };
  }
  if (primitive === 'plane') {
    return { primitive, radius: 2.2 };
  }
  return { primitive, radius: /star|sun|massive/i.test(type) ? 1.4 : 0.75 };
}

function scaleFor(type) {
  if (/star|sun|massive|galaxy/i.test(type)) return [1.6, 1.6, 1.6];
  if (/field|orbit|trajectory|cosmic/i.test(type)) return [1, 1, 1];
  if (/helix|dna/i.test(type)) return [1.2, 1.2, 1.2];
  if (/layer|plane/i.test(type)) return [1.5, 1, 1];
  return [1, 1, 1];
}

function materialFor(type, primitive) {
  if (/black_hole|event/i.test(type)) return { color: '#080808', emissive: '#111111' };
  if (/star|sun|massive/i.test(type)) return { color: '#ffd166', emissive: '#ff9f1c' };
  if (/planet|body/i.test(type)) return { color: '#4dabf7', emissive: '#1c7ed6' };
  if (/dna|helix|nucleotide/i.test(type)) return { color: '#38d9a9', emissive: '#0ca678' };
  if (/enzyme/i.test(type)) return { color: '#ffa94d', emissive: '#f08c00' };
  if (/field|flow|trajectory|orbit/i.test(type)) return { color: '#74c0fc', emissive: '#339af0', opacity: 0.72 };
  if (/layer|network/i.test(type)) return { color: '#91a7ff', emissive: '#5c7cfa', opacity: primitive === 'plane' ? 0.45 : 1 };
  return { color: '#88ccff', emissive: '#339af0' };
}

function descriptionFor(topic, item) {
  return `${item.name} represents ${item.role} in a 3D model of ${topic.topic}.`;
}

function factsFor(topic, item) {
  return [
    `${item.name} helps explain ${topic.topic} by making ${item.role} visible.`,
    `Scene family: ${topic.family}.`,
  ];
}

function autoPosition(index, total) {
  const angle = (Math.PI * 2 * index) / Math.max(1, total);
  const radius = total > 3 ? 4 : 3;
  return [
    Math.round(Math.cos(angle) * radius * 100) / 100,
    Math.round(Math.sin(angle) * radius * 100) / 100,
    0,
  ];
}
