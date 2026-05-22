import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePersona } from '../contexts/PersonaContext';
import { createConversation, deleteConversation, supabase, updateConversation } from '../lib/supabase';
import InputBar from '../components/InputBar';
import DocumentUpload from '../components/DocumentUpload';
import { useDocuments } from '../hooks/useDocuments';
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

const ARTIFACT_LABELS = {
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map',
};

export default function NewChatPage({ onConversationCreated = null, onConversationUpdated = null }) {
  const { user, session } = useAuth();
  const { defaultPersona } = usePersona();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [pendingArtifact, setPendingArtifact] = useState(null);
  const accessToken = session?.access_token;

  // Document management hook
  const {
    documents,
    uploadProgress,
    upload: uploadDocument,
  } = useDocuments();

  const selectedDocument = documents.find(d => d.id === selectedDocumentId);

  const handleDocumentUpload = async (file) => {
    const document = await uploadDocument(file);
    if (document?.id) {
      setSelectedDocumentId(document.id);
      setShowDocuments(false);
      setWebSearchEnabled(false);
    }
    return document;
  };

  const handleSendMessage = async (text) => {
    if (!user || !text.trim()) return;

    setIsLoading(true);
    setError('');
    let conversation = null;
    let savedFirstMessage = false;
    const activeDocumentId = selectedDocumentId;
    const requestedArtifact = pendingArtifact;
    const useWebSearch = webSearchEnabled && !activeDocumentId;

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
          metadata: {
            documentId: activeDocumentId,
            webSearch: useWebSearch,
            requestedArtifact,
          }
        });

      if (msgError) throw msgError;
      savedFirstMessage = true;
      onConversationCreated?.({ ...conversation, messageCount: 1 });

      // 3. Call backend to generate response
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          userId: user.id,
          personaId: defaultPersona?.id,
          conversationId: conversation.id,
          documentId: activeDocumentId,
          webSearch: useWebSearch,
        })
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate response');
      }

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
            let data;
            try {
              data = JSON.parse(line.slice(6));
            } catch {
              // Skip non-JSON lines
              continue;
            }

            if (data.type === 'text_delta') {
              fullText += data.text;
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Failed to generate response');
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
            contentType: requestedArtifact ? undefined : 'learn',
            conversationId: conversation.id,
            documentId: activeDocumentId,
            webSearch: useWebSearch,
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
              documentId: activeDocumentId,
              webSearch: useWebSearch,
              requestedArtifact,
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
      setSelectedDocumentId(null);
      setPendingArtifact(null);
      setWebSearchEnabled(false);
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
            {(webSearchEnabled || selectedDocument || pendingArtifact || showDocuments || uploadProgress) && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  {webSearchEnabled && !selectedDocumentId && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary">
                      Web search on
                      <button type="button" onClick={() => setWebSearchEnabled(false)} className="text-primary/70 hover:text-primary">x</button>
                    </span>
                  )}
                  {selectedDocument && (
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary">
                      <span className="truncate">Document: {selectedDocument.filename}</span>
                      <button type="button" onClick={() => setSelectedDocumentId(null)} className="text-primary/70 hover:text-primary">x</button>
                    </span>
                  )}
                  {pendingArtifact && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-primary">
                      Generate {ARTIFACT_LABELS[pendingArtifact] || pendingArtifact}
                      <button type="button" onClick={() => setPendingArtifact(null)} className="text-primary/70 hover:text-primary">x</button>
                    </span>
                  )}
                </div>

                {(showDocuments || uploadProgress) && (
                  <div className="flex justify-center">
                    <DocumentUpload
                      compact
                      onUpload={handleDocumentUpload}
                      uploadProgress={uploadProgress}
                      disabled={isLoading}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <InputBar
              onSend={handleSendMessage}
              inputDisabled={isLoading}
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={() => {
                setWebSearchEnabled(prev => {
                  const next = !prev;
                  if (next && selectedDocumentId) setSelectedDocumentId(null);
                  return next;
                });
              }}
              onDocumentUpload={() => setShowDocuments(true)}
              onGenerateArtifact={(artifact) => setPendingArtifact(artifact)}
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
