import { useState, useEffect } from 'react';
import MindMapView from './learning/MindMapView';
import FlashcardsView from './learning/FlashcardsView';
import QuizView from './learning/QuizView';
import InteractiveText from './learning/InteractiveText';
import LearningPathView from './learning/LearningPathView';
import ConceptsView from './learning/ConceptsView';
import ExamplesView from './learning/ExamplesView';

const TABS = [
  { id: 'text', label: 'Explanation', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'audio', label: 'Audio', icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z' },
  { id: 'mindmap', label: 'Mind Map', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { id: 'flashcards', label: 'Flashcards', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { id: 'quiz', label: 'Quiz', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'concepts', label: 'Concepts', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
  { id: 'examples', label: 'Examples', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
];

export default function LearningWorkspace({ content, isLoading, userId, onInteraction }) {
  const [activeTab, setActiveTab] = useState('text');
  const [mode, setMode] = useState('balanced'); // simple, balanced, technical

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
    switch (activeTab) {
      case 'text':
        return (
          <InteractiveText
            content={content}
            mode={mode}
            userId={userId}
          />
        );
      case 'audio':
        return (
          <InteractiveText
            content={content}
            mode={mode}
            userId={userId}
            audioMode={true}
          />
        );
      case 'mindmap':
        return (
          <MindMapView
            mindmap={content.mindmap}
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
      case 'examples':
        return (
          <ExamplesView
            examples={content.examples}
            tryThis={content.tryThis}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{content.title || content.topic}</h3>
              <p className="text-xs text-muted-foreground">{content.summary?.slice(0, 80)}...</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            {['simple', 'balanced', 'technical'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  mode === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Learning Path */}
        {content.learningPath && (
          <LearningPathView learningPath={content.learningPath} compact={true} />
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-border bg-muted/20 overflow-x-auto">
        <div className="flex px-2 py-1 gap-1 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
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

      {/* Content Area */}
      <div className="p-4 min-h-[300px] max-h-[600px] overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}
