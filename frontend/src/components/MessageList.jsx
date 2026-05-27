import { useCallback, useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import FeedbackButtons from "./FeedbackButtons";
import LearningFeedbackButtons from "./LearningFeedbackButtons";
import FactCheckBadge from "./FactCheckBadge";
import ImageWidget from "./ImageWidget";
import LearningWorkspace from "./LearningWorkspace";
import SimulationView from "./learning/SimulationView";

function getSimulationDecision(message) {
  const decision = message.metadata?.decision || null;
  if (decision?.simulation?.needed || decision?.scene3D?.needed || decision?.simulation?.suggested) {
    return decision;
  }
  if (message.metadata?.requestedArtifact === 'simulation') {
    return {
      activeTopic: message.metadata?.activeTopic || message.topic || null,
      simulation: { needed: true, explicit: true, confidence: 0.96 },
      scene3D: { needed: false },
    };
  }
  return null;
}

function getCollapsedAssistantTitle(message, topic) {
  if (topic) return topic;
  if (message.topic) return message.topic;
  const text = String(message.text || message.content || '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 90) : 'Previous response';
}

function getMessageText(message) {
  return String(message?.content || message?.text || '').replace(/\s+/g, ' ').trim();
}

function getCollapsedResponsePreview(message) {
  const text = getMessageText(message);
  if (text) return text.slice(0, 140);
  const artifact = message?.metadata?.requestedArtifact;
  if (artifact === 'quiz') return 'Quiz ready';
  if (artifact === 'flashcards') return 'Flashcards ready';
  if (artifact === 'mindmap') return 'Mind map ready';
  if (artifact === 'simulation') return 'Simulation ready';
  return 'Response ready';
}

function artifactToWorkspaceTab(artifact) {
  if (artifact === 'quiz') return 'quiz';
  if (artifact === 'flashcards') return 'flashcards';
  if (artifact === 'mindmap') return 'mindmap';
  if (artifact === 'simulation') return 'simulation';
  return 'text';
}

const ARTIFACT_ONLY_RESPONSES = new Set(['quiz', 'flashcards', 'mindmap', 'simulation']);
export default function MessageList({ messages, currentStreamedMessage, isLoadingWidget, factCheck = null, images = [], userId = null, conversationId = null, accessToken = null, learningContent = null, isLearningContentLoading = false, onLearningInteraction = null, learningWorkspaceInitialTab = 'text', allowLearningWorkspace = false }) {
  const scrollRef = useRef(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [expandedMessageIds, setExpandedMessageIds] = useState(() => new Set());
  const freezeAutoScrollRef = useRef(false);

  const toggleMessageExpansion = useCallback((messageId) => {
    setExpandedMessageIds(previous => {
      const next = new Set(previous);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (!scrollRef.current) return;
    freezeAutoScrollRef.current = false;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior,
    });
    setShowJumpToLatest(false);
    setIsNearBottom(true);
  }, []);

  const updateScrollState = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return true;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
    freezeAutoScrollRef.current = !nearBottom;
    setIsNearBottom(nearBottom);
    setShowJumpToLatest(!nearBottom && Boolean(currentStreamedMessage || isLoadingWidget));
    return nearBottom;
  }, [currentStreamedMessage, isLoadingWidget]);

  useEffect(() => {
    const node = scrollRef.current;
    const nearBottomNow = node
      ? node.scrollHeight - node.scrollTop - node.clientHeight < 120
      : true;

    if (!freezeAutoScrollRef.current && (isNearBottom || nearBottomNow)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      scrollToBottom('smooth');
    } else if (currentStreamedMessage || isLoadingWidget) {
      setShowJumpToLatest(true);
    }
  }, [currentStreamedMessage, isLoadingWidget, isNearBottom, messages, scrollToBottom]);

  const allMessages = [...messages];
  if (currentStreamedMessage) {
    allMessages.push({ ...currentStreamedMessage, id: "streaming-now" });
  }
  const latestAssistantIndex = allMessages.reduce(
    (latestIndex, message, index) => (message.role === "assistant" ? index : latestIndex),
    -1,
  );
  if (allMessages.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      onScroll={updateScrollState}
      className="relative flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-4">
        {allMessages.map((msg, idx) => {
          const messageKey = String(msg.id || idx);
          const nextMessage = allMessages[idx + 1] || null;
          const previousMessage = allMessages[idx - 1] || null;
          const nextIsOlderAssistant = nextMessage?.role === "assistant"
            && nextMessage.id !== "streaming-now"
            && idx + 1 !== latestAssistantIndex;
          const nextAssistantKey = nextIsOlderAssistant ? String(nextMessage.id || idx + 1) : null;
          const isTurnCollapsed = nextAssistantKey ? !expandedMessageIds.has(nextAssistantKey) : false;

          if (msg.role === "user" && nextIsOlderAssistant) {
            if (isTurnCollapsed) {
              return (
                <div key={`${messageKey}:${nextAssistantKey}`} className="flex flex-col items-start gap-2">
                  <div className="flex w-full max-w-4xl items-start gap-3 rounded-lg border border-border bg-background/80 px-4 py-3 shadow-sm transition hover:border-foreground/20 hover:bg-muted/30">
                    <button
                      type="button"
                      onClick={() => toggleMessageExpansion(nextAssistantKey)}
                      className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      aria-label="Expand conversation"
                      title="Expand"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMessageExpansion(nextAssistantKey)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">
                        {getMessageText(msg) || 'Question'}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {getCollapsedResponsePreview(nextMessage)}
                      </span>
                    </button>
                  </div>
                </div>
              );
            }
          }

          const simulationDecision = msg.role === "assistant" ? getSimulationDecision(msg) : null;
          const inlineSimulationTopic = simulationDecision?.activeTopic || msg.metadata?.activeTopic || msg.topic || null;
          const explicitlyRequestedSimulation = msg.metadata?.requestedArtifact === 'simulation'
            || simulationDecision?.simulation?.explicit;
          const requestedArtifact = msg.metadata?.requestedArtifact || null;
          const isArtifactOnlyResponse = ARTIFACT_ONLY_RESPONSES.has(requestedArtifact);
          const isOlderAssistant = msg.role === "assistant"
            && msg.id !== "streaming-now"
            && idx !== latestAssistantIndex;
          const isAssistantCollapsed = isOlderAssistant && !expandedMessageIds.has(messageKey);
          if (
            isAssistantCollapsed
            && previousMessage?.role === "user"
          ) {
            return null;
          }
          const shouldRenderSimulation = explicitlyRequestedSimulation
            && simulationDecision
            && (simulationDecision.simulation?.needed || simulationDecision.scene3D?.needed)
            && msg.id !== "streaming-now"
            && !isAssistantCollapsed;
          const inlineLearningContent = msg.role === "assistant" && !isAssistantCollapsed
            ? msg.metadata?.learningContent
            : null;
          const shouldRenderInlineLearningWorkspace = inlineLearningContent
            && msg.metadata?.requestedArtifact !== 'simulation';

          if (isAssistantCollapsed) {
            const collapsedTitle = getCollapsedAssistantTitle(msg, inlineSimulationTopic);
            return (
              <div key={messageKey} className="flex flex-col items-start gap-2">
                <div className="flex w-full max-w-4xl items-start gap-3 rounded-lg border border-border bg-background/80 px-4 py-3 shadow-sm transition hover:border-foreground/20 hover:bg-muted/30">
                  <button
                    type="button"
                    onClick={() => toggleMessageExpansion(messageKey)}
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Expand conversation"
                    title="Expand"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMessageExpansion(messageKey)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-medium text-foreground">{collapsedTitle}</span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {getCollapsedResponsePreview(msg)}
                    </span>
                  </button>
                </div>
              </div>
            );
          }

          return (
          <div key={messageKey} className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.role === "user" && nextIsOlderAssistant && !isTurnCollapsed && (
              <div className="flex w-full max-w-4xl justify-start">
                <button
                  type="button"
                  onClick={() => toggleMessageExpansion(nextAssistantKey)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Collapse conversation"
                  title="Collapse"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                </button>
              </div>
            )}
            
            {/* User Message */}
            {msg.role === "user" && (
              <div className="relative bg-primary/10 text-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] sm:max-w-[75%] border border-primary/20 shadow-sm">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
              </div>
            )}

            {/* Assistant Images */}
            {msg.role === "assistant" && !isArtifactOnlyResponse && msg.images?.length > 0 && (
              <div className="my-2 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
                {msg.images.map((image, imgIdx) => (
                  <ImageWidget key={image.id || imgIdx} image={image} />
                ))}
              </div>
            )}

            {/* Assistant Text */}
            {msg.role === "assistant" && msg.text && !isArtifactOnlyResponse && (
              <div className="group flex w-full max-w-4xl gap-3 sm:gap-4">
                <div className="relative w-8 h-8 rounded-full bg-primary/15 flex-shrink-0 flex items-center justify-center text-primary shadow-sm mt-1">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <MessageBubble
                    content={msg.text}
                    showTTS={msg.id !== "streaming-now"}
                    isStreaming={msg.id === "streaming-now"}
                  />

                  {/* Fact Check Badge */}
                  {msg.factCheck && (
                    <FactCheckBadge factCheck={msg.factCheck} />
                  )}

                  {/* Learning Feedback Buttons */}
                  {msg.id !== "streaming-now" && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <FeedbackButtons
                          messageId={msg.id}
                          metadata={{ topic: msg.topic, hasWidgets: msg.widgets?.length > 0 }}
                        />
                      </div>
                      <LearningFeedbackButtons
                        messageId={msg.id}
                        userId={userId}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {shouldRenderSimulation && inlineSimulationTopic && (
              <div className="my-2 w-full max-w-4xl">
                <SimulationView
                  topic={inlineSimulationTopic}
                  userId={userId}
                  conversationId={conversationId}
                  accessToken={accessToken}
                  simulationDetection={{
                    ...(simulationDecision.simulationSupport || {
                    supported: true,
                    topic: inlineSimulationTopic,
                    confidence: simulationDecision.simulation?.confidence,
                    }),
                    decision: simulationDecision,
                  }}
                />
              </div>
            )}

            {shouldRenderInlineLearningWorkspace && (
              <div className="my-2 w-full max-w-4xl">
                <LearningWorkspace
                  content={inlineLearningContent}
                  isLoading={false}
                  userId={userId}
                  accessToken={accessToken}
                  onInteraction={onLearningInteraction}
                  initialTab={artifactToWorkspaceTab(msg.metadata?.requestedArtifact)}
                />
              </div>
            )}

          </div>
          );
        })}

        {/* Global Images (from asset stream) */}
        {images.length > 0 && (
          <div className="mx-auto w-full max-w-4xl">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Generated Images</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {images.map((image, idx) => (
                <ImageWidget key={image.id || idx} image={image} />
              ))}
            </div>
          </div>
        )}

        {/* Global Fact Check (from asset stream) */}
        {factCheck && (
          <div className="mx-auto mt-4 w-full max-w-4xl">
            <FactCheckBadge factCheck={factCheck} />
          </div>
        )}

        {/* Learning Workspace - shown after response completes */}
        {allowLearningWorkspace && (learningContent || isLearningContentLoading) && messages.length > 0 && !currentStreamedMessage && (
          <div className="mx-auto mt-6 w-full max-w-5xl">
            <LearningWorkspace
              key={learningWorkspaceInitialTab}
              content={learningContent}
              isLoading={isLearningContentLoading}
              userId={userId}
              onInteraction={onLearningInteraction}
              initialTab={learningWorkspaceInitialTab}
            />
          </div>
        )}
      </div>
      {showJumpToLatest && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="sticky bottom-4 left-1/2 z-20 mx-auto mt-4 block -translate-x-1/2 rounded-full border border-primary/20 bg-background/95 px-4 py-2 text-sm font-medium text-primary shadow-lg backdrop-blur hover:bg-primary/10"
        >
          <span aria-hidden="true">&darr;</span> Jump to latest
        </button>
      )}
    </div>
  );
}
