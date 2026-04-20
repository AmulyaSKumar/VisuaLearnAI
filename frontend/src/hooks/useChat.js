import { useState, useCallback, useEffect, useRef } from "react";
import { useSSEStream } from "./useSSEStream";
import { useAssetStream } from "./useAssetStream";
import { useLearningPlan } from "./useLearningPlan";
import { useLearningContent } from "./useLearningContent";
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
  const { content: learningContent, isLoading: isLearningContentLoading, generateContent: generateLearningContent, trackInteraction } = useLearningContent();

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
          widgets: msg.metadata?.widgets || [],
          images: msg.metadata?.images || [],
          factCheck: msg.metadata?.factCheck || null,
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
        const newConv = await createConversation(userId, DEFAULT_CONVERSATION_TITLE);
        activeConversationId = newConv.id;
        conversationIdRef.current = activeConversationId;
        createdConversation = newConv;
      }

      // 2. Save user message to DB
      savedUserMessage = await saveMessage(activeConversationId, "user", text);
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
          // Attach any streamed images and fact-checks to the final message
          const enrichedMsgs = finalMsgs.map(msg => ({
            ...msg,
            images: assets.images,
            factCheck: assets.factCheck,
          }));

          // 4. Save assistant message(s) to DB
          for (const msg of enrichedMsgs) {
            const metadata = {
              widgets: msg.widgets || [],
              images: msg.images || [],
              factCheck: msg.factCheck || null,
            };
            const savedMsg = await saveMessage(
              activeConversationId,
              "assistant",
              msg.text || msg.content || "",
              metadata
            );
            if (savedMsg) {
              msg.id = savedMsg.id;
            }
          }

          if (createdConversation && shouldAutoGenerateConversationTitle(createdConversation.title)) {
            const generatedTitle = generateConversationTitle(text);
            await updateConversationTitle(activeConversationId, generatedTitle);
          }

          setMessages([...newContext, ...enrichedMsgs]);
          setIsStreaming(false);
        },
        { userId, behavior: behaviorData, preferences, accessToken, conversationId: activeConversationId }
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
