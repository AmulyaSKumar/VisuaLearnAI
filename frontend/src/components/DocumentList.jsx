/**
 * DocumentList Component
 * Displays list of uploaded documents with status and actions
 */

import { useState } from 'react';

export default function DocumentList({
  documents,
  selectedDocumentId,
  onSelect,
  onDelete,
  isLoading,
}) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (e, documentId) => {
    e.stopPropagation();

    if (!confirm('Delete this document? This action cannot be undone.')) {
      return;
    }

    setDeletingId(documentId);
    try {
      await onDelete(documentId);
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err.message || 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'ready':
        return (
          <div className="w-2 h-2 rounded-full bg-green-500" title="Ready" />
        );
      case 'processing':
        return (
          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" title="Processing" />
        );
      case 'uploading':
        return (
          <div className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse" title="Uploading" />
        );
      case 'error':
        return (
          <div className="w-2 h-2 rounded-full bg-red-500" title="Error" />
        );
      default:
        return null;
    }
  };

  if (isLoading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="w-12 h-12 mx-auto text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="mt-2 text-sm text-muted-foreground">No documents uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const isSelected = selectedDocumentId === doc.id;
        const isDeleting = deletingId === doc.id;
        const isDisabled = doc.status !== 'ready';

        return (
          <div
            key={doc.id}
            onClick={() => !isDisabled && onSelect?.(isSelected ? null : doc.id)}
            className={`
              relative flex items-center gap-3 p-3 rounded-lg border transition-all
              ${isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
              }
              ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {/* Document icon */}
            <div className={`
              flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
              ${isSelected ? 'bg-primary/10' : 'bg-muted'}
            `}>
              <svg className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>

            {/* Document info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <StatusIcon status={doc.status} />
                <p className="text-sm font-medium text-foreground truncate">
                  {doc.filename}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatDate(doc.uploadedAt)}</span>
                {doc.pageCount && (
                  <>
                    <span>·</span>
                    <span>{doc.pageCount} pages</span>
                  </>
                )}
                {doc.status === 'processing' && (
                  <span className="text-yellow-600">Processing...</span>
                )}
                {doc.status === 'error' && (
                  <span className="text-red-600">Error: {doc.error}</span>
                )}
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={(e) => handleDelete(e, doc.id)}
              disabled={isDeleting}
              className="flex-shrink-0 p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-50"
              title="Delete document"
            >
              {isDeleting ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>

            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
