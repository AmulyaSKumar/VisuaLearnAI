const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://visualearnai-backend.onrender.com' : 'http://localhost:3001');

async function request(path, accessToken, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Notion request failed');
  }

  return data;
}

export async function getNotionStatus(accessToken) {
  return request('/api/notion/status', accessToken);
}

export async function getNotionConnectUrl(accessToken) {
  return request('/api/notion/connect', accessToken);
}

export async function disconnectNotion(accessToken) {
  return request('/api/notion/disconnect', accessToken, { method: 'DELETE' });
}

export async function exportToNotion(accessToken, payload) {
  return request('/api/notion/export', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
