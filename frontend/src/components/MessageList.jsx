import { useCallback, useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import FeedbackButtons from "./FeedbackButtons";
import LearningFeedbackButtons from "./LearningFeedbackButtons";
import FactCheckBadge from "./FactCheckBadge";
import ImageWidget from "./ImageWidget";
import LearningWorkspace from "./LearningWorkspace";
import SimulationView from "./learning/SimulationView";
import Visual3DView from "./visual3d/Visual3DView";
import VideoGenerationView from "./video/VideoGenerationView";
import SaveToNotionButton from "./SaveToNotionButton";
import {
  getAvailableBlockTypes,
  getMessageContentBlocks,
} from "../utils/contentBlocks";

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
  const text = stripMarkdown(String(message.text || message.content || ''));
  return text ? text.slice(0, 90) : 'Previous response';
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~#>|]/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMessageText(message) {
  return stripMarkdown(message?.content || message?.text || '');
}

function getCollapsedResponsePreview(message) {
  const text = getMessageText(message);
  if (text) return text.slice(0, 140);
  const artifact = message?.metadata?.requestedArtifact;
  if (artifact === 'quiz') return 'Quiz ready';
  if (artifact === 'flashcards') return 'Flashcards ready';
  if (artifact === 'mindmap') return 'Mind map ready';
  if (artifact === 'simulation') return 'Simulation ready';
  if (artifact === '3d_scene') return '3D visualization ready';
  if (artifact === 'video') return 'Video generation ready';
  return 'Response ready';
}

function artifactToWorkspaceTab(artifact) {
  if (artifact === 'quiz') return 'quiz';
  if (artifact === 'flashcards') return 'flashcards';
  if (artifact === 'mindmap') return 'mindmap';
  if (artifact === 'simulation') return 'simulation';
  if (artifact === '3d_scene') return '3d';
  if (artifact === 'video') return 'video';
  return 'text';
}

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

function getArtifactLabel(message) {
  const artifact = message?.metadata?.requestedArtifact || message?.metadata?.decision?.artifacts?.[0] || null;
  return artifact ? ARTIFACT_LABELS[artifact] || String(artifact).replace(/_/g, ' ') : null;
}

const ARTIFACT_ONLY_RESPONSES = new Set(['quiz', 'flashcards', 'mindmap', 'simulation', 'video']);
export default function MessageList({ messages, currentStreamedMessage, isLoadingWidget, factCheck = null, images = [], userId = null, conversationId = null, accessToken = null, learningContent = null, isLearningContentLoading = false, onLearningInteraction = null, learningWorkspaceInitialTab = 'text', allowLearningWorkspace = false }) {
  const scrollRef = useRef(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [expandedMessageIds, setExpandedMessageIds] = useState(() => new Set());
  const [collapsedMessageIds, setCollapsedMessageIds] = useState(() => new Set());
  const freezeAutoScrollRef = useRef(false);

  const expandMessage = useCallback((messageId) => {
    setExpandedMessageIds(previous => {
      const next = new Set(previous);
      next.add(messageId);
      return next;
    });
    setCollapsedMessageIds(previous => {
      const next = new Set(previous);
      next.delete(messageId);
      return next;
    });
  }, []);

  const collapseMessage = useCallback((messageId) => {
    setCollapsedMessageIds(previous => {
      const next = new Set(previous);
      next.add(messageId);
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
          const nextIsCollapsibleAssistant = nextMessage?.role === "assistant"
            && nextMessage.id !== "streaming-now";
          const nextAssistantKey = nextIsCollapsibleAssistant ? String(nextMessage.id || idx + 1) : null;
          const isNextAssistantOlder = nextIsCollapsibleAssistant && idx + 1 !== latestAssistantIndex;
          const isTurnCollapsed = nextAssistantKey
            ? collapsedMessageIds.has(nextAssistantKey) || (isNextAssistantOlder && !expandedMessageIds.has(nextAssistantKey))
            : false;
          const artifactLabel = getArtifactLabel(msg) || (msg.role === 'user' ? getArtifactLabel(nextMessage) : null);

          if (msg.role === "user" && nextIsCollapsibleAssistant) {
            if (isTurnCollapsed) {
              return (
                <div key={`${messageKey}:${nextAssistantKey}`} className="flex flex-col items-start gap-2">
                  <div className="flex w-full max-w-4xl items-start gap-3 rounded-lg border border-border bg-background/80 px-4 py-3 shadow-sm transition hover:border-foreground/20 hover:bg-muted/30">
                    <button
                      type="button"
                      onClick={() => expandMessage(nextAssistantKey)}
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
                      onClick={() => expandMessage(nextAssistantKey)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">
                        {getMessageText(msg) || 'Question'}
                      </span>
                      {artifactLabel && (
                        <span className="mt-1 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {artifactLabel}
                        </span>
                      )}
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
          const isAssistantCollapsed = msg.role === "assistant"
            && msg.id !== "streaming-now"
            && (
              collapsedMessageIds.has(messageKey)
              || (isOlderAssistant && !expandedMessageIds.has(messageKey))
            );
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
          const visual3dTopic = msg.metadata?.visual3d?.topic
            || msg.metadata?.activeTopic
            || msg.metadata?.decision?.activeTopic
            || msg.topic
            || getMessageText(previousMessage);
          const shouldRenderVisual3D = msg.role === "assistant"
            && msg.id !== "streaming-now"
            && !isAssistantCollapsed
            && (
              msg.metadata?.requestedArtifact === '3d_scene'
              || msg.metadata?.decision?.scene3D?.requested
              || msg.metadata?.visual3d
            );
          const shouldRenderVideo = msg.role === "assistant"
            && msg.id !== "streaming-now"
            && !isAssistantCollapsed
            && (msg.metadata?.requestedArtifact === 'video' || msg.metadata?.video);
          const inlineLearningContent = msg.role === "assistant" && !isAssistantCollapsed
            ? msg.metadata?.learningContent
            : null;
          const shouldRenderInlineLearningWorkspace = inlineLearningContent
            && msg.metadata?.requestedArtifact !== 'simulation';
          const contentBlocks = msg.role === "assistant"
            ? getMessageContentBlocks(msg, previousMessage?.role === "user" ? previousMessage : null)
            : [];
          const availableBlockTypes = getAvailableBlockTypes(contentBlocks);
          const saveAction = msg.role === "assistant" && msg.id !== "streaming-now" && contentBlocks.length > 0
            ? (
              <SaveToNotionButton
                mode="chat"
                scope="response"
                messageId={messageKey}
                availableBlockTypes={availableBlockTypes}
                compact
              />
            )
            : null;

          if (isAssistantCollapsed) {
            const collapsedTitle = getCollapsedAssistantTitle(msg, inlineSimulationTopic);
            return (
              <div key={messageKey} className="flex flex-col items-start gap-2">
                <div className="flex w-full max-w-4xl items-start gap-3 rounded-lg border border-border bg-background/80 px-4 py-3 shadow-sm transition hover:border-foreground/20 hover:bg-muted/30">
                  <button
                    type="button"
                    onClick={() => expandMessage(messageKey)}
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
                    onClick={() => expandMessage(messageKey)}
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
            {/* User Message */}
            {msg.role === "user" && (
              <div className="relative bg-primary/10 text-foreground px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] sm:max-w-[75%] border border-primary/20 shadow-sm">
                {artifactLabel && (
                  <span className="mb-1.5 inline-flex rounded-full border border-primary/20 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-primary">
                    {artifactLabel}
                  </span>
                )}
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

            {msg.role === "assistant" && (!msg.text || isArtifactOnlyResponse) && msg.id !== "streaming-now" && (
              <div className="flex w-full max-w-4xl flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => collapseMessage(messageKey)}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Collapse response"
                    title="Collapse"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  </button>
                  <span>{msg.metadata?.requestedArtifact ? `${msg.metadata.requestedArtifact} response` : 'Assistant response'}</span>
                  {saveAction}
                </div>
              </div>
            )}

            {/* Assistant Text */}
            {msg.role === "assistant" && msg.text && !isArtifactOnlyResponse && (
              <div className="group flex w-full max-w-4xl gap-2 sm:gap-3">
                {msg.id !== "streaming-now" && (
                  <button
                    type="button"
                    onClick={() => collapseMessage(messageKey)}
                    className="mt-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Collapse response"
                    title="Collapse"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m18 15-6-6-6 6" />
                    </svg>
                  </button>
                )}
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
                    saveAction={saveAction}
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

            {shouldRenderVisual3D && visual3dTopic && (
              <div className="my-2 w-full max-w-4xl">
                <Visual3DView
                  topic={visual3dTopic}
                  accessToken={accessToken}
                  visual3d={msg.metadata?.visual3d || null}
                  autoFetch={!msg.metadata?.visual3d}
                />
              </div>
            )}

            {shouldRenderVideo && (
              <div className="my-2 w-full max-w-4xl">
                <VideoGenerationView
                  topic={msg.metadata?.activeTopic || msg.topic || getMessageText(previousMessage)}
                  accessToken={accessToken}
                  video={msg.metadata?.video || null}
                  autoStart={!msg.metadata?.video}
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
              accessToken={accessToken}
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
