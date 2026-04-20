/**
 * Document Service
 * Handles document upload, status polling, and management
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Upload a PDF document
 * @param {File} file - The PDF file to upload
 * @param {string} accessToken - Auth token
 * @returns {Promise<Object>} Upload response with document ID
 */
export async function uploadDocument(file, accessToken) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Upload failed');
  }

  return response.json();
}

/**
 * Get document status
 * @param {string} documentId - Document ID
 * @param {string} accessToken - Auth token
 * @returns {Promise<Object>} Document status
 */
export async function getDocumentStatus(documentId, accessToken) {
  const response = await fetch(`${API_BASE}/api/documents/${documentId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get status' }));
    throw new Error(error.error || 'Failed to get status');
  }

  return response.json();
}

/**
 * List user's documents
 * @param {string} accessToken - Auth token
 * @returns {Promise<Object>} List of documents
 */
export async function listDocuments(accessToken) {
  const response = await fetch(`${API_BASE}/api/documents`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to list documents' }));
    throw new Error(error.error || 'Failed to list documents');
  }

  return response.json();
}

/**
 * Delete a document
 * @param {string} documentId - Document ID
 * @param {string} accessToken - Auth token
 * @returns {Promise<Object>} Delete response
 */
export async function deleteDocument(documentId, accessToken) {
  const response = await fetch(`${API_BASE}/api/documents/${documentId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to delete' }));
    throw new Error(error.error || 'Failed to delete');
  }

  return response.json();
}

/**
 * Query a document (RAG retrieval)
 * @param {string} documentId - Document ID
 * @param {string} query - Search query
 * @param {string} accessToken - Auth token
 * @returns {Promise<Object>} Query results with context
 */
export async function queryDocument(documentId, query, accessToken) {
  const response = await fetch(`${API_BASE}/api/documents/${documentId}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Query failed' }));
    throw new Error(error.error || 'Query failed');
  }

  return response.json();
}

/**
 * Get document summary
 * @param {string} documentId - Document ID
 * @param {string} accessToken - Auth token
 * @returns {Promise<Object>} Document summary
 */
export async function getDocumentSummary(documentId, accessToken) {
  const response = await fetch(`${API_BASE}/api/documents/${documentId}/summary`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get summary' }));
    throw new Error(error.error || 'Failed to get summary');
  }

  return response.json();
}

/**
 * Get document preview with topics and suggested questions
 * @param {string} documentId - Document ID
 * @param {string} accessToken - Auth token
 * @returns {Promise<Object>} Document preview with topics and suggestions
 */
export async function getDocumentPreview(documentId, accessToken) {
  const response = await fetch(`${API_BASE}/api/documents/${documentId}/preview`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get preview' }));
    throw new Error(error.error || 'Failed to get preview');
  }

  return response.json();
}

export default {
  uploadDocument,
  getDocumentStatus,
  listDocuments,
  deleteDocument,
  queryDocument,
  getDocumentSummary,
  getDocumentPreview,
};
