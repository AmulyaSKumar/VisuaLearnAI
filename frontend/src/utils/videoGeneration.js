const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://visualearnai-backend.onrender.com" : "http://localhost:3001");

function authHeaders(accessToken, extra = {}) {
  return {
    ...extra,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function parseJson(response, fallbackMessage) {
  const rawText = await response.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || fallbackMessage);
  }

  return data;
}

export function isVideoRequest(text, requestedArtifact = null) {
  if (requestedArtifact === "video") return true;
  return /\b(video|generate\s+(?:an?\s+)?educational\s+video|create\s+(?:an?\s+)?video|make\s+(?:an?\s+)?video|video\s+generation)\b/i.test(String(text || ""));
}

export async function createVideoJob(payload, accessToken = null) {
  const response = await fetch(`${API_BASE}/api/videos`, {
    method: "POST",
    headers: authHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await parseJson(response, "Failed to create video job.");
  return data.job;
}

export async function getVideoJob(jobId, accessToken = null) {
  const response = await fetch(`${API_BASE}/api/videos/${encodeURIComponent(jobId)}`, {
    headers: authHeaders(accessToken),
  });
  const data = await parseJson(response, "Failed to load video status.");
  return data.job;
}

export async function getVideoLogs(jobId, accessToken = null) {
  const response = await fetch(`${API_BASE}/api/videos/${encodeURIComponent(jobId)}/logs`, {
    headers: authHeaders(accessToken),
  });
  const data = await parseJson(response, "Failed to load video logs.");
  return data.logs || {};
}

export function getVideoStreamUrl(jobId) {
  return `${API_BASE}/api/videos/${encodeURIComponent(jobId)}/video`;
}

export async function fetchVideoBlob(jobId, accessToken = null) {
  const response = await fetch(getVideoStreamUrl(jobId), {
    headers: authHeaders(accessToken),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || data?.error || "Generated video is not ready.");
  }

  return response.blob();
}
