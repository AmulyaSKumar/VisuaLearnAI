import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getConversationMessages, supabase, updateAssistantMessageContent } from "../lib/supabase";
import { useLearningContent } from "../hooks/useLearningContent";
import { normalizeLearningContent } from "../utils/normalizeLearningContent";
import { LearningIntelligenceProvider, useLearningIntelligence } from "../contexts/LearningIntelligenceContext";
import LearnTabView from "../components/learning/LearnTabView";
import ExamplesTabView from "../components/learning/ExamplesTabView";
import FlashcardsView from "../components/learning/FlashcardsView";
import QuizView from "../components/learning/QuizView";
import MindMapTabView from "../components/learning/MindMapTabView";
import SimulationView from "../components/learning/SimulationView";
import EngagingLoader from "../components/learning/EngagingLoader";

// Tab labels for dynamic tab bar
const TAB_LABELS = {
  learn: 'Learn',
  examples: 'Examples',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  mindmap: 'Mind Map',
  simulation: 'Simulation'
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
  const userId = user?.id;
  const accessToken = session?.access_token;

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
  const [visibleTabs, setVisibleTabs] = useState(['learn', 'simulation']); // Dynamic tabs - simulation always visible
  const [loadingTabs, setLoadingTabs] = useState(new Set()); // Per-tab loading state
  const [loadedTabs, setLoadedTabs] = useState(new Set(['learn'])); // Track which tabs have content
  const [tabErrors, setTabErrors] = useState({}); // { tabId: "error message" }
  const [userQuery, setUserQuery] = useState(null); // Store user query for lazy loading

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

  // Learning content hook (fallback if not stored)
  const {
    content: generatedContent,
    isLoading: isLearningContentLoading,
    loadingTabs: hookLoadingTabs,
    fetchTabContent,
    isTabLoading: checkTabLoading,
    regenerateBlock,
  } = useLearningContent();

  // Use stored content first, fallback to generated - normalize to handle field name variations
  const rawContent = storedContent || generatedContent;
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
      rawKeys: Object.keys(rawContent || {})
    });
    return normalized;
  }, [rawContent]);

  // Load conversation and messages
  useEffect(() => {
    if (!conversationId) {
      navigate('/chat/new');
      return;
    }

    async function loadSession() {
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

        // Try to get stored learning content from assistant message metadata
        const assistantMsg = msgs?.find(m => m.role === 'assistant');
        const stored = assistantMsg?.metadata?.learningContent;
        const storedFact = assistantMsg?.metadata?.factCheck;

        // Store user query for lazy loading
        const userMessage = msgs?.find(m => m.role === 'user');
        if (userMessage) {
          setUserQuery(userMessage.content);
        }

        if (stored) {
          console.log('[LearningPage] Using stored content from DB');
          setStoredContent(stored);
          setFactCheck(storedFact || stored.factCheck || null);

          // Detect which content types ACTUALLY exist in DB (safe checks)
          const availableTabs = ['learn']; // Learn always exists
          if (Array.isArray(stored.examples) && stored.examples.length > 0) {
            availableTabs.push('examples');
          }
          if (Array.isArray(stored.flashcards) && stored.flashcards.length > 0) {
            availableTabs.push('flashcards');
          }
          if (Array.isArray(stored.quiz) && stored.quiz.length > 0) {
            availableTabs.push('quiz');
          }
          if (stored.mind_map?.branches && Array.isArray(stored.mind_map.branches) && stored.mind_map.branches.length > 0) {
            availableTabs.push('mindmap');
          }

          setVisibleTabs(availableTabs);
          setLoadedTabs(new Set(availableTabs));
        } else if (userMessage) {
          // Fallback: only fetch learn content initially (lazy loading)
          console.log('[LearningPage] Fetching learn content for:', userMessage.content?.slice(0, 30));
          // Pass preferences with mode based on depthLevel
          fetchTabContent(userMessage.content, 'learn', userId, accessToken, { mode: depthLevel });
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        setError('Failed to load learning session');
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [accessToken, conversationId, fetchTabContent, navigate, userId, depthLevel]);

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

    // Use ref to get current storedContent (avoids stale closure)
    const currentContent = storedContentRef.current;

    // Check if content exists in storedContent (from DB)
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

      const newContent = await fetchTabContent(
        userQuery,
        apiContentType,
        userId,
        accessToken,
        { mode: depthLevel }
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
  }, [loadingTabs, loadedTabs, userQuery, userId, accessToken, depthLevel, fetchTabContent, conversationId]);

  const handleReadCard = (cardId) => {
    setReadCards(prev => new Set(prev).add(cardId));
  };

  const handleInteraction = (data) => {
    console.log('Interaction:', data);
    // Could track interactions for analytics
  };

  // Handle block regeneration
  const handleRegenerateBlock = useCallback(async (conceptId, block, blockIndex) => {
    if (!userQuery && !conversation?.title) return;

    const query = userQuery || conversation?.title;
    const newBlock = await regenerateBlock(query, block, accessToken, { mode: depthLevel });

    if (newBlock) {
      // Update the content with the new block
      setStoredContent(prev => {
        if (!prev) return prev;
        const updated = { ...prev };
        const keyIdeas = [...(updated.key_ideas || [])];
        const conceptIndex = keyIdeas.findIndex(idea => idea.id === conceptId);

        if (conceptIndex !== -1 && keyIdeas[conceptIndex].blocks) {
          keyIdeas[conceptIndex] = {
            ...keyIdeas[conceptIndex],
            blocks: keyIdeas[conceptIndex].blocks.map((b, idx) =>
              idx === blockIndex ? { ...b, ...newBlock } : b
            )
          };
          updated.key_ideas = keyIdeas;
        }
        return updated;
      });
    }
  }, [userQuery, conversation?.title, accessToken, depthLevel, regenerateBlock]);


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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate tracking-tight">
                {conversation?.title || 'Learning Session'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
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

          {/* Dynamic Tab Bar - only shows when more than Learn tab exists */}
          {visibleTabs.length > 1 && (
            <div className="flex gap-1 mt-3 border-t border-border pt-3">
              {visibleTabs.map(tabId => {
                const isActive = activeTab === tabId;
                const isLoading = loadingTabs.has(tabId);
                const hasError = !!tabErrors[tabId];

                return (
                  <button
                    key={tabId}
                    onClick={() => setActiveTab(tabId)}
                    className={`px-4 py-2 text-sm font-medium transition-colors rounded-md ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : hasError
                          ? 'text-destructive hover:bg-destructive/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {TAB_LABELS[tabId]}
                    {isLoading && (
                      <span className="ml-2 w-3 h-3 inline-block border-2 border-current border-t-transparent rounded-full animate-spin" />
                    )}
                    {hasError && !isLoading && (
                      <span className="ml-1">!</span>
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
