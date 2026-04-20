/**
 * DocumentUpload Component
 * Handles PDF upload with drag-and-drop and status display
 */

import { useState, useCallback, useRef } from 'react';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function DocumentUpload({
  onUpload,
  uploadProgress,
  disabled = false,
  compact = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!file) return 'No file selected';
    if (file.type !== 'application/pdf') return 'Only PDF files are allowed';
    if (file.size > MAX_FILE_SIZE) return 'File size exceeds 50MB limit';
    return null;
  };

  const handleFile = useCallback(async (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err.message);
    }
  }, [onUpload]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input
    e.target.value = '';
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      uploading: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Uploading...' },
      processing: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Processing...' },
      ready: { bg: 'bg-green-100', text: 'text-green-700', label: 'Ready' },
      error: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
    };

    const config = statusConfig[status] || statusConfig.error;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {(status === 'uploading' || status === 'processing') && (
          <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {status === 'ready' && (
          <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {config.label}
      </span>
    );
  };

  // Compact version (for inline use)
  if (compact) {
    return (
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={handleClick}
          disabled={disabled || uploadProgress?.status === 'uploading' || uploadProgress?.status === 'processing'}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {uploadProgress ? (
            <StatusBadge status={uploadProgress.status} />
          ) : (
            'Upload PDF'
          )}
        </button>
        {error && (
          <p className="absolute top-full left-0 mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }

  // Full version (drag-and-drop zone)
  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all
          ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {uploadProgress ? (
          <div className="flex flex-col items-center gap-3">
            <StatusBadge status={uploadProgress.status} />
            <p className="text-sm text-muted-foreground truncate max-w-full">
              {uploadProgress.filename}
            </p>
            {uploadProgress.status === 'processing' && (
              <p className="text-xs text-muted-foreground">
                Extracting text and generating embeddings...
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="w-12 h-12 mb-3 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              Drop a PDF here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max file size: 50MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-destructive flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
