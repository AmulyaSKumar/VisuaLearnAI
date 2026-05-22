import { useState, useCallback, useEffect, useRef } from "react";
import { useSSEStream } from "./useSSEStream";
import { useAssetStream } from "./useAssetStream";
import { useLearningPlan } from "./useLearningPlan";
import { useLearningContent } from "./useLearningContent";
import { use3DWidget } from "./use3DWidget";
import { usePersona } from "../contexts/PersonaContext";
import { should3DVisualize, getDeviceCapabilities } from "../utils/detect3D";
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

  // Get current persona from context
  const { defaultPersona } = usePersona();

  // 3D widget generation (separate from chat)
  const { widget: widget3D, isLoading: is3DLoading, skipReason: skip3DReason, generate3D } = use3DWidget(accessToken);

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

      // Check if 3D visualization is appropriate for this query
      const allowInlineSimulation = preferences.requestedArtifact === 'simulation' || preferences.requestedArtifact === 'learn';
      const detection3D = allowInlineSimulation ? should3DVisualize(text) : { use3D: false, score: 0, reason: 'normal chat mode' };
      const deviceCaps = getDeviceCapabilities();
      const needs3D = detection3D.use3D && deviceCaps.canRender3D;

      // Console logging for 3D detection
      console.log('[3D Detection]', {
        query: text.slice(0, 50) + (text.length > 50 ? '...' : ''),
        score: detection3D.score,
        use3D: detection3D.use3D,
        reason: detection3D.reason,
        deviceCanRender: deviceCaps.canRender3D,
        will3DGenerate: needs3D,
      });

      // 3. Start streaming response with personalization data
      // Use skip3D if 3D will be generated separately
      await startStream(
        newContext,
        () => {},
        async (finalMsgs) => {
          // Attach any streamed images and fact-checks to the final message
          let enrichedMsgs = finalMsgs.map(msg => ({
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
              documentId: preferences.documentId || null,
              webSearch: !!preferences.webSearch,
              requestedArtifact: preferences.requestedArtifact || null,
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

          if (preferences.requestedArtifact && userId) {
            await generateLearningContent(
              text,
              userId,
              true,
              accessToken,
              { requestedArtifact: preferences.requestedArtifact },
              {
                conversationId: activeConversationId,
                documentId: preferences.documentId || null,
                webSearch: !!preferences.webSearch,
              },
            );
          }

          // 5. Generate 3D widget separately if needed
          if (needs3D && enrichedMsgs.length > 0) {
            console.log('[3D Generation] Starting 3D widget generation...');
            const assistantText = enrichedMsgs[0]?.text || enrichedMsgs[0]?.content || '';
            const widget3DResult = await generate3D(text, assistantText);

            // Add 3D widget to the message if generated
            if (widget3DResult) {
              console.log('[3D Generation] ✓ 3D widget generated!', {
                id: widget3DResult.id,
                title: widget3DResult.title,
                codeLength: widget3DResult.code?.length || 0,
              });

              // Get the first message's DB id for update
              const firstMsgId = enrichedMsgs[0]?.id;

              enrichedMsgs = enrichedMsgs.map((msg, idx) => {
                if (idx === 0) {
                  return {
                    ...msg,
                    widgets: [...(msg.widgets || []), widget3DResult],
                  };
                }
                return msg;
              });
              setMessages([...newContext, ...enrichedMsgs]);

              // Persist 3D widget to DB so it survives refresh
              if (firstMsgId) {
                const updatedWidgets = enrichedMsgs[0]?.widgets || [];
                try {
                  const { error: updateError } = await supabase
                    .from("messages")
                    .update({
                      metadata: {
                        widgets: updatedWidgets,
                        images: enrichedMsgs[0]?.images || [],
                        factCheck: enrichedMsgs[0]?.factCheck || null,
                      },
                    })
                    .eq("id", firstMsgId);

                  if (updateError) {
                    console.warn('[3D Generation] Failed to persist widget to DB:', updateError.message);
                  } else {
                    console.log('[3D Generation] ✓ Widget persisted to DB');
                  }
                } catch (dbErr) {
                  console.warn('[3D Generation] DB update error:', dbErr.message);
                }
              }
            } else {
              console.log('[3D Generation] ✗ No 3D widget returned (see use3DWidget logs above for reason)');
            }
          }
        },
        {
          userId,
          behavior: behaviorData,
          preferences,
          accessToken,
          conversationId: activeConversationId,
          skip3D: !allowInlineSimulation || needs3D,
          personaId: defaultPersona?.id,
          documentId: preferences.documentId || null,
          webSearch: !!preferences.webSearch,
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
    defaultPersona,
    generate3D,
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

  /**
   * Add a voice message to the chat (from voice transcript sync)
   * Messages are already saved to DB by the backend, this updates UI state
   */
  const addVoiceMessage = useCallback((role, text, messageId) => {
    if (!text || !messageId) return;

    setMessages(prev => {
      // Check if message already exists (avoid duplicates)
      if (prev.some(m => m.id === messageId)) {
        return prev;
      }

      const newMessage = {
        id: messageId,
        role,
        content: text,
        // Store in metadata.source to match MessageList expectations
        metadata: { source: 'voice' },
        timestamp: new Date().toISOString(),
      };

      return [...prev, newMessage];
    });
  }, []);

  return {
    messages,
    isStreaming,
    isLoadingMessages,
    currentStreamedMessage: currentMessage,
    isLoadingWidget,
    sendMessage,
    clearMessages,
    // Voice message sync
    addVoiceMessage,
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
    // 3D widget generation (separate from chat)
    widget3D,
    is3DLoading,
    skip3DReason,  // Reason why 3D was skipped (for debugging/UI)
  };
}
