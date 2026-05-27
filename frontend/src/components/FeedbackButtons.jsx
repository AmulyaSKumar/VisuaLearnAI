import { useState } from 'react';
import { useFeedback } from '../hooks/useFeedback';

/**
 * Feedback buttons component (thumbs up/down)
 */
export default function FeedbackButtons({ messageId, metadata = {}, size = 'sm' }) {
  const { thumbsUp, thumbsDown, submitCorrection, isSubmitting } = useFeedback();
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const handleThumbsUp = async () => {
    if (feedback === 'up') return;
    try {
      await thumbsUp(messageId, metadata);
      setFeedback('up');
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const handleThumbsDown = async () => {
    if (feedback === 'down') return;
    try {
      await thumbsDown(messageId, metadata);
      setFeedback('down');
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    }
  };

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSize = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Thumbs Up */}
      <button
        onClick={handleThumbsUp}
        disabled={isSubmitting || feedback === 'up'}
        className={`${sizeClasses[size]} rounded-lg transition-all
          ${feedback === 'up'
            ? 'bg-green-500/20 text-green-500'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }
          ${isSubmitting ? 'cursor-wait opacity-50' : ''}
        `}
        title="Helpful"
      >
        <svg
          className={iconSize[size]}
          viewBox="0 0 24 24"
          fill={feedback === 'up' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>

      {/* Thumbs Down */}
      <button
        onClick={handleThumbsDown}
        disabled={isSubmitting || feedback === 'down'}
        className={`${sizeClasses[size]} rounded-lg transition-all
          ${feedback === 'down'
            ? 'bg-red-500/20 text-red-500'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }
          ${isSubmitting ? 'cursor-wait opacity-50' : ''}
        `}
        title="Not helpful"
      >
        <svg
          className={iconSize[size]}
          viewBox="0 0 24 24"
          fill={feedback === 'down' ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
        </svg>
      </button>

      <button
        onClick={() => setShowFeedbackModal(true)}
        disabled={isSubmitting}
        className={`${sizeClasses[size]} rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all ${isSubmitting ? 'cursor-wait opacity-50' : ''}`}
        title="Tell us what was wrong"
      >
        <svg className={iconSize[size]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 9h8" />
          <path d="M8 13h5" />
        </svg>
      </button>

      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">Tell us what was wrong</h3>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close feedback"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <textarea
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              rows={4}
              className="mt-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              placeholder="Too fast, confusing, wrong example, missing visual..."
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || !feedbackText.trim()}
                onClick={async () => {
                  await submitCorrection(messageId, feedbackText.trim(), metadata);
                  setFeedbackText('');
                  setShowFeedbackModal(false);
                }}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Send Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
