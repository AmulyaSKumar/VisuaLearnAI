import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePersona } from "../contexts/PersonaContext";
import { getConversationMessages, supabase, updateAssistantMessageContent } from "../lib/supabase";
import { useLearningContent } from "../hooks/useLearningContent";
import { useLearningResources, RESOURCE_TYPES } from "../hooks/useLearningResources";
import { normalizeLearningContent } from "../utils/normalizeLearningContent";
import { LearningIntelligenceProvider, useLearningIntelligence } from "../contexts/LearningIntelligenceContext";
import InputBar from "../components/InputBar";
import MessageBubble from "../components/MessageBubble";
import LearnTabView from "../components/learning/LearnTabView";
import FlashcardsView from "../components/learning/FlashcardsView";
import QuizView from "../components/learning/QuizView";
import MindMapTabView from "../components/learning/MindMapTabView";
import SimulationView from "../components/learning/SimulationView";
import EngagingLoader from "../components/learning/EngagingLoader";
import { exportToNotion, getNotionStatus } from "../services/notionService";
import { SIMULATION_CONFIG } from "../config/simulationConfig";

// Tab labels for dynamic tab bar
const TAB_LABELS = {
  learn: 'Learn',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  mindmap: 'Mind Map',
  simulation: 'Simulation',
};

const NOTION_ARTIFACT_LABELS = {
  learn: 'Learning Notes',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map',
  simulation: 'Simulation',
};

const TOPIC_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'explain', 'for', 'full', 'fully', 'form',
  'how', 'in', 'is', 'me', 'of', 'the', 'to', 'what', 'with',
]);

function topicTokens(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token && token.length > 1 && !TOPIC_STOP_WORDS.has(token));
}

function isResourceForQuery(resource, query) {
  if (!query) return true;

  const resourceTopic = resource?.topic || resource?.content?.topic || resource?.content?.title;
  if (!resourceTopic) return true;

  const normalizedTopic = String(resourceTopic).trim().toLowerCase();
  const normalizedQuery = String(query).trim().toLowerCase();
  if (!normalizedTopic || !normalizedQuery) return true;
  if (normalizedQuery.includes(normalizedTopic) || normalizedTopic.includes(normalizedQuery)) return true;

  const queryTokens = new Set(topicTokens(normalizedQuery));
  const resourceTokens = topicTokens(normalizedTopic);
  if (resourceTokens.length === 0 || queryTokens.size === 0) return true;

  const matches = resourceTokens.filter(token => queryTokens.has(token)).length;
  return matches / resourceTokens.length >= 0.5;
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index], index)) return index;
  }
  return -1;
}

function getMessageText(message) {
  return message?.content || message?.text || '';
}

// Inner component that uses the Learning Intelligence context
function LearningPageContent() {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { defaultPersona } = usePersona();
  const userId = user?.id;
  const accessToken = session?.access_token;

  const [activeTab, setActiveTab] = useState('learn');
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [storedContent, setStoredContent] = useState(null);
  const storedContentRef = useRef(storedContent); // Ref to avoid stale closure in callbacks
  const transcriptEndRef = useRef(null);
  const [factCheck, setFactCheck] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readCards, setReadCards] = useState(new Set());
  // Only Learn tab by default, other tabs appear when user requests them
  const [, setVisibleTabs] = useState(['learn']);
  const [loadingTabs, setLoadingTabs] = useState(new Set()); // Per-tab loading state
  const [loadedTabs, setLoadedTabs] = useState(new Set(['learn'])); // Track which tabs have content
  const [tabErrors, setTabErrors] = useState({}); // { tabId: "error message" }
  const [userQuery, setUserQuery] = useState(null); // Store user query for lazy loading
  const [documentId, setDocumentId] = useState(null); // Persist selected document for RAG-backed lazy tabs
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [expandedTurnIds, setExpandedTurnIds] = useState(new Set());
  const [turnTabs, setTurnTabs] = useState({});
  const [turnLoadingTabs, setTurnLoadingTabs] = useState({});
  const [turnSimulationDetections, setTurnSimulationDetections] = useState({});

  // Keep ref in sync with state
  useEffect(() => {
    storedContentRef.current = storedContent;
  }, [storedContent]);

  useEffect(() => {
    if (!messages.length) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isFollowUpLoading]);

  // Learning Intelligence context
  const {
    depthLevel,
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
  } = useLearningResources(conversationId, accessToken);

  // NEW: State for content expansion (progressive disclosure)
  const [isExpandingContent, setIsExpandingContent] = useState(false);
  const [showNotionExport, setShowNotionExport] = useState(false);
  const [selectedNotionArtifacts, setSelectedNotionArtifacts] = useState([]);
  const [notionExportState, setNotionExportState] = useState({
    isExporting: false,
    error: null,
    url: null,
  });
  const [notionStatus, setNotionStatus] = useState({ connected: false, configured: true });
  const mindmapCaptureRef = useRef(null);

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
          topic: data.topic,
          domain: data.domain,
          simulationType: data.simulationType,
          confidence: data.confidence,
        });
        setLocalSimulationDetection({
          supported: data.supported,
          topic: data.topic,
          domain: data.domain,
          complexity: data.complexity,
          educationalIntent: data.educationalIntent,
          simulationType: data.simulationType,
          confidence: data.confidence,
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
    if (!simulationDetection.explicit) return;

    const { confidence } = simulationDetection;
    console.log('[LearningPage] Simulation detection:', {
      topic: simulationDetection.topic,
      simulationType: simulationDetection.simulationType,
      confidence,
    });

    // Show simulation tab only for explicit visualize/simulation requests.
    setVisibleTabs(prev => {
      if (prev.includes('simulation')) return prev;
      return [...prev, 'simulation'];
    });

    // Auto-switch only for explicit high-confidence visualization requests.
    if (confidence > SIMULATION_CONFIG.AUTO_RENDER_THRESHOLD) {
      setActiveTab('simulation');
    }

    setSimulationAutoShown(true);
  }, [simulationDetection, simulationAutoShown]);

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
      const resource = persistedResources?.[type];
      if (resource && !isResourceForQuery(resource, userQuery)) return;

      switch (type) {
        case RESOURCE_TYPES.LEARN:
          newTabs.add('learn');
          newLoaded.add('learn');
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
        default:
          break;
      }
    });

    console.log('[LearningPage] Setting visible tabs:', [...newTabs]);
    setVisibleTabs([...newTabs]);
    setLoadedTabs(newLoaded);
  }, [persistedTypes, persistedResources, userQuery]);

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
        if (!isResourceForQuery(resource, userQuery)) return;

        if (resource?.content) {
          // Map resource types to content fields
          switch (type) {
            case RESOURCE_TYPES.LEARN:
              merged = { ...merged, ...resource.content };
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
            default:
              break;
          }
        }
      });
    }

    if (Object.keys(merged).length === 0) return null;
    return merged;
  }, [storedContent, generatedContent, persistedResources, userQuery]);

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

  const conversationTurns = useMemo(() => {
    const turns = [];
    let currentTurn = null;

    messages
      .filter(message => message.role === 'user' || message.role === 'assistant')
      .forEach((message) => {
        if (message.role === 'user') {
          currentTurn = { user: message, assistant: null };
          turns.push(currentTurn);
          return;
        }

        if (currentTurn && !currentTurn.assistant) {
          currentTurn.assistant = message;
        } else {
          turns.push({ user: null, assistant: message });
          currentTurn = null;
        }
      });

    return turns;
  }, [messages]);

  useEffect(() => {
    const latestTurn = conversationTurns[conversationTurns.length - 1];
    const latestTurnId = latestTurn?.user?.id || latestTurn?.assistant?.id;
    if (!latestTurnId) return;

    setExpandedTurnIds(new Set([latestTurnId]));
    setTurnTabs(prev => ({
      ...prev,
      [latestTurnId]: prev[latestTurnId] || 'learn',
    }));
  }, [conversationTurns]);

  const availableNotionArtifacts = useMemo(() => {
    const artifacts = [];
    if (learningContent?.summary || learningContent?.key_ideas?.length) artifacts.push('learn');
    if (learningContent?.quiz?.length) artifacts.push('quiz');
    if (learningContent?.flashcards?.length) artifacts.push('flashcards');
    if (learningContent?.mind_map) artifacts.push('mindmap');
    if (simulationDetection?.supported && simulationDetection?.explicit) artifacts.push('simulation');
    return artifacts;
  }, [learningContent, simulationDetection]);

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
        if (convData?.metadata?.mode !== 'learning') {
          navigate(`/chat/${conversationId}`, { replace: true });
          return;
        }
        setConversation(convData);

        // Load messages
        const msgs = await getConversationMessages(conversationId);
        setMessages(msgs || []);

        const latestUserIndex = findLastIndex(msgs || [], m => m.role === 'user');
        const userMessage = latestUserIndex >= 0 ? msgs[latestUserIndex] : null;
        if (userMessage) {
          setUserQuery(userMessage.content);
        }

        // CHECK 1: Do we have persisted resources from learning_resources table?
        const persistedLearnResource = getResource(RESOURCE_TYPES.LEARN);
        const hasPersistedLearnContent =
          !!persistedLearnResource && isResourceForQuery(persistedLearnResource, userMessage?.content);
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
        const assistantMessagesAfterLatestUser = latestUserIndex >= 0
          ? (msgs || []).slice(latestUserIndex + 1).filter(m => m.role === 'assistant')
          : [];
        const assistantMsg =
          [...assistantMessagesAfterLatestUser].reverse().find(m => m.metadata?.learningContent) ||
          [...(msgs || [])].reverse().find(m => m.role === 'assistant' && m.metadata?.learningContent) ||
          [...assistantMessagesAfterLatestUser].reverse()[0] ||
          [...(msgs || [])].reverse().find(m => m.role === 'assistant');
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
  }, [accessToken, conversationId, navigate, userId, depthLevel, runSimulationDetection, isResourcesLoading, getResource]);
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
      'quiz': RESOURCE_TYPES.QUIZ,
      'flashcards': RESOURCE_TYPES.FLASHCARDS,
      'mindmap': RESOURCE_TYPES.MINDMAP,
      'simulation': RESOURCE_TYPES.SIMULATION,
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
        case 'flashcards':
          return Array.isArray(currentContent?.flashcards) && currentContent.flashcards.length > 0;
        case 'quiz':
          return Array.isArray(currentContent?.quiz) && currentContent.quiz.length > 0;
        case 'mindmap':
          return currentContent?.mind_map?.branches && Array.isArray(currentContent.mind_map.branches) && currentContent.mind_map.branches.length > 0;
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
  }, [loadingTabs, loadedTabs, userQuery, userId, accessToken, depthLevel, conversationId, documentId, hasResource, conversation, saveResource]);
  // Note: fetchTabContent removed from deps - using fetchTabContentRef to avoid infinite loops

  const handleReadCard = (cardId) => {
    setReadCards(prev => new Set(prev).add(cardId));
  };

  const handleInteraction = (data) => {
    console.log('Interaction:', data);
    // Could track interactions for analytics
  };

  const handleMindmapCaptureReady = useCallback((captureFn) => {
    mindmapCaptureRef.current = captureFn;
  }, []);

  const refreshNotionStatus = useCallback(async () => {
    if (!accessToken) return;
    try {
      const status = await getNotionStatus(accessToken);
      setNotionStatus(status);
    } catch (err) {
      setNotionStatus({
        connected: false,
        configured: false,
        error: err.message,
      });
    }
  }, [accessToken]);

  useEffect(() => {
    refreshNotionStatus();
  }, [refreshNotionStatus]);

  const openNotionExport = useCallback(() => {
    setSelectedNotionArtifacts(availableNotionArtifacts);
    setNotionExportState({ isExporting: false, error: null, url: null });
    setShowNotionExport(true);
    refreshNotionStatus();
  }, [availableNotionArtifacts, refreshNotionStatus]);

  const toggleNotionArtifact = useCallback((artifact) => {
    setSelectedNotionArtifacts(prev =>
      prev.includes(artifact)
        ? prev.filter(item => item !== artifact)
        : [...prev, artifact]
    );
  }, []);

  const handleExportToNotion = useCallback(async () => {
    if (!accessToken || selectedNotionArtifacts.length === 0) return;

    setNotionExportState({ isExporting: true, error: null, url: null });
    try {
      let mindmapPngDataUrl = null;
      if (selectedNotionArtifacts.includes('mindmap') && mindmapCaptureRef.current) {
        mindmapPngDataUrl = await mindmapCaptureRef.current();
      }

      const result = await exportToNotion(accessToken, {
        conversationId,
        artifactTypes: selectedNotionArtifacts,
        mindmapPngDataUrl,
      });

      setNotionExportState({ isExporting: false, error: null, url: result.url });
    } catch (err) {
      setNotionExportState({
        isExporting: false,
        error: err.message || 'Failed to export to Notion',
        url: null,
      });
    }
  }, [accessToken, conversationId, selectedNotionArtifacts]);

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

  const readChatStream = useCallback(async (response) => {
    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || 'Failed to generate response');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        let data;
        try {
          data = JSON.parse(line.slice(6));
        } catch {
          continue;
        }

        if (data.type === 'text_delta') {
          fullText += data.text || '';
        } else if (data.type === 'error') {
          throw new Error(data.error || 'Failed to generate response');
        }
      }
    }

    if (buffer.startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.slice(6));
        if (data.type === 'text_delta') {
          fullText += data.text || '';
        } else if (data.type === 'error') {
          throw new Error(data.error || 'Failed to generate response');
        }
      } catch (err) {
        if (!(err instanceof SyntaxError)) {
          throw err;
        }
      }
    }

    return fullText;
  }, []);

  const handleFollowUp = useCallback(async (text) => {
    const query = text?.trim();
    if (!query || !userId || !conversationId || isFollowUpLoading) return;

    setIsFollowUpLoading(true);
    setError(null);
    setTabErrors({});
    setActiveTab('learn');
    setVisibleTabs(['learn']);
    setLoadedTabs(new Set(['learn']));
    setLoadingTabs(new Set());
    setLocalSimulationDetection(null);
    localSimulationDetectionRef.current = null;
    setSimulationAutoShown(false);
    clearContentRef.current();
    setStoredContent(null);
    setFactCheck(null);
    setUserQuery(query);

    let savedUserMessage = null;
    let savedAssistantMessage = null;
    let pendingAssistantId = null;

    try {
      const { data: userMessage, error: userMessageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'user',
          content: query,
          metadata: { documentId },
        })
        .select()
        .single();

      if (userMessageError) throw userMessageError;
      savedUserMessage = userMessage;

      const pendingAssistantMessage = {
        id: `pending-${userMessage.id}`,
        role: 'assistant',
        content: '',
        loading: true,
        created_at: new Date().toISOString(),
      };
      pendingAssistantId = pendingAssistantMessage.id;

      setMessages(prev => [...prev, userMessage, pendingAssistantMessage]);

      const headers = { 'Content-Type': 'application/json' };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const chatMessages = [...messages, userMessage]
        .filter(message => message.role === 'user' || message.role === 'assistant')
        .map(message => ({
          role: message.role,
          content: getMessageText(message),
        }))
        .filter(message => message.content);

      const chatResponse = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: chatMessages,
          userId,
          conversationId,
          personaId: defaultPersona?.id,
          documentId,
          webSearch: webSearchEnabled && !documentId,
        }),
      });

      const assistantText = await readChatStream(chatResponse);

      const { data: assistantMessage, error: assistantMessageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantText || '',
          metadata: { documentId },
        })
        .select()
        .single();

      if (assistantMessageError) throw assistantMessageError;
      savedAssistantMessage = assistantMessage;

      setMessages(prev => prev.map(message =>
        message.id === pendingAssistantId ? assistantMessage : message
      ));

      const learningResponse = await fetch(`${API_BASE}/api/learning-content`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          userId,
          contentType: 'learn',
          preferences: { mode: depthLevel },
          conversationId,
          messageId: savedUserMessage.id,
          documentId,
          webSearch: webSearchEnabled && !documentId,
        }),
      });

      const learningData = await learningResponse.json().catch(() => null);
      if (!learningResponse.ok || !learningData?.success) {
        throw new Error(learningData?.error || 'Failed to generate learning content');
      }

      const learningContent = learningData.content || null;
      const factCheckResult = learningContent?.factCheck || null;

      const { data: updatedAssistantMessage, error: updateAssistantMessageError } = await supabase
        .from('messages')
        .update({
          content: assistantText || learningContent?.summary || '',
          metadata: {
            ...(assistantMessage.metadata || {}),
            documentId,
            learningContent,
            factCheck: factCheckResult,
            simulationDetection: learningData.simulationDetection || null,
          },
        })
        .eq('id', assistantMessage.id)
        .select()
        .single();

      if (updateAssistantMessageError) throw updateAssistantMessageError;

      setMessages(prev => prev.map(message =>
        message.id === assistantMessage.id ? updatedAssistantMessage : message
      ));
      setStoredContent(learningContent);
      setFactCheck(factCheckResult);

      if (learningData.simulationDetection) {
        setLocalSimulationDetection(learningData.simulationDetection);
        localSimulationDetectionRef.current = learningData.simulationDetection;
        setTurnSimulationDetections(prev => ({
          ...prev,
          [savedUserMessage.id]: learningData.simulationDetection,
        }));
      } else {
        runSimulationDetection(query);
      }

      await fetchResources();
    } catch (err) {
      console.error('[LearningPage] Follow-up failed:', err);
      if (savedAssistantMessage) {
        setTabErrors({ learn: err.message || 'Learning cards failed, but the chat answer was saved.' });
      } else {
        setMessages(prev => prev.map(message =>
          message.id === pendingAssistantId
            ? {
                ...message,
                loading: false,
                content: err.message || 'Failed to continue this session',
                metadata: { error: true },
              }
            : message
        ));
        setTabErrors({ learn: err.message || 'Failed to continue this session' });
      }
    } finally {
      setIsFollowUpLoading(false);
    }
  }, [
    API_BASE,
    accessToken,
    clearContentRef,
    conversationId,
    defaultPersona?.id,
    depthLevel,
    documentId,
    fetchResources,
    isFollowUpLoading,
    messages,
    readChatStream,
    runSimulationDetection,
    webSearchEnabled,
    userId,
  ]);

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

  const getTurnContent = useCallback((turn, isLatest = false) => (
    turn?.assistant?.metadata?.learningContent ||
    (isLatest ? learningContent : null)
  ), [learningContent]);

  const hasTurnTabContent = useCallback((turnContent, tabId) => {
    if (tabId === 'learn') return !!turnContent;
    if (tabId === 'quiz') return Array.isArray(turnContent?.quiz) && turnContent.quiz.length > 0;
    if (tabId === 'flashcards') return Array.isArray(turnContent?.flashcards) && turnContent.flashcards.length > 0;
    if (tabId === 'mindmap') return !!turnContent?.mind_map;
    return false;
  }, []);

  const handleTurnTabSelect = useCallback(async (turn, turnId, tabId, isLatest = false) => {
    setTurnTabs(prev => ({ ...prev, [turnId]: tabId }));

    const turnContent = getTurnContent(turn, isLatest);
    const query = getMessageText(turn?.user) || userQuery || conversation?.title;
    const assistantMessage = turn?.assistant;
    if (!query || !assistantMessage?.id || assistantMessage.loading) return;

    if (tabId === 'simulation') {
      const existingDetection =
        turnSimulationDetections[turnId] ||
        assistantMessage.metadata?.simulationDetection ||
        (isLatest ? simulationDetection : null);

      if (existingDetection) return;

      const loadingKey = `${turnId}:${tabId}`;
      setTurnLoadingTabs(prev => ({ ...prev, [loadingKey]: true }));

      try {
        const response = await fetch(`${API_BASE}/api/simulation/detect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ query, requestedArtifact: 'simulation' }),
        });

        const detection = await response.json().catch(() => null);
        if (!response.ok || !detection) {
          throw new Error(detection?.error || 'Failed to check simulation support');
        }

        const updatedMetadata = {
          ...(assistantMessage.metadata || {}),
          simulationDetection: detection,
        };

        const { data: updatedAssistant, error: updateError } = await supabase
          .from('messages')
          .update({ metadata: updatedMetadata })
          .eq('id', assistantMessage.id)
          .select()
          .single();

        if (updateError) throw updateError;

        setTurnSimulationDetections(prev => ({ ...prev, [turnId]: detection }));
        setMessages(prev => prev.map(message =>
          message.id === assistantMessage.id ? updatedAssistant : message
        ));

        if (isLatest) {
          setLocalSimulationDetection(detection);
          localSimulationDetectionRef.current = detection;
        }
      } catch (err) {
        console.error('[LearningPage] Turn simulation detection failed:', err);
        setTabErrors(prev => ({
          ...prev,
          [tabId]: err.message || 'Failed to open simulation',
        }));
      } finally {
        setTurnLoadingTabs(prev => {
          const next = { ...prev };
          delete next[loadingKey];
          return next;
        });
      }

      return;
    }

    if (hasTurnTabContent(turnContent, tabId)) return;

    const loadingKey = `${turnId}:${tabId}`;
    setTurnLoadingTabs(prev => ({ ...prev, [loadingKey]: true }));

    try {
      const apiContentType = (tabId === 'flashcards' || tabId === 'mindmap')
        ? 'flashcards-mindmap'
        : tabId;

      const response = await fetch(`${API_BASE}/api/learning-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          query,
          userId,
          contentType: apiContentType,
          preferences: { mode: depthLevel },
          conversationId,
          messageId: assistantMessage.id,
          documentId: assistantMessage.metadata?.documentId || turn?.user?.metadata?.documentId || documentId,
          webSearch: webSearchEnabled && !documentId,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to generate ${TAB_LABELS[tabId] || tabId}`);
      }

      const previousContent = assistantMessage.metadata?.learningContent || {};
      const mergedContent = {
        ...previousContent,
        ...data.content,
      };

      const updatedMetadata = {
        ...(assistantMessage.metadata || {}),
        learningContent: mergedContent,
        factCheck: data.content?.factCheck || assistantMessage.metadata?.factCheck || null,
      };

      const { data: updatedAssistant, error: updateError } = await supabase
        .from('messages')
        .update({ metadata: updatedMetadata })
        .eq('id', assistantMessage.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setMessages(prev => prev.map(message =>
        message.id === assistantMessage.id ? updatedAssistant : message
      ));

      if (isLatest) {
        setStoredContent(mergedContent);
        if (updatedMetadata.factCheck) setFactCheck(updatedMetadata.factCheck);
      }

      if (apiContentType === 'flashcards-mindmap') {
        setTurnTabs(prev => ({ ...prev, [turnId]: tabId }));
      }
    } catch (err) {
      console.error('[LearningPage] Turn tab generation failed:', err);
      setTabErrors(prev => ({
        ...prev,
        [tabId]: err.message || `Failed to generate ${TAB_LABELS[tabId] || tabId}`,
      }));
    } finally {
      setTurnLoadingTabs(prev => {
        const next = { ...prev };
        delete next[loadingKey];
        return next;
      });
    }
  }, [
    API_BASE,
    accessToken,
    conversation?.title,
    conversationId,
    depthLevel,
    documentId,
    getTurnContent,
    hasTurnTabContent,
    simulationDetection,
    turnSimulationDetections,
    userId,
    userQuery,
    webSearchEnabled,
  ]);

  const renderConversationThread = () => {
    if (conversationTurns.length === 0) return null;

    return (
      <section className="mx-auto max-w-5xl space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Conversation
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {conversationTurns.map((turn, index) => {
            const turnId = turn.user?.id || turn.assistant?.id || `turn-${index}`;
            const isExpanded = expandedTurnIds.has(turnId);
            const userText = getMessageText(turn.user);
            const assistantText = getMessageText(turn.assistant);
            const isLatest = index === conversationTurns.length - 1;
            const turnContent = getTurnContent(turn, isLatest);
            const activeTurnTab = turnTabs[turnId] || 'learn';
            const turnSimulationDetection =
              turnSimulationDetections[turnId] ||
              turn.assistant?.metadata?.simulationDetection ||
              (isLatest ? simulationDetection : null);
            const availableTurnTabs = ['learn', 'quiz', 'flashcards', 'mindmap', 'simulation'];

            return (
              <div
                key={turnId}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedTurnIds(prev => {
                      const next = new Set(prev);
                      if (next.has(turnId)) next.delete(turnId);
                      else next.add(turnId);
                      return next;
                    });
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {userText || 'Assistant response'}
                    </p>
                    {!isExpanded && assistantText && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {assistantText}
                      </p>
                    )}
                  </div>
                  <svg
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-4">
                    {turn.assistant?.loading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        Thinking...
                      </div>
                    ) : (
                      <div className="space-y-4">
                            <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-muted/40 p-1.5">
                              {availableTurnTabs.map(tabId => {
                                const loadingKey = `${turnId}:${tabId}`;
                                const isTurnTabLoading = !!turnLoadingTabs[loadingKey];

                                return (
                                  <button
                                    key={tabId}
                                    type="button"
                                    onClick={() => handleTurnTabSelect(turn, turnId, tabId, isLatest)}
                                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                      activeTurnTab === tabId
                                        ? 'bg-card text-primary shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                  >
                                    {TAB_LABELS[tabId]}
                                    {isTurnTabLoading && (
                                      <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>

                            {activeTurnTab === 'learn' && (
                              <div className="space-y-4">
                                {assistantText && (
                                  <div className={`rounded-lg border px-4 py-3 ${
                                    turn.assistant?.metadata?.error
                                      ? 'border-destructive/20 bg-destructive/10 text-destructive'
                                      : 'border-border bg-background'
                                  }`}>
                                    <MessageBubble content={assistantText} showTTS={!turn.assistant?.metadata?.error} />
                                  </div>
                                )}

                                {turnContent ? (
                                  <LearnTabView
                                    summary={turnContent?.summary}
                                    keyIdeas={turnContent?.key_ideas}
                                    readCards={readCards}
                                    onReadCard={handleReadCard}
                                    topic={turnContent?.topic || userText || conversation?.title}
                                    learningContent={turnContent}
                                    depthLevel={depthLevel}
                                    getConceptStatus={getConceptStatus}
                                    onRegenerateBlock={isLatest ? handleRegenerateBlock : undefined}
                                    onOpenTab={(tabId) => setTurnTabs(prev => ({ ...prev, [turnId]: tabId }))}
                                    cognitiveState={derivedCognitiveState}
                                    simulationDetection={turnSimulationDetection}
                                    responseMode={turnContent?.responseMode}
                                    onExpandContent={isLatest ? handleExpandContent : undefined}
                                    isExpanding={isLatest && isExpandingContent}
                                  />
                                ) : (
                                  <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                                    Click Learn to generate learning notes for this question.
                                  </div>
                                )}
                              </div>
                            )}

                            {activeTurnTab === 'quiz' && hasTurnTabContent(turnContent, 'quiz') && (
                              <QuizView
                                quiz={turnContent?.quiz}
                                userId={userId}
                                onInteraction={handleInteraction}
                                onBackToLearn={() => setTurnTabs(prev => ({ ...prev, [turnId]: 'learn' }))}
                                updateConceptMastery={updateConceptMastery}
                                recordQuizResult={recordQuizResult}
                                topic={turnContent?.topic || userText || conversation?.title}
                              />
                            )}

                            {activeTurnTab === 'quiz' && !hasTurnTabContent(turnContent, 'quiz') && (
                              <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                                Click Quiz to generate questions for this answer.
                              </div>
                            )}

                            {activeTurnTab === 'flashcards' && hasTurnTabContent(turnContent, 'flashcards') && (
                              <FlashcardsView
                                flashcards={turnContent?.flashcards}
                                userId={userId}
                                onInteraction={handleInteraction}
                                updateConceptMastery={updateConceptMastery}
                              />
                            )}

                            {activeTurnTab === 'flashcards' && !hasTurnTabContent(turnContent, 'flashcards') && (
                              <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                                Click Flashcards to generate cards for this answer.
                              </div>
                            )}

                            {activeTurnTab === 'mindmap' && hasTurnTabContent(turnContent, 'mindmap') && (
                              <MindMapTabView
                                mindMap={turnContent?.mind_map}
                                keyIdeas={turnContent?.key_ideas}
                                getConceptStatus={getConceptStatus}
                                weakAreas={weakAreas}
                                onGoToQuiz={() => setTurnTabs(prev => ({ ...prev, [turnId]: 'quiz' }))}
                                onCaptureReady={isLatest ? handleMindmapCaptureReady : undefined}
                              />
                            )}

                            {activeTurnTab === 'mindmap' && !hasTurnTabContent(turnContent, 'mindmap') && (
                              <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                                Click Mind Map to generate a map for this answer.
                              </div>
                            )}

                            {activeTurnTab === 'simulation' && turnSimulationDetection?.supported && (
                              <SimulationView
                                topic={turnContent?.topic || userText || conversation?.title}
                                userId={userId}
                                onInteraction={handleInteraction}
                                accessToken={accessToken}
                                simulationDetection={turnSimulationDetection}
                              />
                            )}

                            {activeTurnTab === 'simulation' && !turnSimulationDetection?.supported && (
                              <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                                {turnLoadingTabs[`${turnId}:simulation`]
                                  ? 'Checking simulation support...'
                                  : 'Click Simulation to check and open an interactive visual for this question.'}
                              </div>
                            )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={transcriptEndRef} />
        </div>
      </section>
    );
  };

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
            onSaveToNotion={openNotionExport}
          />
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
              onCaptureReady={handleMindmapCaptureReady}
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
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight break-words sm:truncate">
                {conversation?.title || 'Learning Session'}
              </h1>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {/* Stats Badge */}
              {stats.studyStreak > 0 && (
                <span className="hidden sm:inline px-2.5 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md">
                  {stats.studyStreak} 
                </span>
              )}

              <button
                onClick={() => navigate('/chat/new')}
                className="group inline-flex h-10 min-w-10 items-center justify-center overflow-hidden rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                title="New convo"
                aria-label="New convo"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                <span className="hidden max-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 group-hover:ml-2 group-hover:max-w-24 sm:inline">
                  New convo
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
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

          {messages.length > 0 ? renderConversationThread() : renderTabContent()}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-border bg-background/95 px-3 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-4xl space-y-3">
          <InputBar
            onSend={handleFollowUp}
            inputDisabled={isFollowUpLoading || isLoading || isLearningContentLoading}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={() => setWebSearchEnabled(prev => !prev)}
            onDocumentUpload={() => {
              setTabErrors({ learn: 'Document upload is available from the new chat screen. Existing selected documents still work in this thread.' });
            }}
            onGenerateArtifact={(artifact) => {
              if (artifact === 'quiz') handleOpenTab('quiz');
              if (artifact === 'flashcards') handleOpenTab('flashcards');
              if (artifact === 'mindmap') handleOpenTab('mindmap');
              if (artifact === 'simulation') handleOpenTab('simulation');
            }}
          />
        </div>
      </div>

      {showNotionExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl">
            <div className="p-5 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Save to Notion</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Export selected learning artifacts to your Notion learning library.
                  </p>
                </div>
                <button
                  onClick={() => setShowNotionExport(false)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {!notionStatus.connected && (
                <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm text-amber-800 dark:text-amber-200 space-y-3">
                  <div>
                    <p className="font-semibold text-foreground">Connect Notion before exporting</p>
                    <p className="mt-1 text-muted-foreground">
                      VisuaLearn saves structured notes directly into your Notion workspace. Connect your Notion account once, then come back here and export this session.
                    </p>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>Open Settings.</li>
                    <li>In Notion Export, click Connect Notion.</li>
                    <li>Choose the Notion workspace and page access.</li>
                    <li>Return to this learning session and click Export.</li>
                  </ol>
                  <button
                    type="button"
                    onClick={() => navigate('/settings')}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Go to Settings
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {availableNotionArtifacts.map(artifact => (
                  <label
                    key={artifact}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {NOTION_ARTIFACT_LABELS[artifact] || artifact}
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedNotionArtifacts.includes(artifact)}
                      onChange={() => toggleNotionArtifact(artifact)}
                      className="w-4 h-4"
                    />
                  </label>
                ))}
              </div>

              {notionExportState.error && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-sm text-destructive">
                  {notionExportState.error}
                </div>
              )}

              {notionExportState.url && (
                <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10 text-sm text-green-700 dark:text-green-300">
                  Exported successfully.{' '}
                  <a
                    href={notionExportState.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline"
                  >
                    Open in Notion
                  </a>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setShowNotionExport(false)}
                className="px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleExportToNotion}
                disabled={
                  notionExportState.isExporting ||
                  !notionStatus.connected ||
                  selectedNotionArtifacts.length === 0
                }
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {notionExportState.isExporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotionExport && selectedNotionArtifacts.includes('mindmap') && learningContent?.mind_map && (
        <div className="fixed -left-[10000px] top-0 w-[1000px] bg-background pointer-events-none">
          <MindMapTabView
            mindMap={learningContent.mind_map}
            keyIdeas={learningContent?.key_ideas}
            getConceptStatus={getConceptStatus}
            weakAreas={weakAreas}
            onCaptureReady={handleMindmapCaptureReady}
          />
        </div>
      )}
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
