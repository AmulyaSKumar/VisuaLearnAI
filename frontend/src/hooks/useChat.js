import { useState, useCallback, useEffect, useRef } from "react";
import { useSSEStream } from "./useSSEStream";
import { useAssetStream } from "./useAssetStream";
import { useLearningPlan } from "./useLearningPlan";
import { useLearningContent } from "./useLearningContent";
import { usePersona } from "../contexts/PersonaContext";
import {
  supabase,
  createConversation,
  deleteConversation,
  getConversationMessages,
  updateConversation,
} from "../lib/supabase";
import {
  DEFAULT_CONVERSATION_TITLE,
  generateConversationTitle,
  shouldAutoGenerateConversationTitle,
} from "../utils/conversationActions";

const CHAT_ARTIFACTS_WITH_LEARNING_AGENTS = new Set(["quiz", "flashcards", "mindmap"]);
const ARTIFACT_ONLY_RESPONSES = new Set(["quiz", "flashcards", "mindmap", "simulation"]);
const SUPPRESS_ASSET_ARTIFACTS = new Set(["quiz", "flashcards", "mindmap", "simulation"]);

/**
 * useChat hook with Supabase message persistence and behavior tracking
 * @param {string} conversationId - Current conversation ID (from URL params)
 * @param {string} userId - Current user ID (from auth context)
 * @param {function} onConversationCreated - Callback when new conversation is created
 * @param {function} onConversationUpdated - Callback when a conversation changes
 * @param {string} accessToken - JWT access token for API authentication
 */
export function useChat(
  conversationId = null,
  userId = null,
  onConversationCreated = null,
  onConversationUpdated = null,
  accessToken = null,
) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const { startStream, currentMessage, isLoadingWidget, personalizationMeta } = useSSEStream();
  const { assets, isStreaming: isAssetStreaming, progress: assetProgress, startAssetStream } = useAssetStream();
  const { plan, isLoading: isPlanLoading, generatePlan } = useLearningPlan();
  const {
    content: learningContent,
    isLoading: isLearningContentLoading,
    generateContent: generateLearningContent,
    trackInteraction,
    clearContent,
  } = useLearningContent();

  // Get current persona from context
  const { defaultPersona } = usePersona();

  // Track current conversation ID (may be created on first message)
  const conversationIdRef = useRef(conversationId);

  // Behavior tracking for personalization
  const behaviorRef = useRef({
    messageCount: 0,
    totalMessageLength: 0,
    followUpCount: 0,
    lastMessageTime: null,
  });

  // Update ref when prop changes
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      setIsLoadingMessages(true);
      try {
        const dbMessages = await getConversationMessages(conversationId);
        // Transform DB format to UI format
        const uiMessages = dbMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          text: msg.content, // SSE uses 'text', DB uses 'content'
          metadata: msg.metadata || {},
          widgets: msg.metadata?.widgets || [],
          images: msg.metadata?.images || [],
          factCheck: msg.metadata?.factCheck || null,
          topic: msg.metadata?.activeTopic || msg.metadata?.decision?.activeTopic || null,
          suggestedActions: msg.metadata?.suggestedActions || [],
          adaptiveExplanation: msg.metadata?.adaptiveExplanation || null,
          createdAt: msg.created_at,
        }));
        setMessages(uiMessages);
      } catch (error) {
        console.error("Failed to load messages:", error);
      } finally {
        setIsLoadingMessages(false);
      }
    }

    loadMessages();
  }, [conversationId]);

  /**
   * Save a message to Supabase
   */
  const saveMessage = useCallback(async (convId, role, content, metadata = {}) => {
    if (!convId) return null;

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: convId,
          role,
          content,
          metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Failed to save message:", error);
      return null;
    }
  }, []);

  /**
   * Update conversation title
   */
  const updateConversationTitle = useCallback(async (convId, title) => {
    if (!convId || !userId) return null;

    try {
      const updatedConversation = await updateConversation(userId, convId, { title });
      onConversationUpdated?.(convId, updatedConversation);
      return updatedConversation;
    } catch (error) {
      console.error("Failed to update conversation title:", error);
      return null;
    }
  }, [onConversationUpdated, userId]);

  const sendMessage = useCallback(async (text, preferences = {}) => {
    clearContent();

    const conversationState = [...messages]
      .slice()
      .reverse()
      .map(message => message.metadata?.conversationState || {
        activeTopic: message.metadata?.activeTopic || message.metadata?.decision?.activeTopic || null,
        lastArtifact: message.metadata?.decision?.artifacts?.[0] || null,
        mode: message.metadata?.decision?.mode || null,
      })
      .find(state => state?.activeTopic || state?.lastArtifact || state?.mode) || {
        activeTopic: null,
        subTopic: null,
        lastArtifact: null,
        mode: preferences.mode || "chat",
      };

    const userMsg = { id: Date.now().toString(), role: "user", content: text, text };
    const newContext = [...messages, userMsg];
    setMessages(newContext);
    setIsStreaming(true);

    // Track behavior for personalization
    const now = Date.now();
    const behavior = behaviorRef.current;
    behavior.messageCount++;
    behavior.totalMessageLength += text.length;

    // Detect follow-up (message within 60 seconds of last)
    if (behavior.lastMessageTime && (now - behavior.lastMessageTime) < 60000) {
      behavior.followUpCount++;
    }
    behavior.lastMessageTime = now;

    // Calculate behavior metrics to send
    const behaviorData = {
      avgMessageLength: Math.round(behavior.totalMessageLength / behavior.messageCount),
      followUpCount: behavior.followUpCount,
    };

    let activeConversationId = conversationIdRef.current;
    let createdConversation = null;
    let savedUserMessage = null;

    try {
      // 1. Create conversation if not exists
      if (!activeConversationId && userId) {
        const newConv = await createConversation(userId, DEFAULT_CONVERSATION_TITLE, {
          mode: preferences.mode === "learning" ? "learning" : "chat",
        });
        activeConversationId = newConv.id;
        conversationIdRef.current = activeConversationId;
        createdConversation = newConv;
      }

      const messageMetadata = {
        documentId: preferences.documentId || null,
        webSearch: !!preferences.webSearch,
        requestedArtifact: preferences.requestedArtifact || null,
      };

      // 2. Save user message to DB
      savedUserMessage = await saveMessage(activeConversationId, "user", text, messageMetadata);
      if (!savedUserMessage) {
        throw new Error("Failed to save your message.");
      }

      if (savedUserMessage) {
        userMsg.id = savedUserMessage.id; // Use DB ID
      }

      if (createdConversation && activeConversationId) {
        onConversationCreated?.({
          ...createdConversation,
          messageCount: 1,
        });
      }

      // Note: Learning content is fetched by LearningPage when user navigates there
      // This prevents duplicate fetches and race conditions between hook instances

      // 3. Start streaming response with personalization data
      await startStream(
        newContext,
        () => {},
        async (finalMsgs) => {
          const isArtifactOnlyRequest = ARTIFACT_ONLY_RESPONSES.has(preferences.requestedArtifact);
          const suppressAssets = SUPPRESS_ASSET_ARTIFACTS.has(preferences.requestedArtifact);
          // Attach any streamed images and fact-checks to the final message
          let enrichedMsgs = finalMsgs.map(msg => ({
            ...msg,
            text: isArtifactOnlyRequest ? "" : (msg.text || msg.content || ""),
            content: isArtifactOnlyRequest ? "" : (msg.content || msg.text || ""),
            images: suppressAssets ? [] : assets.images,
            factCheck: suppressAssets ? null : assets.factCheck,
            suggestedActions: msg.metadata?.suggestedActions || [],
            adaptiveExplanation: msg.metadata?.adaptiveExplanation || null,
          }));

          // 4. Save assistant message(s) to DB
          const savedAssistantMessages = [];
          for (const msg of enrichedMsgs) {
            const metadata = {
              widgets: msg.widgets || [],
              images: suppressAssets ? [] : (msg.images || []),
              factCheck: msg.factCheck || null,
              documentId: preferences.documentId || null,
              webSearch: !!preferences.webSearch,
              ...(msg.metadata || {}),
              requestedArtifact: preferences.requestedArtifact || msg.metadata?.requestedArtifact || null,
            };
            const savedMsg = await saveMessage(
              activeConversationId,
              "assistant",
              msg.text || msg.content || "",
              metadata
            );
            if (savedMsg) {
              msg.id = savedMsg.id;
              savedAssistantMessages.push({ ...savedMsg, metadata });
            }
          }

          if (createdConversation && shouldAutoGenerateConversationTitle(createdConversation.title)) {
            const generatedTitle = generateConversationTitle(text);
            await updateConversationTitle(activeConversationId, generatedTitle);
          }

          setMessages([...newContext, ...enrichedMsgs]);
          setIsStreaming(false);

          const explicitArtifact = preferences.requestedArtifact
            || enrichedMsgs.find(msg => msg.metadata?.decision?.artifacts?.length)?.metadata?.decision?.artifacts?.[0]
            || null;

          const shouldGenerateLearningArtifact = explicitArtifact
            && userId
            && (
              preferences.mode === "learning"
              || CHAT_ARTIFACTS_WITH_LEARNING_AGENTS.has(explicitArtifact)
            );

          if (shouldGenerateLearningArtifact) {
            const generatedLearningContent = await generateLearningContent(
              text,
              userId,
              true,
              accessToken,
              { requestedArtifact: explicitArtifact },
              {
                conversationId: activeConversationId,
                documentId: preferences.documentId || null,
                webSearch: !!preferences.webSearch,
              },
            );

            const latestSavedAssistant = savedAssistantMessages[savedAssistantMessages.length - 1];
            if (generatedLearningContent && latestSavedAssistant?.id) {
              const nextMetadata = {
                ...(latestSavedAssistant.metadata || {}),
                learningContent: generatedLearningContent,
              };
              setMessages(currentMessages => currentMessages.map(message => (
                message.id === latestSavedAssistant.id
                  ? {
                    ...message,
                    metadata: nextMetadata,
                  }
                  : message
              )));
              await supabase
                .from("messages")
                .update({ metadata: nextMetadata })
                .eq("id", latestSavedAssistant.id);
            }
          }

        },
        {
          userId,
          behavior: behaviorData,
          preferences,
          accessToken,
          conversationId: activeConversationId,
          personaId: defaultPersona?.id,
          documentId: preferences.documentId || null,
          webSearch: !!preferences.webSearch,
          mode: preferences.mode || "chat",
          conversationState,
        }
      );
    } catch (error) {
      if (createdConversation && !savedUserMessage && userId && activeConversationId) {
        await deleteConversation(userId, activeConversationId).catch(() => {});
        conversationIdRef.current = null;
      }

      console.error("Chat error:", error);
      const errorMsg = { id: Date.now().toString(), role: "assistant", text: `Error: ${error.message}` };
      setMessages([...newContext, errorMsg]);
      setIsStreaming(false);
    }
  }, [
    accessToken,
    assets,
    clearContent,
    defaultPersona,
    generateLearningContent,
    messages,
    onConversationCreated,
    saveMessage,
    startStream,
    updateConversationTitle,
    userId,
  ]);

  // Generate a learning plan and optionally stream assets
  const generateLearningPlan = useCallback(async (goal, streamAssets = true) => {
    try {
      const generatedPlan = await generatePlan(goal);

      if (streamAssets && generatedPlan) {
        // Start asset generation for the plan
        await startAssetStream(generatedPlan, 'visual');
      }

      return generatedPlan;
    } catch (error) {
      console.error("Plan generation error:", error);
      throw error;
    }
  }, [generatePlan, startAssetStream]);

  /**
   * Clear messages (for new conversation)
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
    conversationIdRef.current = null;
  }, []);

  return {
    messages,
    isStreaming,
    isLoadingMessages,
    currentStreamedMessage: currentMessage,
    isLoadingWidget,
    sendMessage,
    clearMessages,
    // Personalization transparency
    personalizationMeta,
    // Asset streaming
    assets,
    isAssetStreaming,
    assetProgress,
    // Learning plan
    plan,
    isPlanLoading,
    generateLearningPlan,
    // Learning content (workspace)
    learningContent,
    isLearningContentLoading,
    generateLearningContent,
    trackInteraction,
  };
}
