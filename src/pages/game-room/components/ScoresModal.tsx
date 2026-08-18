import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router-dom';
import { lobbyAPI } from '../../../services/api';
import {
  FALLBACK_PROFILE_IMAGE,
  resolveProfilePictureUrl,
} from '../../../utils/profilePictureUrl';
import { PointsStarBadge } from '../../../components/PointsStarBadge';
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
  points_tier?: string;
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

interface OpenPlayBoardScore {
  player_id: number;
  player_display_name: string;
  player_profile_url: string;
  player_profile_picture: string;
  player_chat_color: string;
  score: number;
  best_word: string | null;
  best_word_score: number | string | null;
  number_of_words: number;
  points_tier?: string;
}

interface ScoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  finalScores: Record<string, FinalScore> | null;
  totalPoints?: number;
  isOneShot?: boolean;
  savedBoardId?: number; // If provided, fetch and display saved board scores
  openPlayBoardId?: number; // If provided, fetch and display all open play board scores
}

export function ScoresModal({
  isOpen,
  onClose,
  finalScores,
  totalPoints,
  isOneShot = false,
  savedBoardId,
  openPlayBoardId,
}: ScoresModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const scoresRef = useRef<HTMLDivElement>(null);
  const hasLoggedHTML = useRef(false);
  const [savedBoardScores, setSavedBoardScores] = useState<SavedBoardScore[] | null>(null);
  const [isLoadingSavedScores, setIsLoadingSavedScores] = useState(false);
  const [savedBoardOneShot, setSavedBoardOneShot] = useState<boolean | undefined>(undefined);
  const [openPlayScores, setOpenPlayScores] = useState<OpenPlayBoardScore[] | null>(null);
  const [isLoadingOpenPlayScores, setIsLoadingOpenPlayScores] = useState(false);

  // Fetch saved board scores when modal opens and savedBoardId is provided
  useEffect(() => {
    if (isOpen && savedBoardId) {
      setIsLoadingSavedScores(true);
      lobbyAPI.getSavedBoardScores(savedBoardId)
        .then((data) => {
          setSavedBoardScores(data.scores || []);
          setSavedBoardOneShot(data.one_shot);
        })
        .catch(() => {
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

  // Fetch all open play scores when modal opens
  useEffect(() => {
    if (isOpen && openPlayBoardId) {
      setIsLoadingOpenPlayScores(true);
      lobbyAPI.getOpenPlayBoardScores(openPlayBoardId)
        .then((data) => {
          setOpenPlayScores(data.scores || []);
        })
        .catch(() => {
          setOpenPlayScores([]);
        })
        .finally(() => {
          setIsLoadingOpenPlayScores(false);
        });
    } else if (!openPlayBoardId) {
      setOpenPlayScores(null);
    }
  }, [isOpen, openPlayBoardId]);

  useEffect(() => {
    if (isOpen && scoresRef.current) {
      scoresRef.current.scrollTop = 0;
      
    } else if (!isOpen) {
      // Reset the log flag when modal closes so it logs again next time
      hasLoggedHTML.current = false;
    }
  }, [isOpen]);

  // If savedBoardId or openPlayBoardId is provided, fetch scores instead of using finalScores
  const useSavedBoardScores = !!savedBoardId;
  const useOpenPlayScores = !!openPlayBoardId;
  const useFetchedScores = useSavedBoardScores || useOpenPlayScores;
  const isLoadingFetchedScores = useSavedBoardScores
    ? isLoadingSavedScores
    : useOpenPlayScores
      ? isLoadingOpenPlayScores
      : false;

  if (!isOpen) return null;
  
  // For fetched score sources, wait for scores to load
  if (useFetchedScores && isLoadingFetchedScores) {
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

  // If using open play scores but none available, fall back to finalScores or show message
  if (useOpenPlayScores && openPlayScores && openPlayScores.length === 0 && !finalScores) {
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

  // If using fetched scores but they haven't loaded yet, show loading
  if (useFetchedScores && !isLoadingFetchedScores && useOpenPlayScores && openPlayScores === null) {
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
  if (!useFetchedScores && !finalScores) return null;

  // Convert fetched scores to FinalScore format, or use regular finalScores
  let scoresToDisplay: Array<[string, FinalScore]>;
  // Use saved board one_shot setting if available, otherwise use prop
  // For one-shot/unicorn games, ensure we don't show number_of_words_found column
  let actualIsOneShot = useSavedBoardScores && savedBoardOneShot !== undefined ? savedBoardOneShot : isOneShot;

  if (useOpenPlayScores && openPlayScores && openPlayScores.length > 0) {
    scoresToDisplay = openPlayScores.map((score) => {
      const playerKey = String(score.player_id);
      const bestWordScore =
        typeof score.best_word_score === 'number'
          ? score.best_word_score
          : parseInt(String(score.best_word_score ?? 0), 10) || 0;
      return [playerKey, {
        display_name: score.player_display_name,
        final_score: score.score,
        number_of_words_found: score.number_of_words,
        best_word: {
          word: score.best_word || '',
          score: bestWordScore,
        },
        profile_picture: score.player_profile_picture,
        chat_color: score.player_chat_color,
        profile_url: score.player_profile_url,
        points_tier: score.points_tier,
      } as FinalScore];
    });
    scoresToDisplay.sort((a, b) => {
      const scoreA = typeof a[1].final_score === 'number' ? a[1].final_score : 0;
      const scoreB = typeof b[1].final_score === 'number' ? b[1].final_score : 0;
      return scoreB - scoreA;
    });
  } else if (useSavedBoardScores && savedBoardScores) {
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

  const renderPlayerCell = (player: FinalScore, displayName: string) => {
    const isGuest = !player.profile_url;
    const profileImage = resolveProfilePictureUrl(
      isGuest ? null : player.profile_picture,
      30
    );
    const profilePath = player.profile_url ? `/profile/${player.profile_url}` : null;

    const pic = (
      <PointsStarBadge tier={isGuest ? undefined : player.points_tier} size={30}>
        <span className={`final-score-pic ${isGuest ? 'guest-user' : ''}`}>
          <img
            src={profileImage}
            alt={player.display_name}
            className="rounded-circle high-score-img"
            width={30}
            height={30}
            style={{
              borderColor: isGuest ? '#808080' : (player.chat_color || 'grey'),
            }}
            onError={(e: SyntheticEvent<HTMLImageElement>) => {
              const img = e.currentTarget;
              if (img.src !== FALLBACK_PROFILE_IMAGE) {
                img.src = FALLBACK_PROFILE_IMAGE;
              }
            }}
          />
        </span>
      </PointsStarBadge>
    );

    const name = (
      <strong
        className={`player ${isGuest ? 'guest-user' : ''}`}
        style={{ color: isGuest ? '#808080' : (player.chat_color || 'white') }}
      >
        {displayName}
      </strong>
    );

    if (profilePath) {
      return (
        <td className="player-container dark">
          <Link to={profilePath} className="final-score-player-link" style={{ textDecoration: 'none' }}>
            {pic}
            {name}
          </Link>
        </td>
      );
    }

    return (
      <td className="player-container dark">
        {pic}
        {name}
      </td>
    );
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
                {actualIsOneShot ? (
                  // One-shot/Unicorn game headers: Rank, Player, Best Word, Score, Time
                  <tr id="scores-head">
                    <th className="pos">&nbsp;</th>
                    <th className="green dark big">Player{useSavedBoardScores ? ' (Attempt)' : ''}</th>
                    <th className="yellow dark">Best Word</th>
                    <th className="green big">Score</th>
                    <th className="pink">Time</th>
                  </tr>
                ) : (
                  // Regular game headers: Rank, Player, No. Words, Best Word, Score
                  <tr id="scores-head">
                    <th className="pos">&nbsp;</th>
                    <th className="green dark big">Player{useSavedBoardScores ? ' (Attempt)' : ''}</th>
                    <th className="pink">No. Words</th>
                    <th className="yellow dark">Best Word</th>
                    <th className="green big">Score</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {scoresToDisplay.map(([playerId, player], index) => {
                  const rank = index + 1;
                  const bestWord = player.best_word?.word || 'none';
                  const displayName = useSavedBoardScores && player.attempt_number
                    ? `${player.display_name} (#${player.attempt_number})`
                    : player.display_name;

                  if (actualIsOneShot) {
                    // One-shot/Unicorn game: Rank, Player, Best Word, Score, Time
                    return (
                      <tr key={playerId} style={{ backgroundColor: '#352870' }}>
                        <td className="pos">
                          <strong>{rank}</strong>
                        </td>
                        {renderPlayerCell(player, displayName)}
                        <td className="dark best-word">{bestWord === "-" ? "-" : bestWord}</td>
                        <td className="final-score">{player.final_score === "-" ? "-" : player.final_score}</td>
                        <td className="one-shot-time">
                          <span className="yellow">{player.time === "-" ? "-" : `${player.time}s`}</span>
                        </td>
                      </tr>
                    );
                  } else {
                    // Regular game: Rank, Player, No. Words, Best Word, Score
                    return (
                      <tr key={playerId} style={{ backgroundColor: '#352870' }}>
                        <td className="pos">
                          <strong>{rank}</strong>
                        </td>
                        {renderPlayerCell(player, displayName)}
                        <td className="number-of-words">
                          {player.number_of_words_found === "-" ? "-" : (player.number_of_words_found || 0)}
                        </td>
                        <td className="dark best-word">{bestWord === "-" ? "-" : bestWord}</td>
                        <td className="final-score">{player.final_score === "-" ? "-" : player.final_score}</td>
                      </tr>
                    );
                  }
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

