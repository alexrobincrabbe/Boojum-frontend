import { X } from 'lucide-react';
import './PollModal.css';

interface PollOption {
  value: string;
  percentage: number;
}

interface Poll {
  id: number;
  question: string;
  options: PollOption[];
  total_votes: number;
  user_vote: number | null;
  discussion_link: string;
}

interface PollModalProps {
  poll: Poll | null;
  isOpen: boolean;
  onClose: () => void;
  onVote: (optionNo: number) => void;
  isAuthenticated: boolean;
}

export function PollModal({ poll, isOpen, onClose, onVote, isAuthenticated }: PollModalProps) {
  if (!isOpen || !poll) return null;

  return (
    <div className="poll-modal-overlay" onClick={onClose}>
      <div className="poll-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="poll-modal-header">
          <h3 className="poll-modal-title">Poll</h3>
          <button
            className="poll-modal-close"
            onClick={onClose}
            aria-label="Close poll"
          >
            <X size={20} />
          </button>
        </div>
        <div className="poll-modal-body">
          <p className="poll-question">{poll.question}</p>
          <div className="poll-options">
            {poll.options.map((option, idx) => {
              if (!option.value) return null;
              const optionNo = idx + 1;
              const isVoted = poll.user_vote === optionNo;
              return (
                <div key={idx} className="poll-option">
                  <button
                    className={`poll-option-button ${isVoted ? 'voted' : ''}`}
                    onClick={() => onVote(optionNo)}
                    disabled={isVoted || !isAuthenticated}
                  >
                    {option.value}
                  </button>
                  {poll.total_votes > 0 && (
                    <div className="poll-bar-container">
                      <div
                        className="poll-bar"
                        style={{ width: `${option.percentage}%` }}
                      />
                      <span className="poll-percentage">{option.percentage}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {poll.total_votes > 0 && (
            <p className="poll-total">Total votes: {poll.total_votes}</p>
          )}
          {poll.discussion_link && (
            <a
              href={poll.discussion_link}
              target="_blank"
              rel="noopener noreferrer"
              className="poll-discussion-link"
            >
              Discussion
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

