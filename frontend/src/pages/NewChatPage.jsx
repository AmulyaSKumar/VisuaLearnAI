import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
import { sanitizeAssistantResponse } from '../utils/sanitizeAssistantResponse';
import { generateVisual3D, shouldAttemptVisual3D } from '../utils/visual3d';
import { createVideoJob, isVideoRequest } from '../utils/videoGeneration';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://visualearnai-backend.onrender.com' : 'http://localhost:3001');

const ARTIFACT_LABELS = {
  learn: 'Learn Deeply',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map',
  simulation: 'Simulation',
  '3d_scene': '3D Visualization',
  video: 'Video Generation',
  summarize: 'Document Summary',
};

const ARTIFACT_ONLY_RESPONSES = new Set(['quiz', 'flashcards', 'mindmap', 'simulation', 'video']);

const artifactToContentType = (artifact) => {
  if (artifact === 'video') return null;
  if (!artifact || artifact === 'learn' || artifact === 'simulation' || artifact === '3d_scene' || artifact === 'summarize') return 'learn';
  if (artifact === 'quiz') return 'quiz';
  if (artifact === 'flashcards' || artifact === 'mindmap') return 'flashcards-mindmap';
  return 'learn';
};

function inferExplicitArtifact(text) {
  const value = String(text || '');
  if (/\b(quiz|test me|ask me questions|practice questions|question me)\b/i.test(value)) return 'quiz';
  if (/\b(flashcards?|cards?|revise with cards)\b/i.test(value)) return 'flashcards';
  if (/\b(mind\s?map|concept map|map this)\b/i.test(value)) return 'mindmap';
  if (/\b(learn deeply|deep dive|teach me|explore)\b/i.test(value)) return 'learn';
  if (isVideoRequest(value)) return 'video';
  if (shouldAttemptVisual3D(value)) return '3d_scene';
  return null;
}

export default function NewChatPage({ onConversationCreated = null, onConversationUpdated = null }) {
  const { user, session } = useAuth();
  const { defaultPersona } = usePersona();
  const navigate = useNavigate();
  const location = useLocation();
  const isLearningMode = new URLSearchParams(location.search).get('mode') === 'learning';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [showDocuments, setShowDocuments] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [pendingArtifact, setPendingArtifact] = useState(null);
  const [videoOptions, setVideoOptions] = useState({
    durationSeconds: 60,
    audience: 'high school students',
    quality: 'final',
  });
  const [recentSuggestions, setRecentSuggestions] = useState([]);
  const accessToken = session?.access_token;

  // Document management hook
  const {
    documents,
    uploadProgress,
    upload: uploadDocument,
  } = useDocuments();

  const selectedDocument = documents.find(d => d.id === selectedDocumentId);
  const selectedInputTools = useMemo(() => {
    const tools = [];

    if (isLearningMode) {
      tools.push({
        id: 'learning-mode',
        label: 'Learning Mode',
      });
    }

    if (webSearchEnabled && !selectedDocumentId) {
      tools.push({
        id: 'web-search',
        label: 'Web search',
        onRemove: () => setWebSearchEnabled(false),
      });
    }

    if (selectedDocument) {
      tools.push({
        id: 'document',
        label: `Document: ${selectedDocument.filename}`,
        onRemove: () => setSelectedDocumentId(null),
      });
    } else if (showDocuments) {
      tools.push({
        id: 'upload-document',
        label: 'Upload document',
        onRemove: () => setShowDocuments(false),
      });
    }

    if (pendingArtifact) {
      const videoLabel = pendingArtifact === 'video'
        ? `Video: ${videoOptions.durationSeconds}s ${videoOptions.quality}`
        : null;
      tools.push({
        id: `artifact-${pendingArtifact}`,
        label: videoLabel || ARTIFACT_LABELS[pendingArtifact] || pendingArtifact,
        onRemove: () => setPendingArtifact(null),
      });
    }

    return tools;
  }, [isLearningMode, pendingArtifact, selectedDocument, selectedDocumentId, showDocuments, videoOptions.durationSeconds, videoOptions.quality, webSearchEnabled]);

  useEffect(() => {
    if (!user?.id) {
      setRecentSuggestions([]);
      return undefined;
    }

    let cancelled = false;

    const loadRecentSuggestions = async () => {
      try {
        const { data: conversations, error: conversationError } = await supabase
          .from('conversations')
          .select('id, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(8);

        if (conversationError) throw conversationError;

        const conversationIds = (conversations || []).map((conversation) => conversation.id);
        if (conversationIds.length === 0) {
          if (!cancelled) setRecentSuggestions([]);
          return;
        }

        const { data: messages, error: messageError } = await supabase
          .from('messages')
          .select('content, created_at')
          .in('conversation_id', conversationIds)
          .eq('role', 'user')
          .order('created_at', { ascending: false })
          .limit(20);

        if (messageError) throw messageError;

        const seen = new Set();
        const suggestions = [];
        for (const message of messages || []) {
          const text = String(message.content || '').trim();
          if (text.length < 4) continue;
          const key = generateConversationTitle(text).toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          suggestions.push({ text });
          if (suggestions.length >= 4) break;
        }

        if (!cancelled) setRecentSuggestions(suggestions);
      } catch (suggestionError) {
        console.warn('Failed to load recent suggestions:', suggestionError);
        if (!cancelled) setRecentSuggestions([]);
      }
    };

    loadRecentSuggestions();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
    const requestedArtifact = pendingArtifact || (isLearningMode ? 'learn' : inferExplicitArtifact(text));
    const isArtifactOnlyResponse = ARTIFACT_ONLY_RESPONSES.has(requestedArtifact);
    const useWebSearch = webSearchEnabled && !activeDocumentId;

    try {
      // 1. Create conversation only when the first message is actually being sent
      conversation = await createConversation(user.id, DEFAULT_CONVERSATION_TITLE, {
        mode: isLearningMode ? 'learning' : 'chat',
      });

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

      if (requestedArtifact === 'video') {
        const video = await createVideoJob({
          topic: text,
          durationSeconds: videoOptions.durationSeconds,
          audience: videoOptions.audience,
          quality: videoOptions.quality,
        }, accessToken);

        await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            role: 'assistant',
            content: '',
            metadata: {
              documentId: activeDocumentId,
              webSearch: useWebSearch,
              requestedArtifact: 'video',
              activeTopic: text,
              video,
            }
          });

        if (shouldAutoGenerateConversationTitle(conversation.title)) {
          const generatedTitle = generateConversationTitle(text);
          const updatedConversation = await updateConversation(user.id, conversation.id, {
            title: generatedTitle,
          });
          onConversationUpdated?.(conversation.id, updatedConversation);
        }

        setSelectedDocumentId(null);
        setPendingArtifact(null);
        setWebSearchEnabled(false);
        navigate(`/chat/${conversation.id}`);
        return;
      }

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
          learningAction: requestedArtifact || null,
          preferences: { requestedArtifact, mode: isLearningMode ? 'learning' : 'chat' },
          mode: isLearningMode ? 'learning' : 'chat',
          conversationState: {
            activeTopic: null,
            subTopic: null,
            lastArtifact: null,
            mode: isLearningMode ? 'learning' : 'chat',
          },
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
      let orchestrationMetadata = {};

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

            if (data.type === 'text_delta' && !isArtifactOnlyResponse) {
              fullText += data.text;
            } else if (data.type === 'orchestration_decision') {
              orchestrationMetadata = {
                decision: data.decision || null,
                activeTopic: data.activeTopic || data.decision?.activeTopic || null,
                conversationState: data.conversationState || data.decision?.conversationState || null,
                suggestedActions: data.suggestedActions || [],
                adaptiveExplanation: data.adaptiveExplanation || null,
                responseKind: data.responseKind || null,
              };
            } else if (data.type === 'error') {
              throw new Error(data.error || 'Failed to generate response');
            }
          }
        }
      }

      // 4. Generate learning content only when the user explicitly selected a learning action.
      fullText = sanitizeAssistantResponse(fullText);
      let learningContent = null;
      let factCheck = null;
      let visual3d = null;
      const effectiveArtifact = requestedArtifact;
      if (shouldAttemptVisual3D(text, effectiveArtifact)) {
        visual3d = await generateVisual3D(orchestrationMetadata.activeTopic || text, accessToken).catch((err) => ({
          topic: orchestrationMetadata.activeTopic || text,
          unavailable: true,
          error: err?.message || '3D is not available for this topic.',
        }));
      }
      const shouldGenerateLearningArtifact = Boolean(effectiveArtifact && effectiveArtifact !== '3d_scene' && (isLearningMode || pendingArtifact));
      if (shouldGenerateLearningArtifact) try {
        const lcHeaders = { 'Content-Type': 'application/json' };
        if (accessToken) {
          lcHeaders['Authorization'] = `Bearer ${accessToken}`;
        }

        const learningQuery = effectiveArtifact === 'summarize'
          ? 'Summarize the uploaded document'
          : orchestrationMetadata.activeTopic || text;

        const lcResponse = await fetch(`${API_BASE}/api/learning-content`, {
          method: 'POST',
          headers: lcHeaders,
          body: JSON.stringify({
            query: learningQuery,
            userId: user.id,
            contentType: artifactToContentType(effectiveArtifact),
            conversationId: conversation.id,
            documentId: activeDocumentId,
            webSearch: useWebSearch,
            preferences: { mode: isLearningMode ? 'learning' : 'chat' },
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
              requestedArtifact: effectiveArtifact || null,
              learningContent,
              factCheck,
              visual3d,
              ...orchestrationMetadata,
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
      navigate((isLearningMode || shouldGenerateLearningArtifact) ? `/learn/${conversation.id}` : `/chat/${conversation.id}`);

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
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {isLearningMode ? 'Explore a topic deeply' : 'What do you want to know?'}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isLearningMode
              ? 'Start with Learn, then move through quiz, flashcards, mind map, simulation, and 3D.'
              : 'Ask a question for a concise answer. Visuals appear only when requested or clearly useful.'}
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
            {(showDocuments || uploadProgress) && (
              <div className="space-y-3">
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

            {pendingArtifact === 'video' && (
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Video generation</p>
                    <p className="text-xs text-muted-foreground">Choose video settings before sending your topic.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingArtifact(null)}
                    className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Cancel video generation"
                    title="Cancel"
                  >
                    x
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    Duration
                    <select
                      value={videoOptions.durationSeconds}
                      onChange={event => setVideoOptions(prev => ({ ...prev, durationSeconds: Number(event.target.value) }))}
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    >
                      <option value={30}>30 seconds</option>
                      <option value={60}>60 seconds</option>
                      <option value={90}>90 seconds</option>
                      <option value={120}>120 seconds</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Audience
                    <select
                      value={videoOptions.audience}
                      onChange={event => setVideoOptions(prev => ({ ...prev, audience: event.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    >
                      <option value="middle school students">Middle school</option>
                      <option value="high school students">High school</option>
                      <option value="college students">College</option>
                      <option value="curious learner">Curious learner</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Quality
                    <select
                      value={videoOptions.quality}
                      onChange={event => setVideoOptions(prev => ({ ...prev, quality: event.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    >
                      <option value="draft">Draft</option>
                      <option value="final">Final</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {/* Input */}
            <InputBar
              onSend={handleSendMessage}
              inputDisabled={isLoading}
              webSearchEnabled={webSearchEnabled}
              selectedTools={selectedInputTools}
              onToggleWebSearch={() => {
                setWebSearchEnabled(prev => {
                  const next = !prev;
                  if (next && selectedDocumentId) setSelectedDocumentId(null);
                  return next;
                });
              }}
              onDocumentUpload={() => setShowDocuments(true)}
              onGenerateArtifact={(artifact) => {
                setPendingArtifact(artifact);
                if (artifact === 'summarize') setShowDocuments(true);
              }}
            />

            {/* Recent Suggestions */}
            {recentSuggestions.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground text-center font-medium uppercase tracking-wider">
                  Recent topics
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {recentSuggestions.map((suggestion, idx) => (
                    <button
                      key={`${suggestion.text}-${idx}`}
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
