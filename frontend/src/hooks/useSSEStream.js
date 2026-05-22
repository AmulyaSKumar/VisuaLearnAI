import { useState, useRef, useCallback, useMemo } from "react";

/**
 * Detect device capabilities for 3D rendering
 * @returns {Object} Device capability object
 */
function getDeviceCapabilities() {
  // Check WebGL support
  let webgl = false;
  try {
    const canvas = document.createElement('canvas');
    webgl = !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch (e) {
    webgl = false;
  }

  // Get device memory (in GB, defaults to 4 if not available)
  const memory = navigator.deviceMemory || 4;

  // Get CPU cores
  const cores = navigator.hardwareConcurrency || 4;

  // Detect mobile device
  const mobile = /Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Check for data saver mode
  const saveData = navigator.connection?.saveData || false;

  // Estimate connection quality
  const connectionType = navigator.connection?.effectiveType || '4g';
  const slowConnection = connectionType === 'slow-2g' || connectionType === '2g';

  return {
    webgl,
    memory,
    cores,
    mobile,
    saveData,
    slowConnection,
    // Derived complexity level
    complexityLevel: !webgl ? 'none' :
                     (saveData || (mobile && memory < 3) || slowConnection) ? 'low' :
                     (mobile || memory < 4 || cores < 4) ? 'medium' : 'high'
  };
}

export function useSSEStream() {
  const [currentMessage, setCurrentMessage] = useState(null);
  const [isLoadingWidget, setIsLoadingWidget] = useState(false);
  const [personalizationMeta, setPersonalizationMeta] = useState(null);
  const [factCheckResult, setFactCheckResult] = useState(null);

  const textBufferRef = useRef("");
  const factCheckRef = useRef(null);
  const personalizationMetaRef = useRef(null);

  // Memoize device capabilities - they don't change during session
  const deviceCapabilities = useMemo(() => getDeviceCapabilities(), []);

  /**
   * Start streaming chat with personalization support
   * @param {Array} contextMessages - Conversation messages
   * @param {Function} onDelta - Called on each text delta
   * @param {Function} onComplete - Called when stream completes
   * @param {Object} options - { userId, behavior, preferences, accessToken, conversationId, skip3D, personaId, documentId }
   */
  const startStream = useCallback(async (contextMessages, onDelta, onComplete, options = {}) => {
    const { userId, behavior, preferences, accessToken, conversationId, skip3D = false, personaId = null, documentId = null } = options;

    setCurrentMessage({ role: "assistant", text: "", widgets: [], loadingWidget: false });
    setIsLoadingWidget(false);
    setPersonalizationMeta(null);
    setFactCheckResult(null);
    textBufferRef.current = "";
    factCheckRef.current = null;
    personalizationMetaRef.current = null;

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

    try {
      const headers = { "Content-Type": "application/json" };
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const response = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: formattedMessages,
          userId,
          behavior,
          preferences,
          conversationId,
          deviceCapabilities,  // Send device capabilities for 3D optimization
          skip3D,  // When true, backend skips widget generation (3D will be generated separately)
          personaId,  // AI persona for personalized responses
          documentId,  // Uploaded PDF grounding for RAG-backed answers
        }),
      });

      if (!response.ok) throw new Error("Failed to start stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let finalWidgets = [];

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

            if (data.type === "text_delta") {
              textBufferRef.current += data.text;
              setCurrentMessage(prev => prev ? { ...prev, text: textBufferRef.current } : prev);
              setIsLoadingWidget(false);
            }
            
            // NEW: Show loading card as soon as tool_use starts
            if (data.type === "tool_use_start" && data.name === "show_widget") {
              setIsLoadingWidget(true);
              setCurrentMessage(prev => prev ? { ...prev, loadingWidget: true } : prev);
            }
            
            // NEW: Track input progress (could show partial title etc)
            if (data.type === "tool_input_delta") {
              // The widget is still being generated — keep loading state
              setIsLoadingWidget(true);
            }
            
            // Full widget received — replace loading with actual widget
            if (data.type === "tool_use" && data.name === "show_widget") {
              const widgetData = data.input;

              const newWidget = {
                type: "widget",
                id: Date.now().toString(),
                toolId: data.id,
                title: widgetData.title,
                code: widgetData.widget_code,
                widget_type: widgetData.widget_type || null,  // 3d, 2d, chart, interactive
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
              // Include fact check result with the completed message
              const completedMessage = {
                id: Date.now().toString(),
                role: "assistant",
                text: textBufferRef.current,
                widgets: finalWidgets,
                factCheck: factCheckRef.current,
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
    } catch (e) {
      throw e;
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

      const response = await fetch("http://localhost:3001/api/tool-result", {
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
              setCurrent(prev => prev ? { ...prev, text: textRef.current } : prev);
            }
            if (data.type === "fact_check") {
              localFactCheck = data;
              factCheckRef.current = data;
              setFactCheckResult(data);
            }
            if (data.type === "tool_use_start" && data.name === "show_widget") {
              setLoading(true);
              setCurrent(prev => prev ? { ...prev, loadingWidget: true } : prev);
            }
            if (data.type === "tool_use" && data.name === "show_widget") {
              const widgetData = data.input;
              const newWidget = {
                type: "widget",
                id: Date.now().toString(),
                toolId: data.id,
                title: widgetData.title,
                code: widgetData.widget_code,
                widget_type: widgetData.widget_type || null  // 3d, 2d, chart, interactive
              };
              widgetsList.push(newWidget);
              setLoading(false);
              setCurrent(prev => prev ? { ...prev, widgets: widgetsList, loadingWidget: false } : prev);
            }
            if (data.type === "done" || data.type === "message_complete") {
              onComplete([{ id: Date.now().toString(), role: "assistant", text: textRef.current, widgets: widgetsList, factCheck: localFactCheck }]);
              setCurrent(null);
              setLoading(false);
            }
          } catch(e) {}
        }
      }
    } catch (e) {
      console.error(e);
      onComplete([{ id: Date.now().toString(), role: "assistant", text: textRef.current, widgets: widgetsList, factCheck: localFactCheck }]);
    }
  };

  return { startStream, currentMessage, isLoadingWidget, personalizationMeta, factCheckResult, deviceCapabilities };
}
