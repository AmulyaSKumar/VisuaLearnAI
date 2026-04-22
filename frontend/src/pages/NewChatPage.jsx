import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createConversation, deleteConversation, supabase, updateConversation } from '../lib/supabase';
import InputBar from '../components/InputBar';
import DocumentUpload from '../components/DocumentUpload';
import DocumentList from '../components/DocumentList';
import { useDocuments } from '../hooks/useDocuments';
import { getDocumentPreview } from '../services/documentService';
import {
  DEFAULT_CONVERSATION_TITLE,
  generateConversationTitle,
  shouldAutoGenerateConversationTitle,
} from '../utils/conversationActions';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SUGGESTIONS = [
  { text: "Explain how neural networks work" },
  { text: "Teach me about photosynthesis" },
  { text: "How does the stock market work?" },
  { text: "Explain React hooks with examples" },
];

export default function NewChatPage({ onConversationCreated = null, onConversationUpdated = null }) {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const accessToken = session?.access_token;

  // Document management hook
  const {
    documents,
    isLoading: documentsLoading,
    uploadProgress,
    upload: uploadDocument,
    remove: removeDocument,
  } = useDocuments();

  const selectedDocument = documents.find(d => d.id === selectedDocumentId);

  // Fetch preview when document is selected and ready
  useEffect(() => {
    if (!selectedDocumentId || !accessToken) {
      setDocumentPreview(null);
      return;
    }

    const doc = documents.find(d => d.id === selectedDocumentId);
    if (doc?.status !== 'ready') {
      setDocumentPreview(null);
      return;
    }

    setPreviewLoading(true);
    getDocumentPreview(selectedDocumentId, accessToken)
      .then(result => {
        if (result.success && result.preview) {
          setDocumentPreview(result.preview);
        }
      })
      .catch(err => {
        console.warn('Failed to fetch document preview:', err);
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }, [selectedDocumentId, documents, accessToken]);

  const handleSendMessage = async (text) => {
    if (!user || !text.trim()) return;

    setIsLoading(true);
    setError('');
    let conversation = null;
    let savedFirstMessage = false;

    try {
      // 1. Create conversation only when the first message is actually being sent
      conversation = await createConversation(user.id, DEFAULT_CONVERSATION_TITLE);

      // 2. Save user message
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          role: 'user',
          content: text,
          metadata: {}
        });

      if (msgError) throw msgError;
      savedFirstMessage = true;
      onConversationCreated?.({ ...conversation, messageCount: 1 });

      // 3. Call backend to generate response
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          userId: user.id,
        })
      });

      // Read SSE response and save assistant message
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text_delta') {
                fullText += data.text;
              }
            } catch {
              // Skip non-JSON lines
            }
          }
        }
      }

      // 4. Generate learning content
      let learningContent = null;
      let factCheck = null;
      try {
        const lcHeaders = { 'Content-Type': 'application/json' };
        if (accessToken) {
          lcHeaders['Authorization'] = `Bearer ${accessToken}`;
        }

        const lcResponse = await fetch(`${API_BASE}/api/learning-content`, {
          method: 'POST',
          headers: lcHeaders,
          body: JSON.stringify({
            query: text,
            userId: user.id,
            contentType: 'learn',
            documentId: selectedDocumentId, // RAG: pass document ID if selected
          })
        });
        if (lcResponse.ok) {
          const lcData = await lcResponse.json();
          if (lcData.success) {
            learningContent = lcData.content;
            factCheck = lcData.content?.factCheck || null;
          }
        }
      } catch (lcErr) {
        console.warn('Learning content generation failed:', lcErr);
      }

      // 5. Save assistant response with learning content
      if (fullText || learningContent) {
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            role: 'assistant',
            content: fullText || '',
            metadata: {
              learningContent,
              factCheck
            }
          });
      }

      if (shouldAutoGenerateConversationTitle(conversation.title)) {
        const generatedTitle = generateConversationTitle(text);
        const updatedConversation = await updateConversation(user.id, conversation.id, {
          title: generatedTitle,
        });
        onConversationUpdated?.(conversation.id, updatedConversation);
      }

      // 6. Navigate to learning page
      navigate(`/learn/${conversation.id}`);

    } catch (err) {
      if (user && conversation?.id && !savedFirstMessage) {
        await deleteConversation(user.id, conversation.id).catch(() => {});
      }

      console.error('Failed to start session:', err);
      setError(err.message || 'Failed to start learning session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleSendMessage(suggestion.text);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-background">
      <div className="w-full max-w-2xl space-y-6 sm:space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto neu-circle flex items-center justify-center">
            <svg className="w-7 h-7 sm:w-9 sm:h-9 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">What do you want to learn?</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Ask any question and get an interactive learning experience
          </p>
        </div>

        {/* Document Section */}
        <div className="neu-card-sm overflow-hidden">
          {/* Document Header */}
          <button
            onClick={() => setShowDocuments(!showDocuments)}
            className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">
                  {selectedDocument ? 'Learning from document' : 'Learn from a PDF'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedDocument
                    ? selectedDocument.filename
                    : 'Upload a document to ask questions about it'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedDocument && (
                <span className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full">
                  Active
                </span>
              )}
              <svg
                className={`w-5 h-5 text-muted-foreground transition-transform ${showDocuments ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>

          {/* Document Panel */}
          {showDocuments && (
            <div className="p-4 border-t border-border space-y-4">
              {/* Upload */}
              <DocumentUpload
                onUpload={uploadDocument}
                uploadProgress={uploadProgress}
                disabled={isLoading}
              />

              {/* Document List */}
              {documents.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">
                    Your Documents
                  </p>
                  <DocumentList
                    documents={documents}
                    selectedDocumentId={selectedDocumentId}
                    onSelect={setSelectedDocumentId}
                    onDelete={removeDocument}
                    isLoading={documentsLoading}
                  />
                </div>
              )}

              {/* Selected document indicator with preview */}
              {selectedDocument && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-foreground">
                        Learning from: <strong>{selectedDocument.filename}</strong>
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedDocumentId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Document Preview */}
                  {previewLoading && (
                    <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Analyzing document...
                    </div>
                  )}

                  {documentPreview && !previewLoading && (
                    <div className="p-4 bg-muted/30 border border-border rounded-lg space-y-3">
                      {/* Topics */}
                      {documentPreview.topics?.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                            Topics in this document
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {documentPreview.topics.map((topic, idx) => (
                              <span key={idx} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggested Questions */}
                      {documentPreview.suggestedQuestions?.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                            Try asking
                          </p>
                          <div className="flex flex-col gap-2">
                            {documentPreview.suggestedQuestions.slice(0, 4).map((question, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSendMessage(question)}
                                disabled={isLoading}
                                className="flex items-center gap-2 p-2 text-left text-sm bg-background hover:bg-muted border border-border rounded-lg transition-colors disabled:opacity-50"
                              >
                                <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-foreground">{question}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
                        {documentPreview.pageCount && (
                          <span>{documentPreview.pageCount} pages</span>
                        )}
                        {documentPreview.chunkCount && (
                          <span>{documentPreview.chunkCount} sections indexed</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-10 h-10 mx-auto border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-foreground font-medium">Creating your learning session...</p>
            <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
          </div>
        ) : (
          <>
            {/* Input */}
            <InputBar
              onSend={handleSendMessage}
              inputDisabled={isLoading}
            />

            {/* Suggestions */}
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground text-center font-medium uppercase tracking-wider">
                Try these examples
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="flex items-center gap-3 p-4 min-h-[52px] neu-btn text-left group"
                  >
                    <div className="w-8 h-8 neu-circle-pressed flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <span className="text-sm text-foreground/80 group-hover:text-foreground">
                      {suggestion.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
