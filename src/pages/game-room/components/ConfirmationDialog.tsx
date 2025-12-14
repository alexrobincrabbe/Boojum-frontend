import { useEffect, useRef } from 'react';
import './ConfirmationDialog.css';

interface ConfirmationDialogProps {
  isOpen: boolean;
  word: string;
  onConfirm: () => void;
  onCancel: () => void;
  boardRef: React.RefObject<HTMLDivElement | null>;
}

export function ConfirmationDialog({
  isOpen,
  word,
  onConfirm,
  onCancel,
  boardRef,
}: ConfirmationDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Position dialog in center of board
  useEffect(() => {
    if (isOpen && boardRef.current && backdropRef.current) {
      const board = boardRef.current;
      const boardRect = board.getBoundingClientRect();
      const popup = backdropRef.current.querySelector('.confirmation-popup') as HTMLElement;
      
      if (popup) {
        popup.style.position = 'absolute';
        popup.style.left = `${boardRect.left + boardRect.width / 2}px`;
        popup.style.top = `${boardRect.top + boardRect.height / 2}px`;
        popup.style.transform = 'translate(-50%, -50%)';
      }
    }
  }, [isOpen, boardRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="confirmation-backdrop"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="confirmation-popup" onClick={(e) => e.stopPropagation()}>
        <div style={{ marginBottom: '10px' }}>Confirm word: <strong>{word}</strong></div>
        <button id="confirm-word" onClick={onConfirm}>
          Confirm
        </button>
        <button id="cancel-word" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

