import { useState, useEffect } from 'react';
import MindMapView from './learning/MindMapView';
import FlashcardsView from './learning/FlashcardsView';
import QuizView from './learning/QuizView';
import ConceptsView from './learning/ConceptsView';
import SimulationView from './learning/SimulationView';

const TABS = [
  { id: 'simulation', label: 'Simulation', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'mindmap', label: 'Mind Map', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { id: 'flashcards', label: 'Flashcards', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'quiz', label: 'Quiz', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'concepts', label: 'Concepts', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
];

const SINGLE_ARTIFACT_TABS = new Set(['simulation', 'mindmap', 'flashcards', 'quiz']);

export default function LearningWorkspace({ content, isLoading, userId, onInteraction, accessToken, initialTab = 'quiz' }) {
  const [activeTab, setActiveTab] = useState(initialTab || 'quiz');
  const requestedSingleTab = SINGLE_ARTIFACT_TABS.has(initialTab) ? initialTab : null;
  const availableTabs = TABS.filter(tab => {
    if (tab.id === 'simulation') return !!content?.simulationDetection?.supported;
    if (tab.id === 'mindmap') return !!(content?.mindmap || content?.mind_map);
    if (tab.id === 'flashcards') return Array.isArray(content?.flashcards) && content.flashcards.length > 0;
    if (tab.id === 'quiz') return Array.isArray(content?.quiz) && content.quiz.length > 0;
    if (tab.id === 'concepts') return Array.isArray(content?.concepts) && content.concepts.length > 0;
    return false;
  });
  const visibleTabs = requestedSingleTab
    ? availableTabs.filter(tab => tab.id === requestedSingleTab)
    : availableTabs;
  const selectedTab = visibleTabs.some(tab => tab.id === activeTab)
    ? activeTab
    : visibleTabs[0]?.id;

  useEffect(() => {
    setActiveTab(initialTab || 'quiz');
  }, [initialTab]);

  // Track tab changes
  useEffect(() => {
    if (onInteraction && activeTab) {
      onInteraction({ type: 'tab_change', tab: activeTab });
    }
  }, [activeTab, onInteraction]);

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 bg-muted rounded-lg"></div>
          <div className="h-6 w-48 bg-muted rounded"></div>
        </div>
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-20 bg-muted rounded-lg"></div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
          <div className="h-4 bg-muted rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (!content) return null;

  const renderTabContent = () => {
    switch (selectedTab) {
      case 'simulation':
        return (
          <SimulationView
            topic={content.topic}
            userId={userId}
            onInteraction={onInteraction}
            accessToken={accessToken}
            simulationDetection={content.simulationDetection}
          />
        );
      case 'mindmap':
        return (
          <MindMapView
            mindmap={content.mindmap || content.mind_map}
            topic={content.topic}
          />
        );
      case 'flashcards':
        return (
          <FlashcardsView
            flashcards={content.flashcards}
            userId={userId}
            onInteraction={onInteraction}
          />
        );
      case 'quiz':
        return (
          <QuizView
            quiz={content.quiz}
            userId={userId}
            onInteraction={onInteraction}
          />
        );
      case 'concepts':
        return (
          <ConceptsView
            concepts={content.concepts}
            keyTakeaways={content.keyTakeaways}
          />
        );
      default:
        return null;
    }
  };

  if (!selectedTab) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Tabs */}
      {visibleTabs.length > 1 && (
      <div className="border-b border-border bg-muted/20 overflow-x-auto">
        <div className="flex px-2 py-1 gap-1 min-w-max">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                selectedTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Content Area */}
      <div className="p-4 min-h-[300px] max-h-[600px] overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}
