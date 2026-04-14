import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getConversationMessages, supabase } from "../lib/supabase";
import { useLearningContent } from "../hooks/useLearningContent";
import { normalizeLearningContent } from "../utils/normalizeLearningContent";
import { LearningIntelligenceProvider, useLearningIntelligence } from "../contexts/LearningIntelligenceContext";
import LearnTabView from "../components/learning/LearnTabView";
import ExamplesTabView from "../components/learning/ExamplesTabView";
import FlashcardsView from "../components/learning/FlashcardsView";
import QuizView from "../components/learning/QuizView";
import MindMapTabView from "../components/learning/MindMapTabView";
import { LearnSkeleton, FlashcardSkeleton, QuizSkeleton, MindMapSkeleton } from "../components/learning/SkeletonLoader";

const TABS = [
  { id: 'learn', label: 'Learn', icon: 'book' },
  { id: 'examples', label: 'Examples', icon: 'lightbulb' },
  { id: 'flashcards', label: 'Flashcards', icon: 'cards' },
  { id: 'quiz', label: 'Quiz', icon: 'quiz' },
  { id: 'mindmap', label: 'Mind Map', icon: 'map' },
];

const TAB_ICONS = {
  book: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  lightbulb: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  cards: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  quiz: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  map: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  ),
};

// Depth levels for content complexity
const DEPTH_LEVELS = [
  { id: 'simple', label: 'Simple', description: 'Easy explanations, no jargon' },
  { id: 'balanced', label: 'Balanced', description: 'Mix of simple and technical' },
  { id: 'technical', label: 'Technical', description: 'Full detail, industry terms' },
];

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
  const [factCheck, setFactCheck] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readCards, setReadCards] = useState(new Set());
  const [showDepthDropdown, setShowDepthDropdown] = useState(false);

  // Learning Intelligence context
  const {
    depthLevel,
    setDepthLevel,
    updateConceptMastery,
    recordQuizResult,
    getConceptStatus,
    weakAreas,
    stats,
  } = useLearningIntelligence();

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      // Number keys 1-5 for tab switching
      if (e.key >= '1' && e.key <= '5') {
        const tabIndex = parseInt(e.key) - 1;
        if (TABS[tabIndex]) {
          setActiveTab(TABS[tabIndex].id);
        }
        return;
      }

      // Arrow keys for tab navigation
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const currentIndex = TABS.findIndex(t => t.id === activeTab);
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          setActiveTab(TABS[currentIndex - 1].id);
        } else if (e.key === 'ArrowRight' && currentIndex < TABS.length - 1) {
          setActiveTab(TABS[currentIndex + 1].id);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Learning content hook (fallback if not stored)
  const { content: generatedContent, isLoading: isLearningContentLoading, generateContent } = useLearningContent();

  // Use stored content first, fallback to generated - normalize to handle field name variations
  const rawContent = storedContent || generatedContent;
  const learningContent = useMemo(() => {
    if (!rawContent) return null;
    const normalized = normalizeLearningContent(rawContent);
    console.log('LearningPage - Raw content:', rawContent);
    console.log('LearningPage - Normalized content:', normalized);
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

        if (stored) {
          setStoredContent(stored);
          setFactCheck(storedFact || stored.factCheck || null);
        } else {
          // Fallback: regenerate if not stored
          const userMessage = msgs?.find(m => m.role === 'user');
          if (userMessage) {
            generateContent(userMessage.content, userId, false, accessToken);
          }
        }
      } catch (err) {
        console.error('Failed to load session:', err);
        setError('Failed to load learning session');
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();
  }, [accessToken, conversationId, generateContent, navigate, userId]);

  const handleReadCard = (cardId) => {
    setReadCards(prev => new Set(prev).add(cardId));
  };

  const handleInteraction = (data) => {
    console.log('Interaction:', data);
    // Could track interactions for analytics
  };

  const goToQuiz = () => {
    setActiveTab('quiz');
  };

  // Render skeleton loader based on active tab
  const renderSkeleton = () => {
    switch (activeTab) {
      case 'learn':
        return <LearnSkeleton />;
      case 'flashcards':
        return <FlashcardSkeleton />;
      case 'quiz':
        return <QuizSkeleton />;
      case 'mindmap':
        return <MindMapSkeleton />;
      default:
        return <LearnSkeleton />;
    }
  };

  // Render tab content
  const renderTabContent = () => {
    if (isLoading || isLearningContentLoading) {
      return renderSkeleton();
    }

    switch (activeTab) {
      case 'learn':
        return (
          <LearnTabView
            summary={learningContent?.summary}
            keyIdeas={learningContent?.key_ideas}
            readCards={readCards}
            onReadCard={handleReadCard}
            onGoToQuiz={goToQuiz}
            topic={learningContent?.topic || conversation?.title}
            onGoToFlashcards={() => setActiveTab('flashcards')}
            onGoToMindMap={() => setActiveTab('mindmap')}
            learningContent={learningContent}
            depthLevel={depthLevel}
            getConceptStatus={getConceptStatus}
          />
        );

      case 'examples':
        return (
          <ExamplesTabView
            examples={learningContent?.examples}
            onInteraction={handleInteraction}
            updateConceptMastery={updateConceptMastery}
          />
        );

      case 'flashcards':
        return (
          <FlashcardsView
            flashcards={learningContent?.flashcards}
            userId={userId}
            onInteraction={handleInteraction}
            updateConceptMastery={updateConceptMastery}
          />
        );

      case 'quiz':
        return (
          <QuizView
            quiz={learningContent?.quiz}
            userId={userId}
            onInteraction={handleInteraction}
            onBackToLearn={() => setActiveTab('learn')}
            updateConceptMastery={updateConceptMastery}
            recordQuizResult={recordQuizResult}
            topic={learningContent?.topic || conversation?.title}
          />
        );

      case 'mindmap':
        return (
          <MindMapTabView
            mindMap={learningContent?.mind_map}
            keyIdeas={learningContent?.key_ideas}
            getConceptStatus={getConceptStatus}
            weakAreas={weakAreas}
            onGoToQuiz={goToQuiz}
          />
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
      <div className="flex-shrink-0 border-b border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-lg font-semibold text-foreground truncate">
                  {conversation?.title || 'Learning Session'}
                </h1>
                <p className="text-xs text-muted-foreground truncate hidden sm:block">
                  {learningContent?.topic || 'Interactive learning workspace'}
                </p>
              </div>
            </div>

            {/* Depth Level Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowDepthDropdown(!showDepthDropdown)}
                className="flex items-center gap-2 px-3 min-h-[44px] text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                <span className="hidden sm:inline capitalize">{depthLevel}</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDepthDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDepthDropdown(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-medium text-muted-foreground">Content Depth</p>
                    </div>
                    {DEPTH_LEVELS.map((level) => (
                      <button
                        key={level.id}
                        onClick={() => {
                          setDepthLevel(level.id);
                          setShowDepthDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors ${
                          depthLevel === level.id ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">{level.label}</span>
                          {depthLevel === level.id && (
                            <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{level.description}</p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Stats Badge */}
            {stats.studyStreak > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                {stats.studyStreak} day streak
              </div>
            )}

            <button
              onClick={() => navigate('/chat/new')}
              className="flex items-center justify-center gap-2 px-3 min-h-[44px] text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Session</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-2 sm:px-4">
          <div className="flex gap-1 py-2 overflow-x-auto scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
            {TABS.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 min-h-[44px] text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title={`Press ${index + 1} to switch`}
              >
                {TAB_ICONS[tab.icon]}
                <span className="hidden xs:inline sm:inline">{tab.label}</span>
                <span className={`hidden sm:inline-block text-[10px] ml-1 px-1.5 py-0.5 rounded ${
                  activeTab === tab.id
                    ? 'bg-primary-foreground/20'
                    : 'bg-muted group-hover:bg-muted-foreground/10'
                }`}>
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
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
