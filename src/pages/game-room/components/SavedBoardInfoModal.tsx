import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import './SavedBoardInfoModal.css';

interface SavedBoardInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SavedBoardInfoModal({ isOpen, onClose }: SavedBoardInfoModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="saved-board-info-modal-overlay" onClick={onClose}>
      <div className="saved-board-info-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="saved-board-info-modal-header">
          <h2 className="saved-board-info-modal-title">Saved Boards</h2>
          <button
            className="saved-board-info-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="saved-board-info-modal-body">
          <p className="saved-board-info-text">
            You can save boards to play later and share with other players.
          </p>
          <p className="saved-board-info-text">
            Your saved boards can be found on the{' '}
            <Link to="/saved-boards" className="saved-board-info-link" onClick={onClose}>
              Saved Boards page
            </Link>
            .
          </p>
        </div>
        <div className="saved-board-info-modal-footer">
          <button type="button" className="btn yellow-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

