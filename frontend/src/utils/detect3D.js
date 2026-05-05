/**
 * Client-side 3D visualization detection
 * Determines if a query should trigger 3D visualization
 */

/**
 * Check if query should use 3D visualization
 * @param {string} query - User query text
 * @returns {Object} { use3D: boolean, score: number, reason: string }
 */
export function should3DVisualize(query) {
  if (!query || typeof query !== 'string') {
    return { use3D: false, score: 0, reason: 'Invalid query' };
  }

  const score = {
    topicNaturally3D: 0,
    spatialRequired: 0,
    userExplicitlyAsked: 0,
    interactionHelps: 0,
  };

  // 1. Topic naturally 3D (+30)
  const natural3DTopics = [
    /molecule|atom|protein|dna|rna|chemical structure|molecular/i,
    /3d model|three dimensional|spatial|three-d/i,
    /orbit|planet|solar system|astronomy|satellite/i,
    /crystal|lattice|unit cell/i,
    /polyhedron|tetrahedron|octahedron|cube|sphere|cylinder|cone|torus/i,
    /engine|motor|turbine|compressor|pump/i,
    /gear|gearbox|transmission|drivetrain/i,
    /piston|crankshaft|camshaft|valve/i,
    /bearing|shaft|axle|rotor|stator/i,
    /mechanism|linkage|lever|pulley|cam/i,
    /robot|robotic arm|actuator|servo/i,
    /building|bridge|truss|architecture/i,
  ];
  if (natural3DTopics.some(p => p.test(query))) {
    score.topicNaturally3D = 30;
  }

  // 2. Spatial understanding required (+40)
  const spatialIndicators = [
    /how .*work(s|ing)?|working principle|internal|cross.?section/i,
    /structure|assembly|components|parts|internals/i,
    /bond angle|molecular geometry|configuration/i,
    /rotate|orientation|perspective|movement|motion/i,
  ];
  if (spatialIndicators.some(p => p.test(query))) {
    score.spatialRequired = 40;
  }

  // 3. User explicitly asked (+50)
  const explicitRequest = [
    /show me.*(3d|three-?d|visualization|model)/i,
    /create.*(3d|model|interactive.*3d)/i,
    /visualize.*(3d|spatially)/i,
    /3d.*(view|visualization|model|render)/i,
  ];
  if (explicitRequest.some(p => p.test(query))) {
    score.userExplicitlyAsked = 50;
  }

  // 4. Interaction helps (+20)
  const interactionIndicators = [
    /explore|manipulate|interact|rotate|zoom/i,
    /from different angles|all sides/i,
  ];
  if (interactionIndicators.some(p => p.test(query))) {
    score.interactionHelps = 20;
  }

  // NEGATIVE: Concept-only mentions (-30)
  const conceptOnly = [
    /formula|equation|calculate|compute|solve/i,
    /definition|what is|explain the concept|meaning of/i,
    /history of|who invented|when was/i,
  ];
  if (conceptOnly.some(p => p.test(query)) && score.userExplicitlyAsked === 0) {
    score.spatialRequired = Math.max(0, score.spatialRequired - 30);
  }

  // NEGATIVE: Clearly 2D topics (-50)
  const clearly2D = [
    /sort|sorting|bubble sort|quick sort|merge sort/i,
    /flowchart|flow chart|timeline/i,
    /bar chart|pie chart|line chart|histogram/i,
    /tree|binary tree|linked list|array|stack|queue/i,
  ];
  if (clearly2D.some(p => p.test(query)) && score.userExplicitlyAsked === 0) {
    score.topicNaturally3D = Math.max(0, score.topicNaturally3D - 50);
  }

  const total = Object.values(score).reduce((a, b) => a + b, 0);

  return {
    use3D: total >= 50,
    score: total,
    reason: total >= 50 ? '3D helps spatial understanding' : 'Text/2D sufficient',
    breakdown: score,
  };
}

/**
 * Get device capabilities for 3D rendering
 * @returns {Object} Device capability object
 */
export function getDeviceCapabilities() {
  let webgl = false;
  try {
    const canvas = document.createElement('canvas');
    webgl = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch (e) {
    webgl = false;
  }

  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const saveData = navigator.connection?.saveData || false;

  return {
    webgl,
    memory,
    cores,
    mobile,
    saveData,
    canRender3D: webgl && memory >= 2 && !saveData,
  };
}

/**
 * Extract topic for 3D generation from query
 * @param {string} query - User query
 * @returns {string} Extracted topic
 */
export function extract3DTopic(query) {
  // Try to extract the main subject
  const patterns = [
    /how (?:does |do )?(?:a |an |the )?(.+?) work/i,
    /explain (?:a |an |the )?(.+)/i,
    /show (?:me )?(?:a |an |the )?(.+)/i,
    /what is (?:a |an |the )?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Fallback: return first few words
  return query.split(' ').slice(0, 5).join(' ');
}
