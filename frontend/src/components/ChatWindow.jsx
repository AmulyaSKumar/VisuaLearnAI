import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, Link, useParams } from "react-router-dom";
import { useChat } from "../hooks/useChat";
import { useLearningState } from "../hooks/useLearningState";
import { useBehaviorTracking } from "../hooks/useBehaviorTracking";
import useRealtimeAudio, { VOICE_STATES } from "../hooks/useRealtimeAudio";
import { useAuth } from "../contexts/AuthContext";
import { usePersona } from "../contexts/PersonaContext";
import MessageList from "./MessageList";
import InputBar from "./InputBar";
import DocumentUpload from "./DocumentUpload";
import VoiceOverlay from "./VoiceOverlay";
import VoiceIndicator from "./VoiceIndicator";
import VoiceToggleButton from "./VoiceToggleButton";
import LearningPlanCard from "./LearningPlanCard";
import LearningPlanInput from "./LearningPlanInput";
import AssetProgress from "./AssetProgress";
import LearningStatePanel from "./LearningStatePanel";
import SessionSummary from "./SessionSummary";
import Widget3DSkeleton from "./Widget3DSkeleton";
import PersonaBadge from "./PersonaBadge";
import { useDocuments } from "../hooks/useDocuments";

const ARTIFACT_TABS = {
  learn: 'text',
  quiz: 'quiz',
  flashcards: 'flashcards',
  mindmap: 'mindmap',
  simulation: 'simulation',
  summarize: 'text',
};

const ARTIFACT_LABELS = {
  learn: 'Learn Deeply',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map',
  simulation: 'Simulation',
  summarize: 'Document Summary',
};

export default function ChatWindow({
  onConversationCreated = null,
  onConversationUpdated = null,
}) {
  const location = useLocation();
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
    addVoiceMessage,
    personalizationMeta,
    assets,
    isAssetStreaming,
    assetProgress,
    plan,
    isPlanLoading,
    generateLearningPlan,
    learningContent,
    isLearningContentLoading,
    generateLearningContent,
    trackInteraction,
    // 3D widget generation (separate from chat)
    is3DLoading,
  } = useChat(conversationId || null, userId, onConversationCreated, onConversationUpdated, accessToken);

  // Learning state management
  const learningState = useLearningState(userId);

  // Behavior tracking
  const behaviorTracking = useBehaviorTracking(userId);

  // Voice transcripts callback - adds messages to chat UI
  const handleVoiceTranscript = useCallback((role, text, messageId) => {
    // This is called when backend saves a voice message
    // Add to chat UI state (message is already in DB)
    addVoiceMessage(role, text, messageId);
  }, [addVoiceMessage]);

  // Voice with full integration
  const voice = useRealtimeAudio({
    conversationId: conversationId || null,
    accessToken,
    personaId: defaultPersona?.id,
    onTranscript: handleVoiceTranscript,
  });

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
  const [learningWorkspaceInitialTab, setLearningWorkspaceInitialTab] = useState('text');
  const cognitiveStatesRef = useRef([]);
  const topicsRef = useRef([]);
  const selectedDocument = documents.find(doc => doc.id === selectedDocumentId);

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
    const requestedArtifact = pendingArtifact;
    if (requestedArtifact) {
      setLearningWorkspaceInitialTab(ARTIFACT_TABS[requestedArtifact] || 'text');
    }

    await sendMessage(text, {
      documentId: selectedDocumentId,
      webSearch: webSearchEnabled && !selectedDocumentId,
      requestedArtifact,
    });

    setSelectedDocumentId(null);
    setShowDocumentUpload(false);
    setPendingArtifact(null);
  }, [behaviorTracking, pendingArtifact, selectedDocumentId, sendMessage, webSearchEnabled]);

  const handleDocumentUpload = useCallback(async (file) => {
    const document = await uploadDocument(file);
    if (document?.id) {
      setSelectedDocumentId(document.id);
      setShowDocumentUpload(false);
      setWebSearchEnabled(false);
    }
    return document;
  }, [uploadDocument]);

  const getArtifactQueryFromContext = useCallback((artifact) => {
    if (artifact === 'summarize') return 'Summarize the uploaded document';

    const recent = [...messages]
      .filter(message => message.role === 'user' || message.role === 'assistant')
      .slice(-6)
      .map(message => `${message.role}: ${message.content || message.text || ''}`)
      .filter(Boolean)
      .join('\n');

    return recent || '';
  }, [messages]);

  const handleGenerateArtifact = useCallback(async (artifact) => {
    const query = getArtifactQueryFromContext(artifact);

    if (!query) {
      setPendingArtifact(artifact);
      return;
    }

    if (artifact === 'summarize' && !selectedDocumentId) {
      setPendingArtifact(artifact);
      setShowDocumentUpload(true);
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
    if (userId) {
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
          {/* Learning State Panel Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {showStatePanel ? (
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
            ) : (
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
            )}
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Voice Toggle Button */}
            <VoiceToggleButton
              state={voice.state}
              onToggle={() => voice.isActive ? voice.stop() : voice.start()}
              disabled={!accessToken}
            />

            {/* Active Persona Badge */}
            {defaultPersona && <PersonaBadge persona={defaultPersona} />}

            {/* Dashboard Link */}
            <Link
              to="/dashboard"
              className="flex items-center justify-center gap-1.5 px-2 sm:px-3 py-1.5 min-h-[36px] min-w-[36px] text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            {/* Session Summary Button */}
            {messages.length > 2 && (
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
            {showStatePanel && (
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

      {/* Voice Indicator - shown when voice is active */}
      {voice.isActive && (
        <VoiceIndicator
          state={voice.state}
          transcript={voice.transcript}
          userTranscript={voice.userTranscript}
          sessionDuration={voice.sessionDuration}
          error={voice.error}
          onStop={voice.stop}
        />
      )}

      {/* Learning Plan Section */}
      {(showPlanInput || plan || isPlanLoading) && (
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

      {/* Asset Progress */}
      {(isAssetStreaming || assets.widgets.length > 0 || assets.images.length > 0) && (
        <div className="px-4 md:px-6 pt-4">
          <AssetProgress
            isStreaming={isAssetStreaming}
            progress={assetProgress}
            assets={assets}
          />
        </div>
      )}

      {/* Message List */}
      <MessageList
        messages={messages}
        currentStreamedMessage={currentStreamedMessage}
        isLoadingWidget={isLoadingWidget}
        factCheck={assets.factCheck}
        images={assets.images}
        userId={userId}
        onWidgetInteraction={handleWidgetInteraction}
        learningContent={learningContent}
        isLearningContentLoading={isLearningContentLoading}
        onLearningInteraction={trackInteraction}
        is3DLoading={is3DLoading}
        learningWorkspaceInitialTab={learningWorkspaceInitialTab}
      />

      {/* Input Area */}
      <div className="mx-auto w-full max-w-5xl flex-shrink-0 bg-background p-3 pt-2 sm:p-4 md:p-6">
        {/* Plan Toggle Button */}
        {!showPlanInput && !plan && messages.length === 0 && (
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

        {(webSearchEnabled || selectedDocument || pendingArtifact || showDocumentUpload || uploadProgress) && (
          <div className="mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
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

        <InputBar
          onSend={handleSendMessage}
          inputDisabled={isStreaming || isPlanLoading}
          voiceActive={voice.isActive}
          voiceState={voice.state}
          onVoiceStart={voice.start}
          onVoiceStop={voice.stop}
          webSearchEnabled={webSearchEnabled}
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

      {/* Voice conversation overlay */}
      <VoiceOverlay voice={voice} />

      {/* Session Summary Modal */}
      <SessionSummary
        isOpen={showSessionSummary}
        onClose={() => setShowSessionSummary(false)}
        sessionData={sessionData}
        userId={userId}
      />
    </div>
  );
}
