import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePersona } from "../contexts/PersonaContext";
import { getConversationMessages, supabase, updateAssistantMessageContent } from "../lib/supabase";
import { useLearningContent } from "../hooks/useLearningContent";
import { useLearningResources, RESOURCE_TYPES } from "../hooks/useLearningResources";
import { use3DWidget } from "../hooks/use3DWidget";
import useRealtimeAudio, { VOICE_STATES } from "../hooks/useRealtimeAudio";
import { should3DVisualize } from "../utils/detect3D";
import { normalizeLearningContent } from "../utils/normalizeLearningContent";
import { LearningIntelligenceProvider, useLearningIntelligence } from "../contexts/LearningIntelligenceContext";
import LearnTabView from "../components/learning/LearnTabView";
import ExamplesTabView from "../components/learning/ExamplesTabView";
import FlashcardsView from "../components/learning/FlashcardsView";
import QuizView from "../components/learning/QuizView";
import MindMapTabView from "../components/learning/MindMapTabView";
import SimulationView from "../components/learning/SimulationView";
import EngagingLoader from "../components/learning/EngagingLoader";
import WidgetFrame from "../components/WidgetFrame";
import VoiceToggleButton from "../components/VoiceToggleButton";
import VoiceIndicator from "../components/VoiceIndicator";

// Tab labels for dynamic tab bar
const TAB_LABELS = {
  learn: 'Learn',
  examples: 'Examples',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  mindmap: 'Mind Map',
  simulation: 'Simulation',
  visualization: '3D View',
};

// Depth levels for content complexity
const DEPTH_LEVELS = [
  { id: 'simple', label: 'Simple', description: 'Easy explanations, no jargon' },
  { id: 'balanced', label: 'Balanced', description: 'Mix of simple and technical' },
  { id: 'deep', label: 'Technical', description: 'Full detail, industry terms' },
];

// Map depth levels to API mode values
const depthToMode = (depth) => depth; // Now using 'deep' directly

// Inner component that uses the Learning Intelligence context
function LearningPageContent() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { defaultPersona } = usePersona();
  const userId = user?.id;
  const accessToken = session?.access_token;

  // Voice transcript handler - adds messages to local state
  const handleVoiceTranscript = useCallback((role, text, messageId) => {
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
        created_at: new Date().toISOString(),
      };

      return [...prev, newMessage];
    });
  }, []);

  // Voice conversation hook
  const voice = useRealtimeAudio({
    conversationId: conversationId || null,
    accessToken,
    personaId: defaultPersona?.id,
    onTranscript: handleVoiceTranscript,
  });

  const [activeTab, setActiveTab] = useState('learn');
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [storedContent, setStoredContent] = useState(null);
  const storedContentRef = useRef(storedContent); // Ref to avoid stale closure in callbacks
  const [factCheck, setFactCheck] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readCards, setReadCards] = useState(new Set());
  const [showDepthDropdown, setShowDepthDropdown] = useState(false);
  // Only Learn tab by default, other tabs appear when user requests them
  const [visibleTabs, setVisibleTabs] = useState(['learn']);
  const [loadingTabs, setLoadingTabs] = useState(new Set()); // Per-tab loading state
  const [loadedTabs, setLoadedTabs] = useState(new Set(['learn'])); // Track which tabs have content
  const [tabErrors, setTabErrors] = useState({}); // { tabId: "error message" }
  const [userQuery, setUserQuery] = useState(null); // Store user query for lazy loading
  const [documentId, setDocumentId] = useState(null); // Persist selected document for RAG-backed lazy tabs

  // Keep ref in sync with state
  useEffect(() => {
    storedContentRef.current = storedContent;
  }, [storedContent]);

  // Learning Intelligence context
  const {
    depthLevel,
    setDepthLevel,
    updateConceptMastery,
    recordQuizResult,
    getConceptStatus,
    weakAreas,
    strongAreas,
    stats,
  } = useLearningIntelligence();

  // Derive cognitive state from learning intelligence data
  // This creates alignment between UI suggestions and actual user performance
  const derivedCognitiveState = useMemo(() => {
    const recentQuizzes = stats.totalQuizzes || 0;
    const accuracy = stats.totalAttempts > 0
      ? stats.totalCorrect / stats.totalAttempts
      : 0.5;
    const hasWeakAreas = weakAreas?.length > 0;
    const hasStrongAreas = strongAreas?.length > 0;

    // Derive state based on performance signals
    if (hasWeakAreas && accuracy < 0.4) {
      return 'struggling';
    }
    if (hasWeakAreas && accuracy < 0.6) {
      return 'confused';
    }
    if (hasStrongAreas && accuracy >= 0.8 && recentQuizzes >= 2) {
      return 'mastering';
    }
    if (accuracy >= 0.7 && recentQuizzes >= 1) {
      return 'bored'; // Ready for more challenge
    }
    return 'flow'; // Default optimal state
  }, [weakAreas, strongAreas, stats]);

  // Keyboard navigation: Escape to go back to Learn view
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      // Escape key returns to Learn view
      if (e.key === 'Escape' && activeTab !== 'learn') {
        setActiveTab('learn');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Persistent learning resources hook
  const {
    resources: persistedResources,
    availableTypes: persistedTypes,
    isLoading: isResourcesLoading,
    fetchResources,
    getResource,
    hasResource,
    saveResource,
    addAvailableType,
    getTabs: getPersistedTabs,
  } = useLearningResources(conversationId, accessToken);

  const {
    isLoading: is3DGenerating,
    skipReason: visualizationSkipReason,
    generate3D,
  } = use3DWidget(accessToken);

  // State for 3D regeneration
  const [isRegenerating3D, setIsRegenerating3D] = useState(false);

  // NEW: State for content expansion (progressive disclosure)
  const [isExpandingContent, setIsExpandingContent] = useState(false);

  // Track if resources have been checked (to avoid race condition)
  const resourcesCheckedRef = useRef(false);

  // Learning content hook (fallback if not stored)
  const {
    content: generatedContent,
    isLoading: isLearningContentLoading,
    loadingTabs: hookLoadingTabs,
    fetchTabContent,
    isTabLoading: checkTabLoading,
    regenerateBlock,
    simulationDetection: hookSimulationDetection,
    clearContent,
    // NEW: Response mode and intent classification for adaptive UI
    responseMode: hookResponseMode,
    intentClassification: hookIntentClassification,
    expandContent,
  } = useLearningContent();

  // Refs to avoid callbacks causing infinite loops in useEffect
  const clearContentRef = useRef(clearContent);
  useEffect(() => {
    clearContentRef.current = clearContent;
  }, [clearContent]);

  const fetchTabContentRef = useRef(fetchTabContent);
  useEffect(() => {
    fetchTabContentRef.current = fetchTabContent;
  }, [fetchTabContent]);

  const expandContentRef = useRef(expandContent);
  useEffect(() => {
    expandContentRef.current = expandContent;
  }, [expandContent]);

  // State for simulation detection (from hook or local)
  const [localSimulationDetection, setLocalSimulationDetection] = useState(null);
  const simulationDetection = localSimulationDetection || hookSimulationDetection;
  const [simulationAutoShown, setSimulationAutoShown] = useState(false);
  const [visualizationHintChecked, setVisualizationHintChecked] = useState(false);

  // Ref to track if detection is in progress (prevent duplicate calls)
  const detectionInProgressRef = useRef(false);
  const localSimulationDetectionRef = useRef(localSimulationDetection);
  useEffect(() => {
    localSimulationDetectionRef.current = localSimulationDetection;
  }, [localSimulationDetection]);

  // API base URL
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Run simulation detection for a query (used when loading from DB cache)
  const runSimulationDetection = useCallback(async (query) => {
    if (!query) {
      console.log('[LearningPage] Simulation detection skipped: no query');
      return;
    }
    // Use ref to check state without causing dependency changes
    if (localSimulationDetectionRef.current) {
      console.log('[LearningPage] Simulation detection skipped: already detected');
      return;
    }
    // Prevent duplicate in-flight requests
    if (detectionInProgressRef.current) {
      console.log('[LearningPage] Simulation detection skipped: already in progress');
      return;
    }

    detectionInProgressRef.current = true;
    console.log('[LearningPage] Running simulation detection for:', query.slice(0, 50));

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Use dedicated lightweight detection endpoint
      const response = await fetch(`${API_BASE}/api/simulation/detect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query })
      });

      console.log('[LearningPage] Detection response status:', response.status);

      const data = await response.json();
      console.log('[LearningPage] Detection response data:', data);

      if (data.success && data.supported) {
        console.log('[LearningPage] Simulation SUPPORTED:', {
          type: data.type,
          algorithm: data.algorithm,
          confidence: data.confidence,
          hasInputSchema: !!data.inputSchema
        });
        setLocalSimulationDetection({
          supported: data.supported,
          type: data.type,
          algorithm: data.algorithm,
          confidence: data.confidence,
          reason: data.reason,
          // NEW: Include fields for custom input UI
          generatorKey: data.generatorKey,
          inputSchema: data.inputSchema,
          suggestedInputs: data.suggestedInputs
        });
      } else {
        console.log('[LearningPage] Simulation NOT supported:', data.reason || 'No match');
      }
    } catch (err) {
      console.error('[LearningPage] Simulation detection failed:', err.message);
      // Non-blocking - continue without detection
    } finally {
      detectionInProgressRef.current = false;
    }
  }, [accessToken, API_BASE]); // Removed localSimulationDetection - using ref instead

  // Handle simulation detection - show tab and auto-activate when supported
  useEffect(() => {
    if (!simulationDetection?.supported || simulationAutoShown) return;

    const { confidence } = simulationDetection;
    console.log('[LearningPage] Simulation detection:', {
      type: simulationDetection.type,
      confidence,
      algorithm: simulationDetection.algorithm
    });

    // Show simulation tab whenever supported (any confidence level)
    setVisibleTabs(prev => {
      if (prev.includes('simulation')) return prev;
      return [...prev, 'simulation'];
    });

    // Auto-switch to simulation tab for high confidence detections
    if (confidence > 0.6) {
      setActiveTab('simulation');
    }

    setSimulationAutoShown(true);
  }, [simulationDetection, simulationAutoShown]);

  // Show a dedicated 3D tab when the query is spatial enough for visualization.
  useEffect(() => {
    if (!userQuery || visualizationHintChecked) return;

    const detection = should3DVisualize(userQuery);
    if (detection.use3D) {
      setVisibleTabs(prev => {
        if (prev.includes('visualization')) return prev;
        return [...prev, 'visualization'];
      });
    }

    setVisualizationHintChecked(true);
  }, [userQuery, visualizationHintChecked]);

  // Sync visible tabs with persisted resource types from database
  // This ensures tabs persist across page reloads
  // IMPORTANT: This REPLACES tabs (not adds) to ensure clean state on conversation switch
  useEffect(() => {
    if (!persistedTypes || persistedTypes.length === 0) return;

    console.log('[LearningPage] Syncing tabs from persisted types:', persistedTypes);

    // Build fresh set of tabs from persisted types (REPLACE, not ADD)
    const newTabs = new Set(['learn']); // Always include learn
    const newLoaded = new Set(['learn']);

    // Map resource types to tab IDs
    persistedTypes.forEach(type => {
      switch (type) {
        case RESOURCE_TYPES.LEARN:
          newTabs.add('learn');
          newLoaded.add('learn');
          break;
        case RESOURCE_TYPES.EXAMPLES:
          newTabs.add('examples');
          newLoaded.add('examples');
          break;
        case RESOURCE_TYPES.QUIZ:
          newTabs.add('quiz');
          newLoaded.add('quiz');
          break;
        case RESOURCE_TYPES.FLASHCARDS:
          newTabs.add('flashcards');
          newLoaded.add('flashcards');
          break;
        case RESOURCE_TYPES.MINDMAP:
          newTabs.add('mindmap');
          newLoaded.add('mindmap');
          break;
        case RESOURCE_TYPES.SIMULATION:
          newTabs.add('simulation');
          newLoaded.add('simulation');
          break;
        case RESOURCE_TYPES.VISUALIZATION:
          newTabs.add('visualization');
          newLoaded.add('visualization');
          break;
        default:
          break;
      }
    });

    if (userQuery && should3DVisualize(userQuery).use3D) {
      newTabs.add('visualization');
    }

    console.log('[LearningPage] Setting visible tabs:', [...newTabs]);
    setVisibleTabs([...newTabs]);
    setLoadedTabs(newLoaded);
  }, [persistedTypes, userQuery]);

  // Build content from persisted resources + stored content + generated content
  // Priority: persisted resources > stored content (from message metadata) > generated content
  const rawContent = useMemo(() => {
    // Start with nothing
    let merged = {};

    // Layer 1: Generated content (lowest priority - for lazy loading)
    if (generatedContent) {
      merged = { ...merged, ...generatedContent };
    }

    // Layer 2: Stored content from message metadata
    if (storedContent) {
      merged = { ...merged, ...storedContent };
    }

    // Layer 3: Persisted resources from database (highest priority)
    if (persistedResources) {
      Object.entries(persistedResources).forEach(([type, resource]) => {
        if (resource?.content) {
          // Map resource types to content fields
          switch (type) {
            case RESOURCE_TYPES.LEARN:
              merged = { ...merged, ...resource.content };
              break;
            case RESOURCE_TYPES.EXAMPLES:
              if (resource.content.examples) {
                merged.examples = resource.content.examples;
              }
              break;
            case RESOURCE_TYPES.QUIZ:
              if (resource.content.quiz) {
                merged.quiz = resource.content.quiz;
              }
              break;
            case RESOURCE_TYPES.FLASHCARDS:
              if (resource.content.flashcards) {
                merged.flashcards = resource.content.flashcards;
              }
              break;
            case RESOURCE_TYPES.MINDMAP:
              if (resource.content.mind_map) {
                merged.mind_map = resource.content.mind_map;
              }
              break;
            case RESOURCE_TYPES.SIMULATION:
              // Simulation detection info
              if (resource.content.detection) {
                merged.simulationDetection = resource.content.detection;
              }
              break;
            case RESOURCE_TYPES.VISUALIZATION:
              if (resource.content.widget) {
                merged.visualizationWidget = resource.content.widget;
              }
              break;
            default:
              break;
          }
        }
      });
    }

    if (Object.keys(merged).length === 0) return null;
    return merged;
  }, [storedContent, generatedContent, persistedResources]);

  const learningContent = useMemo(() => {
    if (!rawContent) {
      console.log('[LearningPage] No raw content yet');
      return null;
    }
    const normalized = normalizeLearningContent(rawContent);
    console.log('[LearningPage] learningContent updated:', {
      hasContent: !!normalized,
      keyIdeasCount: normalized?.key_ideas?.length,
      topic: normalized?.topic?.slice(0, 30),
      rawKeys: Object.keys(rawContent || {}),
      hasFlashcards: !!normalized?.flashcards?.length,
      hasQuiz: !!normalized?.quiz?.length,
      hasMindMap: !!normalized?.mind_map
    });
    return normalized;
  }, [rawContent]);

  const visualizationWidget = rawContent?.visualizationWidget || null;

  // Load conversation and messages
  // Wait for persisted resources to be loaded first to avoid unnecessary API calls
  useEffect(() => {
    if (!conversationId) {
      navigate('/chat/new');
      return;
    }

    // Wait for resources to finish loading before deciding to fetch from API
    if (isResourcesLoading) {
      console.log('[LearningPage] Waiting for persisted resources to load...');
      return;
    }

    async function loadSession() {
      // Reset state (but NOT visibleTabs/loadedTabs - those are managed by persistedTypes sync effect)
      setLocalSimulationDetection(null);
      localSimulationDetectionRef.current = null; // Also reset the ref
      detectionInProgressRef.current = false; // Reset in-progress flag
      setSimulationAutoShown(false);
      setVisualizationHintChecked(false);
      clearContentRef.current(); // Use ref to avoid infinite loop
      setStoredContent(null);
      setDocumentId(null);
      // NOTE: visibleTabs and loadedTabs are managed by the persistedTypes sync effect
      // Don't reset them here or we'll lose persisted tabs!
      setTabErrors({});
      resourcesCheckedRef.current = true;

      setIsLoading(true);
      setError(null);

      try {
        // Load conversation metadata
        const { data: convData, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single();

        if (convError) throw convError;
        setConversation(convData);

        // Load messages
        const msgs = await getConversationMessages(conversationId);
        setMessages(msgs || []);

        // Store user query for lazy loading
        const userMessage = msgs?.find(m => m.role === 'user');
        if (userMessage) {
          setUserQuery(userMessage.content);
        }

        // CHECK 1: Do we have persisted resources from learning_resources table?
        const hasPersistedLearnContent = hasResource(RESOURCE_TYPES.LEARN);
        if (hasPersistedLearnContent) {
          console.log('[LearningPage] Using persisted resources from learning_resources table');
          // Content is already merged via the rawContent useMemo
          // Just run simulation detection
          if (userMessage?.content) {
            runSimulationDetection(userMessage.content);
          }
          setIsLoading(false);
          return;
        }

        // CHECK 2: Try to get stored learning content from assistant message metadata
        const assistantMsg = msgs?.find(m => m.role === 'assistant');
        const stored = assistantMsg?.metadata?.learningContent;
        const storedFact = assistantMsg?.metadata?.factCheck;
        const storedDocumentId = assistantMsg?.metadata?.documentId || userMessage?.metadata?.documentId || null;

        if (storedDocumentId) {
          setDocumentId(storedDocumentId);
        }

        if (stored) {
          console.log('[LearningPage] Using stored content from message metadata');
          setStoredContent(stored);
          setFactCheck(storedFact || stored.factCheck || null);

          // Track which tabs have content loaded from DB
          const loadedFromDB = new Set(['learn']); // Learn always exists
          if (Array.isArray(stored.examples) && stored.examples.length > 0) {
            loadedFromDB.add('examples');
          }
          if (Array.isArray(stored.flashcards) && stored.flashcards.length > 0) {
            loadedFromDB.add('flashcards');
          }
          if (Array.isArray(stored.quiz) && stored.quiz.length > 0) {
            loadedFromDB.add('quiz');
          }
          if (stored.mind_map?.branches && Array.isArray(stored.mind_map.branches) && stored.mind_map.branches.length > 0) {
            loadedFromDB.add('mindmap');
          }

          // Keep all tabs visible, just mark which ones are loaded
          setLoadedTabs(loadedFromDB);

          // Run simulation detection for stored content
          if (userMessage?.content) {
            runSimulationDetection(userMessage.content);
          }
        } else if (userMessage) {
          // CHECK 3: No stored content anywhere - need to generate via API
          console.log('[LearningPage] No stored content found, fetching from API for:', userMessage.content?.slice(0, 30));
          // Pass preferences with mode based on depthLevel
          // IMPORTANT: Await so loading state shows properly
          // Use ref to avoid infinite loop (fetchTabContent changes on every render)
          await fetchTabContentRef.current(userMessage.content, 'learn', userId, accessToken, { mode: depthLevel }, conversationId, storedDocumentId);

          // Also run simulation detection for fresh content
          runSimulationDetection(userMessage.content);
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        setError('Failed to load learning session');
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, conversationId, navigate, userId, depthLevel, runSimulationDetection, isResourcesLoading, hasResource]);
  // Note: fetchTabContent removed from deps - using fetchTabContentRef to avoid infinite loops

  // Handle opening a tab (add to visible, fetch content if needed)
  const handleOpenTab = useCallback(async (tabId) => {
    // Race condition guard - prevent duplicate calls
    if (loadingTabs.has(tabId)) {
      return;
    }

    // Clear any previous error for this tab
    setTabErrors(prev => {
      const next = { ...prev };
      delete next[tabId];
      return next;
    });

    // Add to visible tabs (functional update - stale closure fix)
    setVisibleTabs(prev => {
      if (prev.includes(tabId)) return prev;
      return [...prev, tabId];
    });

    // Switch to tab immediately
    setActiveTab(tabId);

    // Simulation tab uses its own API via useSimulation hook - no fetch needed here
    if (tabId === 'simulation') {
      return;
    }

    // Already loaded in memory?
    if (loadedTabs.has(tabId)) {
      return;
    }

    // Map tabId to resource type
    const tabToResourceType = {
      'learn': RESOURCE_TYPES.LEARN,
      'examples': RESOURCE_TYPES.EXAMPLES,
      'quiz': RESOURCE_TYPES.QUIZ,
      'flashcards': RESOURCE_TYPES.FLASHCARDS,
      'mindmap': RESOURCE_TYPES.MINDMAP,
      'simulation': RESOURCE_TYPES.SIMULATION,
      'visualization': RESOURCE_TYPES.VISUALIZATION,
    };

    // Check if content exists in persisted resources (from database)
    const resourceType = tabToResourceType[tabId];
    if (resourceType && hasResource(resourceType)) {
      console.log(`[LearningPage] Tab ${tabId} has persisted resource, using cached content`);
      setLoadedTabs(prev => new Set([...prev, tabId]));
      return;
    }

    // Use ref to get current storedContent (avoids stale closure)
    const currentContent = storedContentRef.current;

    // Check if content exists in storedContent (from message metadata)
    const hasInDB = (() => {
      switch (tabId) {
        case 'examples':
          return Array.isArray(currentContent?.examples) && currentContent.examples.length > 0;
        case 'flashcards':
          return Array.isArray(currentContent?.flashcards) && currentContent.flashcards.length > 0;
        case 'quiz':
          return Array.isArray(currentContent?.quiz) && currentContent.quiz.length > 0;
        case 'mindmap':
          return currentContent?.mind_map?.branches && Array.isArray(currentContent.mind_map.branches) && currentContent.mind_map.branches.length > 0;
        case 'visualization':
          return !!currentContent?.visualizationWidget;
        default:
          return false;
      }
    })();

    if (hasInDB) {
      setLoadedTabs(prev => new Set([...prev, tabId]));
      return;
    }

    // Mark as loading
    setLoadingTabs(prev => new Set([...prev, tabId]));

    try {
      if (tabId === 'visualization') {
        const assistantMessage = messages.find(m => m.role === 'assistant');
        const assistantContext = assistantMessage?.content || assistantMessage?.text || '';
        const widget = await generate3D(userQuery, assistantContext);

        if (!widget) {
          throw new Error(visualizationSkipReason || '3D visualization was skipped for this topic');
        }

        const merged = {
          ...(storedContentRef.current || {}),
          visualizationWidget: widget,
        };

        setStoredContent(merged);
        setLoadedTabs(prev => new Set([...prev, 'visualization']));

        await saveResource(
          RESOURCE_TYPES.VISUALIZATION,
          userQuery || conversation?.title || '3D visualization',
          { widget },
          assistantMessage?.id || null
        );

        return;
      }

      const apiContentType = (tabId === 'flashcards' || tabId === 'mindmap')
        ? 'flashcards-mindmap'
        : tabId;

      // Use ref to avoid infinite loop (fetchTabContent changes on every render)
      const newContent = await fetchTabContentRef.current(
        userQuery,
        apiContentType,
        userId,
        accessToken,
        { mode: depthLevel },
        conversationId, // Pass conversationId for resource persistence
        documentId
      );

      if (!newContent) {
        throw new Error('No content received from API');
      }

      // Mark as loaded
      setLoadedTabs(prev => {
        const next = new Set([...prev, tabId]);
        if (apiContentType === 'flashcards-mindmap') {
          next.add('flashcards');
          next.add('mindmap');
        }
        return next;
      });

      // Add both tabs if flashcards-mindmap
      if (apiContentType === 'flashcards-mindmap') {
        setVisibleTabs(prev => {
          const next = [...prev];
          if (!next.includes('flashcards')) next.push('flashcards');
          if (!next.includes('mindmap')) next.push('mindmap');
          return next;
        });
      }

      // FIXED: Deep merge that preserves existing content
      // Only add new fields, don't overwrite existing valid data
      const latestContent = storedContentRef.current || {};
      const merged = { ...latestContent };

      // Only merge fields that have actual content in newContent
      Object.keys(newContent).forEach(key => {
        const newValue = newContent[key];
        const existingValue = merged[key];

        // Only overwrite if new value is truthy and existing is falsy/empty
        // OR if existing doesn't exist at all
        if (newValue !== undefined && newValue !== null) {
          if (Array.isArray(newValue)) {
            // For arrays, only overwrite if new array has items and existing is empty/undefined
            if (newValue.length > 0 && (!existingValue || !Array.isArray(existingValue) || existingValue.length === 0)) {
              merged[key] = newValue;
            }
          } else if (typeof newValue === 'object') {
            // For objects, merge deeply
            if (!existingValue || typeof existingValue !== 'object') {
              merged[key] = newValue;
            } else {
              merged[key] = { ...existingValue, ...newValue };
            }
          } else {
            // For primitives, only set if existing is falsy
            if (!existingValue) {
              merged[key] = newValue;
            }
          }
        }
      });

      setStoredContent(merged);

      // Save to DB (fire and forget, with error logging)
      updateAssistantMessageContent(conversationId, merged).catch(err => {
        console.error('Failed to save content to DB:', err);
      });

      // Also save to learning_resources table for persistence (handled by backend now)
      // The backend saves resources automatically when conversationId is provided

    } catch (error) {
      console.error(`Failed to load ${tabId}:`, error);
      setTabErrors(prev => ({
        ...prev,
        [tabId]: error.message || 'Failed to generate content'
      }));
    } finally {
      // Clear loading state
      setLoadingTabs(prev => {
        const next = new Set(prev);
        next.delete(tabId);
        if (tabId === 'flashcards' || tabId === 'mindmap') {
          next.delete('flashcards');
          next.delete('mindmap');
        }
        return next;
      });
    }
  }, [loadingTabs, loadedTabs, userQuery, userId, accessToken, depthLevel, conversationId, hasResource, conversation, messages, generate3D, saveResource, visualizationSkipReason]);
  // Note: fetchTabContent removed from deps - using fetchTabContentRef to avoid infinite loops

  const handleReadCard = (cardId) => {
    setReadCards(prev => new Set(prev).add(cardId));
  };

  const handleInteraction = (data) => {
    console.log('Interaction:', data);
    // Could track interactions for analytics
  };

  // Handle block regeneration - persists to database
  // When user clicks "Explain Differently", they didn't understand the original
  // So we save the new explanation to replace the old one
  const handleRegenerateBlock = useCallback(async (conceptId, block, blockIndex) => {
    if (!userQuery && !conversation?.title) return;

    const query = userQuery || conversation?.title;
    const newBlock = await regenerateBlock(query, block, accessToken, { mode: depthLevel });

    if (newBlock) {
      // Build updated content first (outside setState for persistence)
      const currentContent = storedContentRef.current;
      if (!currentContent) return;

      const updatedKeyIdeas = [...(currentContent.key_ideas || [])];
      const conceptIndex = updatedKeyIdeas.findIndex(idea => idea.id === conceptId);

      if (conceptIndex !== -1 && updatedKeyIdeas[conceptIndex].blocks) {
        updatedKeyIdeas[conceptIndex] = {
          ...updatedKeyIdeas[conceptIndex],
          blocks: updatedKeyIdeas[conceptIndex].blocks.map((b, idx) =>
            idx === blockIndex ? { ...b, ...newBlock } : b
          )
        };
      }

      const updatedContent = {
        ...currentContent,
        key_ideas: updatedKeyIdeas
      };

      // Update local state
      setStoredContent(updatedContent);

      // Persist to database so regenerated explanation is saved
      if (conversationId) {
        try {
          const assistantMessage = messages?.find(m => m.role === 'assistant');
          await saveResource(
            RESOURCE_TYPES.LEARN,
            query,
            updatedContent,
            assistantMessage?.id || null
          );
          console.log('[LearningPage] Regenerated block saved to database');
        } catch (err) {
          console.error('[LearningPage] Failed to save regenerated block:', err);
          // Non-blocking - local state is already updated
        }
      }
    }
  }, [userQuery, conversation?.title, accessToken, depthLevel, regenerateBlock, conversationId, messages, saveResource]);

  // Handle content expansion (progressive disclosure)
  // Used when user clicks "Learn More" on a quick explanation
  const handleExpandContent = useCallback(async (targetMode) => {
    if (!userQuery || isExpandingContent) return;

    console.log('[LearningPage] Expanding content to mode:', targetMode);
    setIsExpandingContent(true);

    try {
      const result = await expandContentRef.current(
        targetMode,
        userQuery,
        userId,
        accessToken,
        { mode: depthLevel },
        conversationId
      );

      if (result) {
        // Content was successfully expanded
        // The hook will update storedContent automatically
        console.log('[LearningPage] Content expanded successfully');
      }
    } catch (err) {
      console.error('[LearningPage] Content expansion failed:', err);
    } finally {
      setIsExpandingContent(false);
    }
  }, [userQuery, isExpandingContent, userId, accessToken, depthLevel, conversationId]);

  // Handle 3D visualization regeneration
  const handleRegenerate3D = useCallback(async () => {
    if (!userQuery || isRegenerating3D) return;

    setIsRegenerating3D(true);
    console.log('[LearningPage] Regenerating 3D visualization...');

    try {
      const assistantMessage = messages.find(m => m.role === 'assistant');
      const assistantContext = assistantMessage?.content || assistantMessage?.text || '';

      // Generate new 3D widget
      const newWidget = await generate3D(userQuery, assistantContext);

      if (!newWidget) {
        console.warn('[LearningPage] 3D regeneration returned null:', visualizationSkipReason);
        return;
      }

      console.log('[LearningPage] 3D regeneration successful:', {
        id: newWidget.id,
        title: newWidget.title,
      });

      // Update local state
      const merged = {
        ...(storedContentRef.current || {}),
        visualizationWidget: newWidget,
      };
      setStoredContent(merged);

      // Save to database (will upsert existing resource)
      await saveResource(
        RESOURCE_TYPES.VISUALIZATION,
        userQuery || conversation?.title || '3D visualization',
        { widget: newWidget },
        assistantMessage?.id || null
      );

      console.log('[LearningPage] 3D regeneration saved to database');
    } catch (err) {
      console.error('[LearningPage] 3D regeneration failed:', err);
    } finally {
      setIsRegenerating3D(false);
    }
  }, [userQuery, isRegenerating3D, messages, generate3D, visualizationSkipReason, saveResource, conversation?.title]);

  // Render engaging loader based on active tab
  const renderLoader = () => {
    const topic = learningContent?.topic || conversation?.title || userQuery;
    return <EngagingLoader tabType={activeTab} topic={topic} />;
  };

  // Check if a specific tab is loading (use local loadingTabs state)
  const isTabLoading = (tabId) => {
    return loadingTabs.has(tabId) || hookLoadingTabs?.has?.(tabId) || checkTabLoading(tabId);
  };

  // Back button component for non-learn views
  const BackButton = () => (
    <button
      onClick={() => setActiveTab('learn')}
      className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to Learn
    </button>
  );

  // Render tab content
  const renderTabContent = () => {
    // Show initial loading state
    if (isLoading) {
      return renderLoader();
    }

    // Show error UI for failed tab loads
    if (tabErrors[activeTab]) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-destructive font-medium mb-2">Failed to load content</p>
          <p className="text-sm text-muted-foreground mb-4">{tabErrors[activeTab]}</p>
          <button
            onClick={() => handleOpenTab(activeTab)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90"
          >
            Try Again
          </button>
        </div>
      );
    }

    // Show tab-specific loading state for lazy loading
    if (isTabLoading(activeTab) || (isLearningContentLoading && !loadedTabs.has(activeTab))) {
      return renderLoader();
    }

    switch (activeTab) {
      case 'learn':
        return (
          <LearnTabView
            summary={learningContent?.summary}
            keyIdeas={learningContent?.key_ideas}
            readCards={readCards}
            onReadCard={handleReadCard}
            onGoToQuiz={() => handleOpenTab('quiz')}
            topic={learningContent?.topic || conversation?.title}
            onGoToFlashcards={() => handleOpenTab('flashcards')}
            onGoToMindMap={() => handleOpenTab('mindmap')}
            learningContent={learningContent}
            depthLevel={depthLevel}
            getConceptStatus={getConceptStatus}
            onRegenerateBlock={handleRegenerateBlock}
            onOpenTab={handleOpenTab}
            cognitiveState={derivedCognitiveState}
            simulationDetection={simulationDetection}
            // NEW: Adaptive response mode support
            responseMode={hookResponseMode || learningContent?.responseMode}
            onExpandContent={handleExpandContent}
            isExpanding={isExpandingContent}
          />
        );

      case 'examples':
        return (
          <>
            <BackButton />
            <ExamplesTabView
              examples={learningContent?.examples}
              onInteraction={handleInteraction}
              updateConceptMastery={updateConceptMastery}
            />
          </>
        );

      case 'flashcards':
        return (
          <>
            <BackButton />
            <FlashcardsView
              flashcards={learningContent?.flashcards}
              userId={userId}
              onInteraction={handleInteraction}
              updateConceptMastery={updateConceptMastery}
            />
          </>
        );

      case 'quiz':
        return (
          <>
            <BackButton />
            <QuizView
              quiz={learningContent?.quiz}
              userId={userId}
              onInteraction={handleInteraction}
              onBackToLearn={() => setActiveTab('learn')}
              updateConceptMastery={updateConceptMastery}
              recordQuizResult={recordQuizResult}
              topic={learningContent?.topic || conversation?.title}
            />
          </>
        );

      case 'mindmap':
        return (
          <>
            <BackButton />
            <MindMapTabView
              mindMap={learningContent?.mind_map}
              keyIdeas={learningContent?.key_ideas}
              getConceptStatus={getConceptStatus}
              weakAreas={weakAreas}
              onGoToQuiz={() => handleOpenTab('quiz')}
            />
          </>
        );

      case 'simulation':
        return (
          <>
            <BackButton />
            <SimulationView
              topic={learningContent?.topic || userQuery || conversation?.title}
              userId={userId}
              onInteraction={handleInteraction}
              accessToken={accessToken}
              simulationDetection={simulationDetection}
            />
          </>
        );

      case 'visualization':
        return (
          <>
            <BackButton />
            {visualizationWidget ? (
              <div className="max-w-4xl mx-auto space-y-4">
                {/* Header with Regenerate button */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">
                    3D Visualization
                  </h2>
                  <button
                    onClick={handleRegenerate3D}
                    disabled={isRegenerating3D || is3DGenerating}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRegenerating3D ? (
                      <>
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerate
                      </>
                    )}
                  </button>
                </div>

                {/* 3D Widget */}
                <WidgetFrame widget={visualizationWidget} onInteraction={handleInteraction} />

                {/* Metadata */}
                {visualizationWidget.topic && (
                  <p className="text-xs text-muted-foreground text-center">
                    Topic: {visualizationWidget.topic}
                  </p>
                )}
              </div>
            ) : is3DGenerating ? (
              <EngagingLoader tabType="visualization" topic={learningContent?.topic || userQuery || conversation?.title} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="text-muted-foreground mb-2">No 3D visualization available</p>
                {visualizationSkipReason && (
                  <p className="text-xs text-muted-foreground mb-4">{visualizationSkipReason}</p>
                )}
                <button
                  onClick={handleRegenerate3D}
                  disabled={isRegenerating3D}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {isRegenerating3D ? 'Generating...' : 'Generate 3D View'}
                </button>
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button
            onClick={() => navigate('/chat/new')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
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

      {/* Header */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate tracking-tight">
                {conversation?.title || 'Learning Session'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Voice Toggle Button */}
              <VoiceToggleButton
                state={voice.state}
                onToggle={() => voice.isActive ? voice.stop() : voice.start()}
                disabled={!accessToken}
              />

              {/* Adaptive Learning Indicator */}
              <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground border border-border/50 rounded-md bg-muted/30">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Adapting
              </span>

              {/* Depth Level Toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowDepthDropdown(!showDepthDropdown)}
                  className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                >
                  <span className="text-muted-foreground">Depth:</span>
                  <span className="font-medium text-foreground capitalize">{depthLevel}</span>
                </button>

                {showDepthDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDepthDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-md shadow-lg z-20 py-1">
                      {DEPTH_LEVELS.map((level) => (
                        <button
                          key={level.id}
                          onClick={() => {
                            setDepthLevel(level.id);
                            setShowDepthDropdown(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                            depthLevel === level.id ? 'bg-muted font-medium' : ''
                          }`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Stats Badge */}
              {stats.studyStreak > 0 && (
                <span className="hidden sm:inline px-2.5 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md">
                  {stats.studyStreak} 
                </span>
              )}

              <button
                onClick={() => navigate('/chat/new')}
                className="px-3 py-2 text-sm font-medium text-foreground border border-border rounded-md hover:bg-muted transition-colors"
              >
                New
              </button>
            </div>
          </div>

          {/* Tab Bar - Shows when more than Learn tab exists */}
          {visibleTabs.length > 1 && (
            <div className="flex gap-1.5 mt-4 p-1.5 neu-pressed rounded-xl overflow-x-auto">
              {visibleTabs.map(tabId => {
                const isActive = activeTab === tabId;
                const isTabLoading = loadingTabs.has(tabId);
                const hasError = !!tabErrors[tabId];

                return (
                  <button
                    key={tabId}
                    onClick={() => handleOpenTab(tabId)}
                    className={`px-3 py-2 text-sm font-medium transition-all rounded-lg whitespace-nowrap ${
                      isActive
                        ? 'neu-raised-sm text-primary'
                        : hasError
                          ? 'text-destructive hover:neu-raised-sm'
                          : 'text-muted-foreground hover:text-foreground hover:neu-raised-sm'
                    }`}
                  >
                    {TAB_LABELS[tabId]}
                    {isTabLoading && (
                      <span className="ml-1.5 w-3 h-3 inline-block border-2 border-current border-t-transparent rounded-full animate-spin" />
                    )}
                    {hasError && !isTabLoading && (
                      <span className="ml-1 text-destructive">!</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* Fact Check Banner */}
          {factCheck && (
            <div className={`mb-4 p-3 rounded-lg border ${
              factCheck.verified
                ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
            }`}>
              <div className="flex items-center gap-2">
                {factCheck.verified ? (
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
                <span className={`font-medium text-sm ${
                  factCheck.verified
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                  {factCheck.verified ? 'Verified' : 'Unverified'}
                  {factCheck.confidence && ` (${Math.round(factCheck.confidence * 100)}%)`}
                </span>
              </div>
              {factCheck.sources && factCheck.sources.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium">Sources:</span>{' '}
                  {factCheck.sources.slice(0, 2).join(', ')}
                  {factCheck.sources.length > 2 && ` +${factCheck.sources.length - 2} more`}
                </div>
              )}
            </div>
          )}

          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

// Wrapper component that provides the Learning Intelligence context
export default function LearningPage() {
  return (
    <LearningIntelligenceProvider>
      <LearningPageContent />
    </LearningIntelligenceProvider>
  );
}
