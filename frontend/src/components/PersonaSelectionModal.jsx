import { useState } from 'react';
import { usePersona } from '../contexts/PersonaContext';
import PersonaCard from './PersonaCard';

/**
 * PersonaSelectionModal: First-time setup modal for selecting AI persona
 * Shows only when user has no default persona set (DB is source of truth)
 */
export default function PersonaSelectionModal() {
  const { systemPersonas, selectDefaultPersona, isLoading } = usePersona();
  const [selectedId, setSelectedId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSelect = (persona) => {
    setSelectedId(persona.id);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selectedId) {
      setError('Please select a persona to continue');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await selectDefaultPersona(selectedId);
      // Modal will auto-close because hasCompletedSetup will become true
    } catch (err) {
      console.error('Failed to set default persona:', err);
      setError(err.message || 'Failed to save selection. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading personas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground">
            Welcome to VisuaLearn
          </h2>
          <p className="text-muted-foreground mt-2">
            Choose your AI tutor persona. This determines how the AI communicates with you.
            You can change this anytime in Settings.
          </p>
        </div>

        {/* Persona Grid */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemPersonas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isSelected={selectedId === persona.id}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {systemPersonas.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No personas available. Please contact support.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-muted/30">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedId
                ? `Selected: ${systemPersonas.find(p => p.id === selectedId)?.name}`
                : 'Select a persona to continue'
              }
            </p>

            <button
              onClick={handleConfirm}
              disabled={!selectedId || isSaving}
              className={`
                px-6 py-2.5 rounded-lg font-medium transition-all duration-200
                ${selectedId && !isSaving
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
                }
              `}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
