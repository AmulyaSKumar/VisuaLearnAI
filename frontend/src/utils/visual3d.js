const EXPLICIT_3D_PATTERN = /\b(3d|three[-\s]?d|three dimensional|spatial)\b/i;
const VISUAL_REQUEST_PATTERN = /\b(visuali[sz]e|show|build|render|create|model|demonstrate)\b/i;
const ALGORITHM_PATTERN = /\b(bubble|quick|merge|insertion|selection|heap)\s+sort\b|\b(binary search|dijkstra|dfs|bfs|algorithm|data structure)\b/i;
const VISUAL_3D_TOPIC_PATTERN = /\b(universe|solar system|planet|star|galaxy|black hole|gravity|pendulum|wave|force|field|dna|cell|molecule|protein|neural networks?|network|recursion|api flow|tcp)\b/i;

export function hasExplicit3DIntent(text) {
  return EXPLICIT_3D_PATTERN.test(String(text || ''));
}

export function shouldAttemptVisual3D(text, requestedArtifact = null) {
  const value = String(text || '');
  if (requestedArtifact === '3d_scene') return true;
  if (hasExplicit3DIntent(value)) return true;
  if (!VISUAL_REQUEST_PATTERN.test(value)) return false;
  if (ALGORITHM_PATTERN.test(value) && !hasExplicit3DIntent(value)) return false;
  return VISUAL_3D_TOPIC_PATTERN.test(value);
}

export function normalizeVisual3DTopic(text) {
  return String(text || '')
    .replace(/\b(?:please|can you|could you)\b/gi, ' ')
    .replace(/\b(?:in\s+)?(?:3d|three[-\s]?d|three dimensional)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidVisual3DBlueprint(visual3d) {
  return Boolean(
    visual3d?.blueprint
    && visual3d?.validation?.valid !== false
    && Array.isArray(visual3d.blueprint.objects)
    && visual3d.blueprint.objects.length > 0
  );
}

export async function generateVisual3D(topic, accessToken = null) {
  const requestedTopic = String(topic || '').trim();
  if (!requestedTopic) return null;

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE}/api/visual3d/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ topic: requestedTopic }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success || !data?.blueprint) {
    return {
      topic: requestedTopic,
      unavailable: true,
      validation: data?.validation || null,
      error: data?.error || data?.validation?.errors?.[0] || '3D is not available for this topic.',
    };
  }

  return {
    topic: data.topic || requestedTopic,
    blueprint: data.blueprint,
    validation: data.validation || data.blueprint?.validation || null,
  };
}
