import { createPortal } from 'react-dom';
import './GameInstructionsModal.css';

interface GameInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GameInstructionsModal({ isOpen, onClose }: GameInstructionsModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="game-instructions-modal-overlay" onClick={onClose}>
      <div className="game-instructions-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="game-instructions-modal-header">
          <h2 className="game-instructions-modal-title">How to Play</h2>
          <button
            className="game-instructions-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="game-instructions-modal-body">
          {/* Scoring Box - First */}
          <div className="game-instructions-box">
            <h3 className="game-instructions-box-title">Scoring</h3>
            <p className="game-instructions-text">
              Letters are assigned a value:
            </p>
            <div className="game-instructions-scoring-grid">
              <div className="scoring-row">
                <span className="scoring-letters">A, E, I, O, U, L, N, R, S, T</span>
                <span className="scoring-value">= 1</span>
              </div>
              <div className="scoring-row">
                <span className="scoring-letters">D, G</span>
                <span className="scoring-value">= 2</span>
              </div>
              <div className="scoring-row">
                <span className="scoring-letters">B, C, M, P</span>
                <span className="scoring-value">= 3</span>
              </div>
              <div className="scoring-row">
                <span className="scoring-letters">F, H, V, W, Y</span>
                <span className="scoring-value">= 4</span>
              </div>
              <div className="scoring-row">
                <span className="scoring-letters">K</span>
                <span className="scoring-value">= 5</span>
              </div>
              <div className="scoring-row">
                <span className="scoring-letters">J, X</span>
                <span className="scoring-value">= 8</span>
              </div>
              <div className="scoring-row">
                <span className="scoring-letters">Q, Z</span>
                <span className="scoring-value">= 10</span>
              </div>
            </div>
            <p className="game-instructions-text">
              Word length multiplies your word's score:
            </p>
            <ul className="game-instructions-list">
              <li>5 letter words are worth x2</li>
              <li>6 letter words are worth x3</li>
              <li>7 letter words are worth x4</li>
              <li>8 letter words are worth x5</li>
              <li>9 letter words are worth x6</li>
              <li>10 letter words are worth x7</li>
              <li>11 letter words are worth x8</li>
              <li>12 letter words are worth x9</li>
              <li>13 letter words are worth x10</li>
              <li>14 letter words are worth x11</li>
              <li>15 letter words are worth x12</li>
              <li>16 letter words are worth x13</li>
            </ul>
          </div>

          {/* Colours Explained Box */}
          <div className="game-instructions-box">
            <h3 className="game-instructions-box-title">Colours Explained</h3>
            <p className="game-instructions-intro">
              As you join letters to form words, 'Pathways' will appear to you in yellow, green or pink.
            </p>
            <ul className="game-instructions-list">
              <li>
                <span className="green-text">Green</span> signifies you have found a valid word.
              </li>
              <li>
                <span className="yellow-text">Yellow</span> signifies there is still at least one word to be made from these letters.
              </li>
              <li>
                <span className="pink-text">Pink</span> signifies that there are no more words to be made using this string of letters.
              </li>
            </ul>
            <p className="game-instructions-note">
              This is a feature you can turn off if you find it unappealing. 
              The button is located in your Dashboard.
            </p>
          </div>

          {/* High Scores Box */}
          <div className="game-instructions-box">
            <h3 className="game-instructions-box-title">High Scores</h3>
            <p className="game-instructions-text">
              Boojum differs from classic Boggle by celebrating more than just the winner during a live game round. Boojum uses three types of leaderboards, per each game room, that celebrate the top positions for:
            </p>
            <ul className="game-instructions-list">
              <li>Highest Scoring Round</li>
              <li>Highest Scoring Word</li>
              <li>Most Words Found</li>
            </ul>
            <p className="game-instructions-text">
              Our leaderboards are categorised by This Week, Last Week, This Month, Last Month, This Year, Last Year and All Time. This ensures players can compete against each other even when playing alone.
            </p>
          </div>

          {/* Bonus Tiles */}
          <div className="game-instructions-box">
            <h3 className="game-instructions-box-title">Bonus Tiles</h3>
            <p className="game-instructions-text">
              On some boards, there are two bonus tiles, randomly assigned to a different letter for every round: the Snark and the Boojum. The Snark tile doubles the letter's value. 
              Using the Boojum tile in your word will double your word's value.
            </p>
          </div>
        </div>
        <div className="game-instructions-modal-footer">
          <button type="button" className="btn yellow-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

