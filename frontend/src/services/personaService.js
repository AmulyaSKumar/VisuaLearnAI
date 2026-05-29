/**
 * Persona Service
 * API calls for persona management
 */

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://visualearnai-backend.onrender.com' : 'http://localhost:3001');

/**
 * Get auth headers from session
 */
async function getAuthHeaders(session) {
  if (!session?.access_token) {
    throw new Error('No session available');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

/**
 * Get all personas (user's custom + system personas)
 * @param {Object} session - Supabase session
 * @returns {Promise<Object>} { personas, systemPersonas, customPersonas }
 */
export async function getPersonas(session) {
  const headers = await getAuthHeaders(session);

  const response = await fetch(`${API_URL}/api/personas`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch personas');
  }

  return response.json();
}

/**
 * Get user's default persona
 * @param {Object} session - Supabase session
 * @returns {Promise<Object>} { persona }
 */
export async function getDefaultPersona(session) {
  const headers = await getAuthHeaders(session);

  const response = await fetch(`${API_URL}/api/personas/default`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch default persona');
  }

  return response.json();
}

/**
 * Get a single persona by ID
 * @param {Object} session - Supabase session
 * @param {string} personaId - Persona ID
 * @returns {Promise<Object>} { persona }
 */
export async function getPersona(session, personaId) {
  const headers = await getAuthHeaders(session);

  const response = await fetch(`${API_URL}/api/personas/${personaId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch persona');
  }

  return response.json();
}

/**
 * Create a custom persona
 * @param {Object} session - Supabase session
 * @param {Object} personaData - Persona data
 * @returns {Promise<Object>} { persona }
 */
export async function createPersona(session, personaData) {
  const headers = await getAuthHeaders(session);

  const response = await fetch(`${API_URL}/api/personas`, {
    method: 'POST',
    headers,
    body: JSON.stringify(personaData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create persona');
  }

  return response.json();
}

/**
 * Update a custom persona
 * @param {Object} session - Supabase session
 * @param {string} personaId - Persona ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} { persona }
 */
export async function updatePersona(session, personaId, updates) {
  const headers = await getAuthHeaders(session);

  const response = await fetch(`${API_URL}/api/personas/${personaId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update persona');
  }

  return response.json();
}

/**
 * Delete a custom persona
 * @param {Object} session - Supabase session
 * @param {string} personaId - Persona ID
 * @returns {Promise<Object>} { success }
 */
export async function deletePersona(session, personaId) {
  const headers = await getAuthHeaders(session);

  const response = await fetch(`${API_URL}/api/personas/${personaId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete persona');
  }

  return response.json();
}

/**
 * Set a persona as user's default
 * @param {Object} session - Supabase session
 * @param {string} personaId - Persona ID
 * @returns {Promise<Object>} { success, profile, persona }
 */
export async function setDefaultPersona(session, personaId) {
  const headers = await getAuthHeaders(session);

  const response = await fetch(`${API_URL}/api/personas/${personaId}/set-default`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set default persona');
  }

  return response.json();
}

export default {
  getPersonas,
  getDefaultPersona,
  getPersona,
  createPersona,
  updatePersona,
  deletePersona,
  setDefaultPersona,
};
