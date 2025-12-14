import { useEffect, useRef } from 'react';
import './ScoresModal.css';

interface FinalScore {
  display_name: string;
  final_score: number;
  number_of_words_found?: number;
  best_word: {
    word: string;
    score: number;
  };
  time?: number; // For one-shot games
  profile_picture?: string;
  chat_color?: string;
  profile_url?: string;
}

interface ScoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  finalScores: Record<string, FinalScore> | null;
  totalPoints?: number;
  isOneShot?: boolean;
}

export function ScoresModal({
  isOpen,
  onClose,
  finalScores,
  totalPoints,
  isOneShot = false,
}: ScoresModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const scoresRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scoresRef.current) {
      scoresRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  if (!isOpen || !finalScores) return null;

  // Sort players by final score (descending)
  const sortedScores = Object.entries(finalScores).sort(
    (a, b) => (b[1].final_score || 0) - (a[1].final_score || 0)
  );

  const getProfileImage = (player: FinalScore) => {
    if (player.profile_url && !player.profile_picture?.includes('placeholder')) {
      const fullImageUrl = player.profile_picture || '';
      const publicId = fullImageUrl.split('/').pop()?.split('.')[0];
      if (publicId) {
        return `https://res.cloudinary.com/df8lhl810/image/upload/q_auto,w_30,h_30,c_fill,g_face/r_100/${publicId}`;
      }
    }
    return '/images/default.png';
  };

  return (
    <div
      className={`modal ${isOpen ? 'show' : ''}`}
      id="scoresModal"
      tabIndex={-1}
      role="dialog"
      onClick={(e) => {
        // Close modal when clicking the backdrop (not the modal content)
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-dialog" role="document" ref={modalRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <span id="scores-header">Final Scores!</span>
            </h5>
            {!isOneShot && totalPoints !== undefined && (
              <span id="total-points-label" className="green">
                Available Points:&nbsp;
                <span className="yellow" id="total-points">
                  {totalPoints}
                </span>
              </span>
            )}
          </div>
          <div className="modal-body" id="scores" ref={scoresRef}>
            <table>
              <thead>
                <tr id="scores-head">
                  <th></th>
                  <th className="green dark big">Player</th>
                  {!isOneShot && <th className="pink">No. Words</th>}
                  <th className="yellow dark">Best Word</th>
                  <th className="green big">Score</th>
                  {isOneShot && <th className="pink">Time</th>}
                </tr>
              </thead>
              <tbody>
                {sortedScores.map(([playerId, player], index) => {
                  const rank = index + 1;
                  const bestWord = player.best_word?.word || 'none';
                  const profileImage = getProfileImage(player);
                  const isGuest = !player.profile_url;

                  return (
                    <tr key={playerId} style={{ backgroundColor: '#352870' }}>
                      <td className="pos">
                        <strong>{rank}</strong>
                      </td>
                      <td className="player-container dark">
                        <span
                          className={`final-score-pic ${isGuest ? 'guest-user' : ''}`}
                        >
                          <img
                            src={profileImage}
                            alt={player.display_name}
                            className="rounded-circle high-score-img"
                            width={30}
                            height={30}
                            style={{
                              borderColor: isGuest ? '#808080' : (player.chat_color || 'grey'),
                            }}
                          />
                        </span>
                        <strong
                          className={`player ${isGuest ? 'guest-user' : ''}`}
                          style={{ color: isGuest ? '#808080' : (player.chat_color || 'white') }}
                        >
                          {player.display_name}
                        </strong>
                      </td>
                      {!isOneShot && (
                        <td className="number-of-words">
                          {player.number_of_words_found || 0}
                        </td>
                      )}
                      <td className="dark best-word">{bestWord}</td>
                      <td className="final-score">{player.final_score}</td>
                      {isOneShot && (
                        <td className="one-shot-time">
                          <span className="yellow">{player.time}s</span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn yellow-button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

