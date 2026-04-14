import { useState } from 'react';

/**
 * FactCheckBadge Component
 * Displays verification status with confidence scoring and source viewing
 *
 * Props:
 * - factCheck: { confidence, supportedClaims, partialClaims, unsupportedClaims, sources, summary }
 * - compact: boolean - show minimal badge
 */
export default function FactCheckBadge({ factCheck, compact = false }) {
  const [showDetails, setShowDetails] = useState(false);
  const [showSources, setShowSources] = useState(false);

  if (!factCheck || typeof factCheck.confidence !== 'number') return null;

  const { confidence, supportedClaims = [], partialClaims = [], unsupportedClaims = [], sources = [], summary, claims = [] } = factCheck;

  // Determine badge style based on confidence
  const getBadgeStyle = () => {
    if (confidence >= 0.8) {
      return {
        bg: 'bg-green-500/15',
        border: 'border-green-500/30',
        text: 'text-green-600 dark:text-green-400',
        label: 'Verified',
        icon: CheckIcon,
      };
    }
    if (confidence >= 0.5) {
      return {
        bg: 'bg-yellow-500/15',
        border: 'border-yellow-500/30',
        text: 'text-yellow-600 dark:text-yellow-400',
        label: 'Partially Verified',
        icon: AlertIcon,
      };
    }
    return {
      bg: 'bg-red-500/15',
      border: 'border-red-500/30',
      text: 'text-red-600 dark:text-red-400',
      label: 'Low Confidence',
      icon: WarningIcon,
    };
  };

  const style = getBadgeStyle();
  const confidencePercent = (confidence * 100).toFixed(0);
  const Icon = style.icon;

  // Compact view - just the badge
  if (compact) {
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border transition-all hover:scale-105 ${style.bg} ${style.border} ${style.text}`}
        title={`${style.label}: ${confidencePercent}% confidence`}
      >
        <Icon className="w-3 h-3" />
        <span>{confidencePercent}%</span>
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {/* Main Badge Button */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all hover:scale-[1.02] ${style.bg} ${style.border} ${style.text}`}
      >
        <Icon className="w-4 h-4" />
        <span>{style.label}</span>
        <span className="opacity-70">({confidencePercent}%)</span>
        <ChevronIcon className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded Details Panel */}
      {showDetails && (
        <div className="p-4 bg-muted/50 rounded-xl border border-border/50 space-y-4">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{summary}</p>
            {sources.length > 0 && (
              <button
                onClick={() => setShowSources(!showSources)}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                <SourceIcon className="w-3.5 h-3.5" />
                {showSources ? 'Hide Sources' : 'View Sources'}
              </button>
            )}
          </div>

          {/* Claims Breakdown */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-lg bg-green-500/10">
              <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                {supportedClaims.length}
              </p>
              <p className="text-xs text-muted-foreground">Supported</p>
            </div>
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                {partialClaims.length}
              </p>
              <p className="text-xs text-muted-foreground">Partial</p>
            </div>
            <div className="p-2 rounded-lg bg-red-500/10">
              <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                {unsupportedClaims.length}
              </p>
              <p className="text-xs text-muted-foreground">Unverified</p>
            </div>
          </div>

          {/* Individual Claims */}
          {claims.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Claim Details
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {claims.map((claim, idx) => (
                  <ClaimItem key={idx} claim={claim} />
                ))}
              </div>
            </div>
          )}

          {/* Sources Panel */}
          {showSources && sources.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <SourceIcon className="w-3.5 h-3.5" />
                Retrieved Sources ({sources.length})
              </p>
              <div className="space-y-2">
                {sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-background/50 rounded-lg border border-border/30 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-foreground">
                        Source #{source.rank || idx + 1}
                      </span>
                      <span className="text-muted-foreground">
                        Relevance: {((source.relevance || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unsupported Claims Warning */}
          {unsupportedClaims.length > 0 && (
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                <WarningIcon className="w-3.5 h-3.5" />
                Unverified Claims
              </p>
              <ul className="space-y-1">
                {unsupportedClaims.slice(0, 3).map((claim, idx) => (
                  <li key={idx} className="text-xs text-red-600/80 dark:text-red-400/80 truncate">
                    • {claim}
                  </li>
                ))}
                {unsupportedClaims.length > 3 && (
                  <li className="text-xs text-red-600/60 dark:text-red-400/60">
                    +{unsupportedClaims.length - 3} more...
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual claim item component
 */
function ClaimItem({ claim }) {
  const getClaimStyle = (status) => {
    switch (status) {
      case 'supported':
        return 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400';
      case 'partially_supported':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'supported':
        return <CheckIcon className="w-3 h-3 text-green-500" />;
      case 'partially_supported':
        return <AlertIcon className="w-3 h-3 text-yellow-500" />;
      default:
        return <WarningIcon className="w-3 h-3 text-red-500" />;
    }
  };

  return (
    <div className={`p-2 rounded-lg border ${getClaimStyle(claim.status)}`}>
      <div className="flex items-start gap-2">
        {getStatusIcon(claim.status)}
        <div className="flex-1 min-w-0">
          <p className="text-xs leading-relaxed line-clamp-2">{claim.claim}</p>
          <div className="flex items-center gap-2 mt-1 text-[10px] opacity-70">
            <span>{(claim.confidence * 100).toFixed(0)}% confidence</span>
            {claim.similarityScore > 0 && (
              <span>• {(claim.similarityScore * 100).toFixed(0)}% match</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Icons
const CheckIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const AlertIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const WarningIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

const ChevronIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SourceIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
