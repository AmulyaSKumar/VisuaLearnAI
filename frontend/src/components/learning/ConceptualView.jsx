import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ListenButton from './ListenButton';

/**
 * ConceptualView
 * Renders rich explanations for non-CS topics (engines, biology, physics)
 * No code blocks - focuses on visual descriptions and analogies
 */
export default function ConceptualView({
  content,
  topic,
  onOpenTab,
}) {
  const [activeConceptId, setActiveConceptId] = useState(null);
  const [expandedSections, setExpandedSections] = useState(new Set(['concepts']));

  if (!content) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>No content available</p>
      </div>
    );
  }

  const {
    title,
    overview,
    key_concepts = [],
    main_analogy,
    how_it_works,
    interesting_facts = [],
    common_misconceptions = [],
    applications = [],
    learn_more = [],
    difficulty_level,
    estimated_time,
  } = content;

  const toggleSection = (section) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Build readable text for TTS
  const readableText = [
    title,
    overview,
    key_concepts.map(c => `${c.title}. ${c.explanation}`).join(' '),
    main_analogy?.comparison,
  ].filter(Boolean).join('. ');

  const activeConcept = key_concepts.find(c => c.id === activeConceptId) || key_concepts[0];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-medium text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 rounded-md">
              Conceptual
            </span>
            {difficulty_level && (
              <span className="text-xs text-muted-foreground capitalize">
                {difficulty_level}
              </span>
            )}
            {estimated_time && (
              <span className="text-xs text-muted-foreground">
                {estimated_time} min read
              </span>
            )}
          </div>
          <ListenButton text={readableText} variant="default" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {title || topic}
        </h1>
        {overview && (
          <p className="text-base text-muted-foreground leading-relaxed">
            {overview}
          </p>
        )}
      </header>

      {/* Main Analogy Banner */}
      {main_analogy && (
        <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-2">
            Think of it like...
          </p>
          <p className="text-lg font-medium text-foreground">
            {main_analogy.comparison}
          </p>
          {main_analogy.breakdown && (
            <p className="mt-2 text-sm text-muted-foreground">
              {main_analogy.breakdown}
            </p>
          )}
        </div>
      )}

      {/* Key Concepts - Sidebar + Main Content Layout */}
      {key_concepts.length > 0 && (
        <div className="flex gap-6">
          {/* Concept Navigation */}
          <nav className="w-48 flex-shrink-0 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
              Key Concepts
            </p>
            {key_concepts.map((concept, idx) => (
              <button
                key={concept.id || idx}
                onClick={() => setActiveConceptId(concept.id || `concept_${idx}`)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  (activeConceptId || key_concepts[0]?.id) === (concept.id || `concept_${idx}`)
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {concept.title}
              </button>
            ))}
          </nav>

          {/* Active Concept Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeConcept?.id || 'default'}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 space-y-4"
            >
              <h2 className="text-xl font-semibold text-foreground">
                {activeConcept?.title}
              </h2>

              {/* Explanation */}
              <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap">
                {activeConcept?.explanation}
              </p>

              {/* Visual Description */}
              {activeConcept?.visual_description && (
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950/30 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                  <p className="text-xs font-medium text-neutral-700 dark:text-neutral-400 uppercase tracking-wide mb-1">
                    Visualize It
                  </p>
                  <p className="text-sm text-foreground italic">
                    {activeConcept.visual_description}
                  </p>
                </div>
              )}

              {/* Real World Example */}
              {activeConcept?.real_world_example && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Real World Example
                  </p>
                  <p className="text-sm text-foreground">
                    {activeConcept.real_world_example}
                  </p>
                </div>
              )}

              {/* Why It Matters */}
              {activeConcept?.why_it_matters && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Why it matters:</span> {activeConcept.why_it_matters}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* How It Works Section */}
      {how_it_works && how_it_works.steps && how_it_works.steps.length > 0 && (
        <section className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('how_it_works')}
            className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium text-foreground">How It Works</span>
            <svg
              className={`w-4 h-4 text-muted-foreground transition-transform ${expandedSections.has('how_it_works') ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSections.has('how_it_works') && (
            <div className="p-4 space-y-4">
              {how_it_works.overview && (
                <p className="text-sm text-muted-foreground">{how_it_works.overview}</p>
              )}
              <div className="space-y-3">
                {how_it_works.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {step.step || idx + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                      {step.visual && (
                        <p className="text-xs text-muted-foreground italic mt-1">{step.visual}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Interesting Facts */}
      {interesting_facts.length > 0 && (
        <section className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('facts')}
            className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium text-foreground">Interesting Facts</span>
            <svg
              className={`w-4 h-4 text-muted-foreground transition-transform ${expandedSections.has('facts') ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSections.has('facts') && (
            <ul className="p-4 space-y-2">
              {interesting_facts.map((fact, idx) => (
                <li key={idx} className="flex gap-2 text-sm">
                  <span className="text-primary">•</span>
                  <span className="text-foreground">{fact}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Common Misconceptions */}
      {common_misconceptions.length > 0 && (
        <section className="border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('misconceptions')}
            className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-sm font-medium text-foreground">Common Misconceptions</span>
            <svg
              className={`w-4 h-4 text-muted-foreground transition-transform ${expandedSections.has('misconceptions') ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSections.has('misconceptions') && (
            <div className="p-4 space-y-3">
              {common_misconceptions.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <span className="font-medium">Myth:</span> {item.myth}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    <span className="font-medium">Reality:</span> {item.reality}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Applications */}
      {applications.length > 0 && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Applications
          </p>
          <ul className="space-y-1">
            {applications.map((app, idx) => (
              <li key={idx} className="text-sm text-foreground flex gap-2">
                <span className="text-primary">→</span>
                {app}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Learn More & Actions */}
      <div className="pt-6 border-t border-border space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Continue Learning
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onOpenTab?.('quiz')}
            className="flex items-center gap-2 px-4 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Test Your Knowledge
          </button>

          <button
            onClick={() => onOpenTab?.('flashcards')}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Flashcards
          </button>

          <button
            onClick={() => onOpenTab?.('mindmap')}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            Mind Map
          </button>
        </div>

        {/* Learn More Topics */}
        {learn_more.length > 0 && (
          <div className="pt-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Related topics:</span> {learn_more.join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
