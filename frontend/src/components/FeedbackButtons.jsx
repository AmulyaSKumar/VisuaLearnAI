import { useState } from 'react';
import { useFeedback } from '../hooks/useFeedback';

/**
 * Feedback buttons component (thumbs up/down)
 */
export default function FeedbackButtons({ messageId, metadata = {}, size = 'sm' }) {
  const { thumbsUp, thumbsDown, isSubmitting } = useFeedback();
  const [feedback, setFeedback] = useState(null); // 'up' | 'down' | null

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
    </div>
  );
}
