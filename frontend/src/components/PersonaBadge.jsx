import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * PersonaBadge: Shows active persona in chat header
 * Clickable to navigate to settings, hover shows tooltip
 */
export default function PersonaBadge({ persona }) {
  const navigate = useNavigate();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!persona) return null;

  return (
    <div className="relative">
      <button
        onClick={() => navigate('/settings')}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
        title="Click to change persona"
      >
        <span className="text-xs text-muted-foreground">Persona:</span>
        <span className="text-sm font-medium text-primary">{persona.name}</span>
      </button>

      {/* Hover tooltip with description */}
      {showTooltip && (
        <div className="absolute top-full mt-2 left-0 w-64 p-3 bg-card border border-border rounded-lg shadow-lg z-50">
          <p className="text-sm font-medium text-foreground">{persona.name}</p>
          {persona.description && (
            <p className="text-xs text-muted-foreground mt-1">{persona.description}</p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
              {persona.tone}
            </span>
            <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
              {persona.verbosity}
            </span>
            <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
              {persona.strength}%
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 italic">
            Click to change in Settings
          </p>
        </div>
      )}
    </div>
  );
}
