import { useState } from 'react';

/**
 * Tone badge colors
 */
const TONE_COLORS = {
  friendly: 'bg-green-500/10 text-green-600 dark:text-green-400',
  formal: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  casual: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  technical: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  encouraging: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  rigorous: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

/**
 * PersonaCard: Reusable card for displaying persona info
 * Used in PersonaSelectionModal and SettingsPage
 */
export default function PersonaCard({
  persona,
  isSelected = false,
  onSelect,
  onEdit,
  onDelete,
  showActions = false,
  compact = false,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const toneColorClass = TONE_COLORS[persona.tone] || TONE_COLORS.friendly;

  if (compact) {
    return (
      <button
        onClick={() => onSelect?.(persona)}
        className={`
          w-full text-left p-3 rounded-lg border transition-all duration-200
          ${isSelected
            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
          }
        `}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-foreground">{persona.name}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${toneColorClass}`}>
            {persona.tone}
          </span>
        </div>
        {persona.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
            {persona.description}
          </p>
        )}
      </button>
    );
  }

  return (
    <div
      className={`
        relative rounded-xl border transition-all duration-200 overflow-hidden
        ${isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border bg-card hover:border-primary/50'
        }
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* System badge */}
      {persona.is_system && (
        <div className="absolute top-2 right-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            System
          </span>
        </div>
      )}

      {/* Main content - clickable */}
      <button
        onClick={() => onSelect?.(persona)}
        className="w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-inset rounded-xl"
      >
        {/* Header */}
        <div className="mb-2">
          <h3 className="font-semibold text-foreground text-lg">{persona.name}</h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {persona.description || 'No description'}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className={`text-xs px-2 py-1 rounded-full ${toneColorClass}`}>
            {persona.tone}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
            {persona.verbosity}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
            {persona.strength}% adherence
          </span>
        </div>

        {/* Rules preview */}
        {persona.rules && persona.rules.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Key behaviors:</p>
            <ul className="text-xs text-foreground space-y-0.5">
              {persona.rules.slice(0, 2).map((rule, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="text-primary">+</span>
                  <span className="line-clamp-1">{rule}</span>
                </li>
              ))}
              {persona.rules.length > 2 && (
                <li className="text-muted-foreground">
                  +{persona.rules.length - 2} more...
                </li>
              )}
            </ul>
          </div>
        )}
      </button>

      {/* Action buttons - only show on hover for custom personas */}
      {showActions && !persona.is_system && isHovered && (
        <div className="absolute bottom-2 right-2 flex gap-1">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(persona);
              }}
              className="p-1.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              title="Edit persona"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(persona);
              }}
              className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
              title="Delete persona"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 left-2">
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <svg className="w-3 h-3 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
