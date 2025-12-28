import { useEffect, useRef, useState } from 'react';
import { lobbyAPI } from '../../../services/api';
import './ScoresModal.css';

interface FinalScore {
  display_name: string;
  final_score: number | string; // Can be "-" for tournament games when opponent hasn't played
  number_of_words_found?: number | string; // Can be "-" for tournament games when opponent hasn't played
  best_word: {
    word: string;
    score: number;
  };
  time?: number | string; // For one-shot games, can be "-" for tournament games when opponent hasn't played
  profile_picture?: string;
  chat_color?: string;
  profile_url?: string;
  attempt_number?: number; // For saved boards
}

interface SavedBoardScore {
  user_id: number;
  username: string;
  display_name: string;
  profile_url?: string;
  profile_picture?: string;
  chat_color?: string;
  final_score: number;
  number_of_words_found: number;
  best_word: {
    word: string;
    score: number;
  };
  time: number;
  attempt_number: number;
  created_at: string;
}

interface ScoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  finalScores: Record<string, FinalScore> | null;
  totalPoints?: number;
  isOneShot?: boolean;
  savedBoardId?: number; // If provided, fetch and display saved board scores
}

export function ScoresModal({
  isOpen,
  onClose,
  finalScores,
  totalPoints,
  isOneShot = false,
  savedBoardId,
}: ScoresModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const scoresRef = useRef<HTMLDivElement>(null);
  const [savedBoardScores, setSavedBoardScores] = useState<SavedBoardScore[] | null>(null);
  const [isLoadingSavedScores, setIsLoadingSavedScores] = useState(false);
  const [savedBoardOneShot, setSavedBoardOneShot] = useState<boolean | undefined>(undefined);

  // Fetch saved board scores when modal opens and savedBoardId is provided
  useEffect(() => {
    if (isOpen && savedBoardId) {
      setIsLoadingSavedScores(true);
      lobbyAPI.getSavedBoardScores(savedBoardId)
        .then((data) => {
          setSavedBoardScores(data.scores || []);
          setSavedBoardOneShot(data.one_shot);
        })
        .catch((error) => {
          console.error('Error fetching saved board scores:', error);
          setSavedBoardScores([]);
        })
        .finally(() => {
          setIsLoadingSavedScores(false);
        });
    } else if (!savedBoardId) {
      setSavedBoardScores(null);
      setSavedBoardOneShot(undefined);
    }
  }, [isOpen, savedBoardId]);

  useEffect(() => {
    if (isOpen && scoresRef.current) {
      scoresRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // If savedBoardId is provided, always use saved board scores instead of finalScores
  // Wait for scores to load before displaying
  const useSavedBoardScores = !!savedBoardId;

  if (!isOpen) return null;
  
  // For saved boards, wait for scores to load
  if (useSavedBoardScores && isLoadingSavedScores) {
    return (
      <div className={`modal ${isOpen ? 'show' : ''}`} id="scoresModal" tabIndex={-1} role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <span id="scores-header">Loading scores...</span>
              </h5>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If using saved board scores but no scores available, show message
  if (useSavedBoardScores && savedBoardScores && savedBoardScores.length === 0) {
    return (
      <div className={`modal ${isOpen ? 'show' : ''}`} id="scoresModal" tabIndex={-1} role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <span id="scores-header">No scores yet</span>
              </h5>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn yellow-button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If using saved board scores but they haven't loaded yet, show loading
  if (useSavedBoardScores && savedBoardScores === null) {
    return (
      <div className={`modal ${isOpen ? 'show' : ''}`} id="scoresModal" tabIndex={-1} role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                <span id="scores-header">Loading scores...</span>
              </h5>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If using regular finalScores and they're not available, return null
  if (!useSavedBoardScores && !finalScores) return null;

  const renderTime = performance.now();
  const renderTimestamp = new Date().toISOString();
  console.log(`[ScoresModal] [TIMESTAMP] Rendering scores modal at ${renderTimestamp} (${renderTime.toFixed(3)}ms)`);

  // Convert saved board scores to FinalScore format, or use regular finalScores
  let scoresToDisplay: Array<[string, FinalScore]>;
  // Use saved board one_shot setting if available, otherwise use prop
  let actualIsOneShot = useSavedBoardScores && savedBoardOneShot !== undefined ? savedBoardOneShot : isOneShot;

  if (useSavedBoardScores && savedBoardScores) {
    // Convert saved board scores array to the format expected by the rendering logic
    scoresToDisplay = savedBoardScores.map((score) => {
      const playerKey = `${score.user_id}_${score.attempt_number}`; // Unique key per attempt
      return [playerKey, {
        display_name: score.display_name,
        final_score: score.final_score,
        number_of_words_found: score.number_of_words_found,
        best_word: score.best_word,
        time: score.time,
        profile_picture: score.profile_picture,
        chat_color: score.chat_color,
        profile_url: score.profile_url,
        attempt_number: score.attempt_number,
      } as FinalScore];
    });
    // Sort by score (descending)
    scoresToDisplay.sort((a, b) => {
      const scoreA = typeof a[1].final_score === 'number' ? a[1].final_score : 0;
      const scoreB = typeof b[1].final_score === 'number' ? b[1].final_score : 0;
      return scoreB - scoreA;
    });
  } else if (finalScores) {
    // Use regular finalScores
    scoresToDisplay = Object.entries(finalScores).sort(
      (a, b) => {
        const scoreA = typeof a[1].final_score === 'number' ? a[1].final_score : 0;
        const scoreB = typeof b[1].final_score === 'number' ? b[1].final_score : 0;
        return scoreB - scoreA;
      }
    );
  } else {
    scoresToDisplay = [];
  }

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
            {!actualIsOneShot && totalPoints !== undefined && !useSavedBoardScores && (
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
                  <th className="green dark big">Player{useSavedBoardScores ? ' (Attempt)' : ''}</th>
                  {!actualIsOneShot && <th className="pink">No. Words</th>}
                  <th className="yellow dark">Best Word</th>
                  <th className="green big">Score</th>
                  {actualIsOneShot && <th className="pink">Time</th>}
                </tr>
              </thead>
              <tbody>
                {scoresToDisplay.map(([playerId, player], index) => {
                  const rank = index + 1;
                  const bestWord = player.best_word?.word || 'none';
                  const profileImage = getProfileImage(player);
                  const isGuest = !player.profile_url;
                  const displayName = useSavedBoardScores && player.attempt_number
                    ? `${player.display_name} (#${player.attempt_number})`
                    : player.display_name;

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
                          {displayName}
                        </strong>
                      </td>
                      {!actualIsOneShot && (
                        <td className="number-of-words">
                          {player.number_of_words_found === "-" ? "-" : (player.number_of_words_found || 0)}
                        </td>
                      )}
                      <td className="dark best-word">{bestWord === "-" ? "-" : bestWord}</td>
                      <td className="final-score">{player.final_score === "-" ? "-" : player.final_score}</td>
                      {actualIsOneShot && (
                        <td className="one-shot-time">
                          <span className="yellow">{player.time === "-" ? "-" : `${player.time}s`}</span>
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

