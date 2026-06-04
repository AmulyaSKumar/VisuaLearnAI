import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import { useLearningState } from "../hooks/useLearningState";
import { useBehaviorTracking } from "../hooks/useBehaviorTracking";
import { useAuth } from "../contexts/AuthContext";
import { usePersona } from "../contexts/PersonaContext";
import MessageRenderer from "./MessageRenderer";
import InputBar from "./InputBar";
import DocumentUpload from "./DocumentUpload";
import LearningPlanCard from "./LearningPlanCard";
import LearningPlanInput from "./LearningPlanInput";
import LearningStatePanel from "./LearningStatePanel";
import SessionSummary from "./SessionSummary";
import PersonaBadge from "./PersonaBadge";
import SaveToNotionButton from "./SaveToNotionButton";
import { useDocuments } from "../hooks/useDocuments";
import { supabase, updateConversation } from "../lib/supabase";
import { shouldAttemptVisual3D } from "../utils/visual3d";
import { isVideoRequest } from "../utils/videoGeneration";

const ARTIFACT_TABS = {
  learn: 'text',
  quiz: 'quiz',
  flashcards: 'flashcards',
  mindmap: 'mindmap',
  simulation: 'simulation',
  '3d_scene': '3d',
  video: 'video',
};

const ARTIFACT_LABELS = {
  learn: 'Learn Deeply',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map',
  simulation: 'Simulation',
  '3d_scene': '3D Visualization',
  video: 'Video Generation',
};

const INLINE_LEARNING_ARTIFACTS = new Set(['quiz', 'flashcards', 'mindmap']);
const SUPPRESS_ASSET_ARTIFACTS = new Set(['quiz', 'flashcards', 'mindmap', 'simulation', 'video']);

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

export default function ChatWindow({
  onConversationCreated = null,
  onConversationUpdated = null,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: conversationId } = useParams();
  const { user, session } = useAuth();
  const { defaultPersona } = usePersona();
  const userId = user?.id;
  const accessToken = session?.access_token;
  const {
    documents,
    uploadProgress,
    upload: uploadDocument,
  } = useDocuments();

  // Chat state
  const {
    messages,
    isStreaming,
    currentStreamedMessage,
    isLoadingWidget,
    sendMessage,
    personalizationMeta,
    assets,
    plan,
    isPlanLoading,
    generateLearningPlan,
    learningContent,
    isLearningContentLoading,
    generateLearningContent,
    trackInteraction,
  } = useChat(conversationId || null, userId, onConversationCreated, onConversationUpdated, accessToken);

  // Learning state management
  const learningState = useLearningState(userId, accessToken);

  // Behavior tracking
  const behaviorTracking = useBehaviorTracking(userId, accessToken);

  // Local state
  const sentRef = useRef(false);
  const [showPlanInput, setShowPlanInput] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [sessionData, setSessionData] = useState({});
  const [showStatePanel, setShowStatePanel] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);
  const [pendingArtifact, setPendingArtifact] = useState(null);
  const [videoOptions, setVideoOptions] = useState({
    durationSeconds: 60,
    audience: 'high school students',
    quality: 'final',
  });
  const [learningWorkspaceInitialTab, setLearningWorkspaceInitialTab] = useState('text');
  const [conversationMode, setConversationMode] = useState('chat');
  const cognitiveStatesRef = useRef([]);
  const topicsRef = useRef([]);
  const selectedDocument = documents.find(doc => doc.id === selectedDocumentId);
  const isLearningConversation = conversationMode === 'learning';
  const conversationHeaderTitle = isLearningConversation ? 'Learning Session' : 'New Conversation';
  const selectedInputTools = useMemo(() => {
    const tools = [];

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
    } else if (showDocumentUpload) {
      tools.push({
        id: 'upload-document',
        label: 'Upload document',
        onRemove: () => setShowDocumentUpload(false),
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
  }, [pendingArtifact, selectedDocument, selectedDocumentId, showDocumentUpload, videoOptions.durationSeconds, videoOptions.quality, webSearchEnabled]);

  useEffect(() => {
    if (!conversationId || !userId) {
      setConversationMode('chat');
      return undefined;
    }

    let cancelled = false;

    const loadConversationMode = async () => {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('metadata')
          .eq('id', conversationId)
          .eq('user_id', userId)
          .single();

        if (error) throw error;
        if (!cancelled) {
          const persistedMode = data?.metadata?.mode === 'learning' ? 'learning' : 'chat';
          setConversationMode(persistedMode);
          if (persistedMode === 'learning') {
            navigate(`/learn/${conversationId}`, { replace: true });
          }
        }
      } catch (error) {
        console.warn('Failed to load conversation mode:', error);
        if (!cancelled) setConversationMode('chat');
      }
    };

    loadConversationMode();

    return () => {
      cancelled = true;
    };
  }, [conversationId, navigate, userId]);

  // Update learning state from personalization metadata
  useEffect(() => {
    if (personalizationMeta) {
      learningState.updateFromPersonalizationMeta(personalizationMeta);

      // Track cognitive states
      if (personalizationMeta.cognitiveState) {
        cognitiveStatesRef.current.push(personalizationMeta.cognitiveState);
      }

      // Track topics
      if (personalizationMeta.topic && !topicsRef.current.includes(personalizationMeta.topic)) {
        topicsRef.current.push(personalizationMeta.topic);
      }
    }
  }, [personalizationMeta, learningState]);

  // Handle initial message from navigation
  useEffect(() => {
    if (location.state?.initialMessage && messages.length === 0 && !isStreaming && !sentRef.current) {
      sentRef.current = true;
      sendMessage(location.state.initialMessage);
      window.history.replaceState({}, document.title);
    }
  }, [isStreaming, location.state, messages.length, sendMessage]);

  // Track follow-ups when sending messages
  const handleSendMessage = useCallback(async (text) => {
    behaviorTracking.trackFollowUp();
    const requestedArtifact = pendingArtifact || inferExplicitArtifact(text);
    const shouldOpenLearningMode = conversationMode === 'learning' || requestedArtifact === 'learn';
    if (requestedArtifact) {
      setLearningWorkspaceInitialTab(ARTIFACT_TABS[requestedArtifact] || 'text');
    }

    await sendMessage(text, {
      documentId: selectedDocumentId,
      webSearch: webSearchEnabled && !selectedDocumentId,
      requestedArtifact,
      videoOptions: requestedArtifact === 'video' ? videoOptions : null,
      mode: shouldOpenLearningMode ? 'learning' : conversationMode,
    });

    if (requestedArtifact === 'learn' && conversationId && userId) {
      const { data } = await supabase
        .from('conversations')
        .select('metadata')
        .eq('id', conversationId)
        .eq('user_id', userId)
        .single();
      const updatedConversation = await updateConversation(userId, conversationId, {
        metadata: {
          ...(data?.metadata || {}),
          mode: 'learning',
        },
      });
      onConversationUpdated?.(conversationId, updatedConversation);
      navigate(`/learn/${conversationId}`);
    }

    setSelectedDocumentId(null);
    setShowDocumentUpload(false);
    setPendingArtifact(null);
  }, [
    behaviorTracking,
    conversationId,
    conversationMode,
    navigate,
    onConversationUpdated,
    pendingArtifact,
    selectedDocumentId,
    sendMessage,
    userId,
    videoOptions,
    webSearchEnabled,
  ]);

  const latestMessage = messages[messages.length - 1] || null;
  const suppressExternalAssets = SUPPRESS_ASSET_ARTIFACTS.has(pendingArtifact)
    || SUPPRESS_ASSET_ARTIFACTS.has(currentStreamedMessage?.metadata?.requestedArtifact)
    || SUPPRESS_ASSET_ARTIFACTS.has(latestMessage?.metadata?.requestedArtifact);
  const latestHasInlineLearningArtifact = latestMessage?.role === 'assistant'
    && INLINE_LEARNING_ARTIFACTS.has(latestMessage?.metadata?.requestedArtifact)
    && latestMessage?.metadata?.learningContent;

  const handleDocumentUpload = useCallback(async (file) => {
    const document = await uploadDocument(file);
    if (document?.id) {
      setSelectedDocumentId(document.id);
      setShowDocumentUpload(false);
      setWebSearchEnabled(false);
    }
    return document;
  }, [uploadDocument]);

  const getArtifactQueryFromContext = useCallback(() => {
    const recent = [...messages]
      .filter(message => message.role === 'user' || message.role === 'assistant')
      .slice(-6)
      .map(message => `${message.role}: ${message.content || message.text || ''}`)
      .filter(Boolean)
      .join('\n');

    return recent || '';
  }, [messages]);

  const handleGenerateArtifact = useCallback(async (artifact) => {
    const query = getArtifactQueryFromContext();
    if (!query || !isLearningConversation || conversationId) {
      setPendingArtifact(artifact);
      return;
    }

    setLearningWorkspaceInitialTab(ARTIFACT_TABS[artifact] || 'text');
    await generateLearningContent(
      query,
      userId,
      true,
      accessToken,
      { requestedArtifact: artifact },
      {
        conversationId,
        documentId: selectedDocumentId,
        webSearch: webSearchEnabled && !selectedDocumentId,
      },
    );
  }, [
    accessToken,
    conversationId,
    generateLearningContent,
    getArtifactQueryFromContext,
    isLearningConversation,
    selectedDocumentId,
    userId,
    webSearchEnabled,
  ]);

  // Handle learning plan step click
  const handleStepClick = (step) => {
    const message = `Teach me about: ${step.title}. ${step.description || ''}`;
    handleSendMessage(message);
  };

  // Handle plan generation
  const handleGeneratePlan = async (goal) => {
    try {
      await generateLearningPlan(goal, true);
      setShowPlanInput(false);
    } catch (error) {
      console.error('Failed to generate plan:', error);
    }
  };

  // Show session summary
  const handleShowSessionSummary = useCallback(() => {
    const summary = behaviorTracking.getSessionSummary();
    setSessionData({
      ...summary,
      cognitiveStates: cognitiveStatesRef.current,
      topics: topicsRef.current,
    });
    setShowSessionSummary(true);
  }, [behaviorTracking]);

  // Handle widget interactions
  const handleWidgetInteraction = useCallback((data) => {
    behaviorTracking.trackWidgetInteraction(data.widgetId, data.action, data.data);
    if (userId && accessToken) {
      trackInteraction(
        userId,
        data.action === 'widget_analytics' ? 'widget_analytics' : 'widget_interaction',
        {
          ...data.data,
          widgetId: data.widgetId,
          action: data.action,
          decisionId: data.decisionId || personalizationMeta?.decisionId || null,
          selectedAction: data.selectedAction || personalizationMeta?.selectedAction || null,
          topicKey: data.topicKey || personalizationMeta?.topicKey || null,
          eventId: data.data?.eventId || `${data.widgetId}:${data.action}:${Date.now()}`,
        },
        accessToken,
      );
    }
  }, [accessToken, behaviorTracking, personalizationMeta, trackInteraction, userId]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Top Bar with Learning State Panel */}
      <div className="flex-shrink-0 border-b border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {conversationHeaderTitle}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {isLearningConversation ? 'Topic learning workspace' : 'Conversational chat'}
              </p>
            </div>

            {isLearningConversation && showStatePanel ? (
              <LearningStatePanel
                cognitiveState={learningState.cognitiveState}
                learningStyle={learningState.learningStyle}
                confidenceScore={learningState.confidenceScore}
                currentTopic={learningState.currentTopic}
                strategy={learningState.strategy}
                weakTopics={learningState.weakTopics}
                strongTopics={learningState.strongTopics}
                isCompact={true}
              />
            ) : isLearningConversation ? (
              <button
                onClick={() => setShowStatePanel(true)}
                className="flex items-center gap-2 px-2 sm:px-3 py-1.5 min-h-[36px] bg-muted/50 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                  <path d="M12 6v6l4 2" />
                </svg>
                <span className="hidden sm:inline">Show Learning State</span>
                <span className="sm:hidden">State</span>
              </button>
            ) : null}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Active Persona Badge */}
            {defaultPersona && <PersonaBadge persona={defaultPersona} />}

            <button
              type="button"
              onClick={() => navigate("/chat/new")}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="New chat"
              title="New chat"
            >
              <svg className="h-4 w-4" viewBox="0 0 15 15" fill="none">
                <path d="M8 2.75C8 2.47386 7.77614 2.25 7.5 2.25C7.22386 2.25 7 2.47386 7 2.75V7H2.75C2.47386 7 2.25 7.22386 2.25 7.5C2.25 7.77614 2.47386 8 2.75 8H7V12.25C7 12.5261 7.22386 12.75 7.5 12.75C7.77614 12.75 8 12.5261 8 12.25V8H12.25C12.5261 8 12.75 7.77614 12.75 7.5C12.75 7.22386 12.5261 7 12.25 7H8V2.75Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
              </svg>
            </button>

            <SaveToNotionButton mode="chat" scope="conversation" />

            {/* Session Summary Button */}
            {isLearningConversation && messages.length > 2 && (
              <button
                onClick={handleShowSessionSummary}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                  <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                Summary
              </button>
            )}

            {/* Collapse State Panel */}
            {isLearningConversation && showStatePanel && (
              <button
                onClick={() => setShowStatePanel(false)}
                className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                title="Hide learning state"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Learning Plan Section */}
      {isLearningConversation && (showPlanInput || plan || isPlanLoading) && (
        <div className="flex-shrink-0 max-h-[40vh] overflow-y-auto p-4 md:p-6 border-b border-border/50 bg-muted/20">
          {showPlanInput && !plan && (
            <LearningPlanInput
              onGenerate={handleGeneratePlan}
              isLoading={isPlanLoading}
            />
          )}

          {(plan || isPlanLoading) && (
            <div className="mx-auto max-w-5xl">
              <LearningPlanCard
                plan={plan}
                isLoading={isPlanLoading}
                onStepClick={handleStepClick}
              />
            </div>
          )}
        </div>
      )}

      {/* Message List */}
      <MessageRenderer
        mode={conversationMode}
        messages={messages}
        currentStreamedMessage={currentStreamedMessage}
        isLoadingWidget={isLoadingWidget}
        factCheck={suppressExternalAssets ? null : assets.factCheck}
        images={suppressExternalAssets ? [] : assets.images}
        userId={userId}
        conversationId={conversationId}
        accessToken={accessToken}
        onWidgetInteraction={handleWidgetInteraction}
        learningContent={latestHasInlineLearningArtifact ? null : learningContent}
        isLearningContentLoading={latestHasInlineLearningArtifact ? false : isLearningContentLoading}
        onLearningInteraction={trackInteraction}
        learningWorkspaceInitialTab={learningWorkspaceInitialTab}
      />

      {/* Input Area */}
      <div className="mx-auto w-full max-w-5xl flex-shrink-0 bg-background p-3 pt-2 sm:p-4 md:p-6">
        {/* Plan Toggle Button */}
        {isLearningConversation && !showPlanInput && !plan && messages.length === 0 && (
          <div className="mb-3 sm:mb-4 flex justify-center">
            <button
              onClick={() => setShowPlanInput(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 min-h-[44px] bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="hidden sm:inline">Create a Learning Plan</span>
              <span className="sm:hidden">Learning Plan</span>
            </button>
          </div>
        )}

        {(showDocumentUpload || uploadProgress) && (
          <div className="mb-3 space-y-2">
            {(showDocumentUpload || uploadProgress) && (
              <DocumentUpload
                compact
                onUpload={handleDocumentUpload}
                uploadProgress={uploadProgress}
                disabled={isStreaming || isPlanLoading}
              />
            )}
          </div>
        )}

        {pendingArtifact === 'video' && (
          <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-sm">
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

        <InputBar
          onSend={handleSendMessage}
          inputDisabled={isStreaming || isPlanLoading}
          webSearchEnabled={webSearchEnabled}
          selectedTools={selectedInputTools}
          onToggleWebSearch={() => {
            setWebSearchEnabled(prev => {
              const next = !prev;
              if (next) setSelectedDocumentId(null);
              return next;
            });
          }}
          onGenerateArtifact={handleGenerateArtifact}
          onDocumentUpload={() => setShowDocumentUpload(prev => !prev)}
        />
        <div className="text-center mt-2 sm:mt-3">
          <p className="text-[10px] sm:text-xs text-muted-foreground">
            Ask anything and continue learning at your own pace.
          </p>
        </div>
      </div>

      {/* Session Summary Modal */}
      <SessionSummary
        isOpen={showSessionSummary}
        onClose={() => setShowSessionSummary(false)}
        sessionData={sessionData}
        userId={userId}
        accessToken={accessToken}
      />
    </div>
  );
}
