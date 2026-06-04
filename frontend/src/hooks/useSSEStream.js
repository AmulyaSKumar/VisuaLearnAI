import { useState, useRef, useCallback } from "react";
import { sanitizeAssistantResponse } from "../utils/sanitizeAssistantResponse";

const ARTIFACT_ONLY_RESPONSES = new Set(["quiz", "flashcards", "mindmap", "simulation", "video"]);
const SUPPRESS_WIDGET_ARTIFACTS = new Set(["quiz", "flashcards", "mindmap", "simulation", "video"]);
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "https://visualearnai-backend.onrender.com" : "http://localhost:3001");

export function useSSEStream() {
  const [currentMessage, setCurrentMessage] = useState(null);
  const [isLoadingWidget, setIsLoadingWidget] = useState(false);
  const [personalizationMeta, setPersonalizationMeta] = useState(null);
  const [factCheckResult, setFactCheckResult] = useState(null);

  const textBufferRef = useRef("");
  const factCheckRef = useRef(null);
  const personalizationMetaRef = useRef(null);
  const orchestrationRef = useRef(null);

  /**
   * Start streaming chat with personalization support
   * @param {Array} contextMessages - Conversation messages
   * @param {Function} onDelta - Called on each text delta
   * @param {Function} onComplete - Called when stream completes
   * @param {Object} options - { userId, behavior, preferences, accessToken, conversationId, personaId, documentId }
   */
  const startStream = useCallback(async (contextMessages, onDelta, onComplete, options = {}) => {
    const {
      userId,
      behavior,
      preferences,
      accessToken,
      conversationId,
      personaId = null,
      documentId = null,
      webSearch = false,
      mode = preferences?.mode || "chat",
      conversationState = null,
    } = options;

    setCurrentMessage({
      role: "assistant",
      text: "",
      widgets: [],
      loadingWidget: false,
      metadata: { requestedArtifact: preferences?.requestedArtifact || null },
    });
    setIsLoadingWidget(false);
    setPersonalizationMeta(null);
    setFactCheckResult(null);
    textBufferRef.current = "";
    factCheckRef.current = null;
    personalizationMetaRef.current = null;
    orchestrationRef.current = null;

    const formattedMessages = contextMessages.map(m => {
      if (m.type === "widget") {
        return {
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: m.toolId || "unknown",
            content: "Widget rendered successfully."
          }]
        };
      }
      return { role: m.role, content: m.content || m.text };
    }).filter(m => m.content && m.content.length > 0);

    // Store userId and token for tool-result calls
    const streamUserId = userId;
    const streamToken = accessToken;

    const headers = { "Content-Type": "application/json" };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: formattedMessages,
        userId,
        behavior,
        preferences,
        conversationId,
        personaId,  // AI persona for personalized responses
        documentId,  // Uploaded PDF grounding for RAG-backed answers
        webSearch,  // Current web grounding for one-shot web search answers
        learningAction: preferences?.requestedArtifact || null,
        mode,
        conversationState,
      }),
    });

    if (!response.ok) throw new Error("Failed to start stream");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let finalWidgets = [];
    let completed = false;
    const suppressAssistantText = ARTIFACT_ONLY_RESPONSES.has(preferences?.requestedArtifact);
    const suppressGeneratedWidgets = SUPPRESS_WIDGET_ARTIFACTS.has(preferences?.requestedArtifact);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            
            // Handle personalization metadata
            if (data.type === "personalization_meta") {
              setPersonalizationMeta(data);
              personalizationMetaRef.current = data;
            }

            // Handle fact check result
            if (data.type === "fact_check") {
              factCheckRef.current = data;
              setFactCheckResult(data);
            }

            if (data.type === "orchestration_decision") {
              orchestrationRef.current = {
                decision: data.decision || null,
                activeTopic: data.activeTopic || data.decision?.activeTopic || null,
                conversationState: data.conversationState || data.decision?.conversationState || null,
                requestedArtifact: preferences?.requestedArtifact || null,
                suggestedActions: data.suggestedActions || [],
                adaptiveExplanation: data.adaptiveExplanation || null,
                responseKind: data.responseKind || null,
              };
              setCurrentMessage(prev => prev ? {
                ...prev,
                metadata: {
                  ...(prev.metadata || {}),
                  ...orchestrationRef.current,
                },
              } : prev);
            }

            if (data.type === "text_delta") {
              if (!suppressAssistantText) {
                textBufferRef.current += data.text;
                setCurrentMessage(prev => prev ? { ...prev, text: sanitizeAssistantResponse(textBufferRef.current) } : prev);
              }
              setIsLoadingWidget(false);
            }
            
            // NEW: Show loading card as soon as tool_use starts
            if (data.type === "tool_use_start" && data.name === "show_widget" && !suppressGeneratedWidgets) {
              setIsLoadingWidget(true);
              setCurrentMessage(prev => prev ? { ...prev, loadingWidget: true } : prev);
            }
            
            // NEW: Track input progress (could show partial title etc)
            if (data.type === "tool_input_delta" && !suppressGeneratedWidgets) {
              // The widget is still being generated — keep loading state
              setIsLoadingWidget(true);
            }
            
            // Full widget received — replace loading with actual widget
            if (data.type === "tool_use" && data.name === "show_widget" && !suppressGeneratedWidgets) {
              const widgetData = data.input;

              const newWidget = {
                type: "widget",
                id: Date.now().toString(),
                toolId: data.id,
                title: widgetData.title,
                spec: {
                  version: widgetData.version || "1.0",
                  type: widgetData.spec_type || widgetData.type || "flow",
                  title: widgetData.title,
                  objects: widgetData.objects || [],
                  animations: widgetData.animations || [],
                  controls: widgetData.controls || [],
                  explanation: widgetData.explanation || "",
                  telemetry: widgetData.telemetry || null,
                },
                widget_type: widgetData.spec_type || null,
                decisionId: personalizationMetaRef.current?.decisionId || null,
                selectedAction: personalizationMetaRef.current?.selectedAction || null,
                topicKey: personalizationMetaRef.current?.topicKey || null,
              };
              
              finalWidgets.push(newWidget);
              setIsLoadingWidget(false);
              setCurrentMessage(prev => prev ? { ...prev, widgets: finalWidgets, loadingWidget: false } : prev);
              
              // Auto-POST tool-result back to continue
              continueWithToolResult(
                contextMessages,
                { role: "assistant", content: [{ type: "tool_use", id: data.id, name: data.name, input: data.input }] },
                data.id,
                textBufferRef,
                finalWidgets,
                onComplete,
                setCurrentMessage,
                setIsLoadingWidget,
                streamUserId,
                streamToken,
                conversationId,
                personalizationMetaRef.current,
                personaId
              );
              return;
            }
            
            if (data.type === "done" || data.type === "message_complete") {
              if (completed) continue;
              completed = true;
              const cleanedText = sanitizeAssistantResponse(textBufferRef.current);
              textBufferRef.current = cleanedText;
              // Include fact check result with the completed message
              const completedMessage = {
                id: Date.now().toString(),
                role: "assistant",
                text: suppressAssistantText ? "" : cleanedText,
                widgets: finalWidgets,
                factCheck: factCheckRef.current,
                metadata: {
                  ...(orchestrationRef.current || {}),
                  requestedArtifact: preferences?.requestedArtifact || null,
                },
              };
              onComplete([completedMessage]);
              setCurrentMessage(null);
              setIsLoadingWidget(false);
            }
            
            if (data.type === "error") {
              throw new Error(data.error);
            }
          } catch (e) {
            if (e.message && !e.message.includes("JSON")) throw e;
          }
        }
      }
  }, []);

  const continueWithToolResult = async (
    originalContext,
    assistantToolMsg,
    toolId,
    textRef,
    widgetsList,
    onComplete,
    setCurrent,
    setLoading,
    userId = null,
    accessToken = null,
    conversationId = null,
    personalization = null,
    personaId = null
  ) => {
    let localFactCheck = null;

    try {
      const toolResultMsg = {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolId, content: "Widget rendered successfully. Continue with explanation." }]
      };

      const formattedMessages = originalContext.map(m => ({ role: m.role, content: m.content || m.text }));
      const newMessages = [...formattedMessages, assistantToolMsg, toolResultMsg];

      const headers = { "Content-Type": "application/json" };
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const response = await fetch(`${API_BASE}/api/tool-result`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: newMessages,
          userId,
          conversationId,
          personaId,  // AI persona for personalized responses
          bandit: personalization ? {
            decisionId: personalization.decisionId || null,
            selectedAction: personalization.selectedAction || null,
            topicKey: personalization.topicKey || null,
          } : null,
        }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "text_delta") {
              textRef.current += data.text;
              setCurrent(prev => prev ? { ...prev, text: sanitizeAssistantResponse(textRef.current) } : prev);
            }
            if (data.type === "fact_check") {
              localFactCheck = data;
              factCheckRef.current = data;
              setFactCheckResult(data);
            }
            if (
              data.type === "tool_use_start"
              && data.name === "show_widget"
              && !SUPPRESS_WIDGET_ARTIFACTS.has(orchestrationRef.current?.requestedArtifact)
            ) {
              setLoading(true);
              setCurrent(prev => prev ? { ...prev, loadingWidget: true } : prev);
            }
            if (
              data.type === "tool_use"
              && data.name === "show_widget"
              && !SUPPRESS_WIDGET_ARTIFACTS.has(orchestrationRef.current?.requestedArtifact)
            ) {
              const widgetData = data.input;
              const newWidget = {
                type: "widget",
                id: Date.now().toString(),
                toolId: data.id,
                title: widgetData.title,
                spec: {
                  version: widgetData.version || "1.0",
                  type: widgetData.spec_type || widgetData.type || "flow",
                  title: widgetData.title,
                  objects: widgetData.objects || [],
                  animations: widgetData.animations || [],
                  controls: widgetData.controls || [],
                  explanation: widgetData.explanation || "",
                  telemetry: widgetData.telemetry || null,
                },
                widget_type: widgetData.spec_type || null
              };
              widgetsList.push(newWidget);
              setLoading(false);
              setCurrent(prev => prev ? { ...prev, widgets: widgetsList, loadingWidget: false } : prev);
            }
            if (data.type === "done" || data.type === "message_complete") {
              if (completed) continue;
              completed = true;
              textRef.current = sanitizeAssistantResponse(textRef.current);
              onComplete([{
                id: Date.now().toString(),
                role: "assistant",
                text: textRef.current,
                widgets: widgetsList,
                factCheck: localFactCheck,
                metadata: {
                  ...(orchestrationRef.current || {}),
                  requestedArtifact: orchestrationRef.current?.requestedArtifact || null,
                },
              }]);
              setCurrent(null);
              setLoading(false);
            }
          } catch {
            // Ignore malformed SSE chunks and keep reading.
          }
        }
      }
    } catch (e) {
      console.error(e);
      onComplete([{
        id: Date.now().toString(),
        role: "assistant",
        text: sanitizeAssistantResponse(textRef.current),
        widgets: widgetsList,
        factCheck: localFactCheck,
        metadata: {
          ...(orchestrationRef.current || {}),
          requestedArtifact: orchestrationRef.current?.requestedArtifact || null,
        },
      }]);
    }
  };

  return { startStream, currentMessage, isLoadingWidget, personalizationMeta, factCheckResult };
}
