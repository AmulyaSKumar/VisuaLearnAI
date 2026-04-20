/**
 * useDocuments Hook
 * Manages document upload, status polling, and document list
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  uploadDocument,
  getDocumentStatus,
  listDocuments,
  deleteDocument,
} from '../services/documentService';

/**
 * Document status polling hook
 */
export function useDocuments() {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null); // { documentId, status, filename }

  const pollingRef = useRef(null);

  // Fetch all documents
  const fetchDocuments = useCallback(async () => {
    if (!accessToken) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await listDocuments(accessToken);
      setDocuments(result.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  // Upload a new document
  const upload = useCallback(async (file) => {
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    setError(null);
    setUploadProgress({ status: 'uploading', filename: file.name });

    try {
      const result = await uploadDocument(file, accessToken);

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      const doc = result.document;
      setUploadProgress({
        documentId: doc.id,
        status: doc.status,
        filename: doc.filename,
      });

      // Add to documents list
      setDocuments(prev => [doc, ...prev]);

      // Start polling for status
      startPolling(doc.id);

      return doc;
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.message);
      setUploadProgress(null);
      throw err;
    }
  }, [accessToken]);

  // Poll document status
  const startPolling = useCallback((documentId) => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    const poll = async () => {
      try {
        const result = await getDocumentStatus(documentId, accessToken);
        const doc = result.document;

        // Update progress
        setUploadProgress(prev => prev?.documentId === documentId ? {
          ...prev,
          status: doc.status,
        } : prev);

        // Update in documents list
        setDocuments(prev => prev.map(d =>
          d.id === documentId ? { ...d, ...doc } : d
        ));

        // Stop polling when ready or error
        if (doc.status === 'ready' || doc.status === 'error') {
          clearInterval(pollingRef.current);
          pollingRef.current = null;

          // Clear progress after a delay
          setTimeout(() => {
            setUploadProgress(prev =>
              prev?.documentId === documentId ? null : prev
            );
          }, 2000);
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };

    // Poll immediately and then every 2 seconds
    poll();
    pollingRef.current = setInterval(poll, 2000);
  }, [accessToken]);

  // Delete a document
  const remove = useCallback(async (documentId) => {
    if (!accessToken) return;

    try {
      await deleteDocument(documentId, accessToken);
      setDocuments(prev => prev.filter(d => d.id !== documentId));
    } catch (err) {
      console.error('Delete failed:', err);
      setError(err.message);
      throw err;
    }
  }, [accessToken]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    isLoading,
    error,
    uploadProgress,
    upload,
    remove,
    refresh: fetchDocuments,
  };
}

export default useDocuments;
