import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBoardTheme } from '../../contexts/BoardThemeContext';
import { lobbyAPI } from '../../services/api';
import { WordLists } from '../game-room/components/WordLists';
import { Username } from '../../components/Username';
import { ProfilePicture } from '../../components/ProfilePicture';
import { toast } from 'react-toastify';
import './DailyBoardPage.css';
import '../game-room/GameRoom.css';

interface DailyBoardScore {
  player_id: number | null;
  player_username: string;
  player_display_name: string;
  player_profile_url: string;
  player_profile_picture: string;
  player_chat_color: string;
  score: number;
  best_word: string | null;
  best_word_score: string | null;
  number_of_words: number;
  is_current_user: boolean;
}

interface WordData {
  word: string;
  sum_players_found: number;
  players_found: (number | null)[];
}

interface DailyBoard {
  id: number;
  title: string;
  date: string;
  type: 'normal' | 'bonus';
  time_limit: number;
  one_shot: boolean;
  played: boolean;
  scores: DailyBoardScore[];
  board_letters?: string[][];
  board_words?: string[];
  boojum?: number[][];
  words_by_length?: Record<string, WordData[]>;
}

export default function DailyBoardArchiveDetailPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<DailyBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number | null>>(new Set());
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isAuthenticated, user } = useAuth();
  const { darkMode } = useBoardTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchBoard = async () => {
      if (!isAuthenticated || !user?.is_premium) {
        toast.error('Premium subscription required to access archives');
        navigate('/dashboard');
        return;
      }

      if (!boardId) {
        navigate('/daily-boards/archive');
        return;
      }

      try {
        setLoading(true);
        const boardData = await lobbyAPI.getDailyBoardArchiveDetail(parseInt(boardId, 10));
        setBoard(boardData);
      } catch (error: unknown) {
        console.error('Error fetching board:', error);
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 403) {
          toast.error('Premium subscription required to access archives');
          navigate('/dashboard');
        } else {
          toast.error('Failed to load board');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBoard();
  }, [boardId, isAuthenticated, user, navigate]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handlePlay = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (board?.id && !board.played) {
      navigate(`/daily-boards/play/${board.id}?from_archive=true`);
    }
  };

  const togglePlayerFilter = (playerId: number | null, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    const wasSelected = selectedPlayerIds.has(playerId);
    const player = board?.scores?.find((s: DailyBoardScore) => s.player_id === playerId);
    const playerName = player?.player_display_name || 'Player';
    
    setSelectedPlayerIds(prev => {
      const newSet = new Set(prev);
      if (wasSelected) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
    
    toastTimeoutRef.current = setTimeout(() => {
      if (wasSelected) {
        toast.info(`Removed ${playerName} from filter`);
      } else {
        toast.success(`Added ${playerName} to filter`);
      }
      toastTimeoutRef.current = null;
    }, 0);
  };

  const getBonusLetters = (board: DailyBoard): { boojum?: string; snark?: string } => {
    if (!board.boojum || !board.board_letters) return {};
    
    let boojumLetter: string | undefined;
    let snarkLetter: string | undefined;
    
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const bonusValue = board.boojum[row]?.[col] || 0;
        const letter = board.board_letters[row]?.[col];
        
        if (bonusValue === 1 && !snarkLetter && letter) {
          snarkLetter = letter;
        } else if (bonusValue === 2 && !boojumLetter && letter) {
          boojumLetter = letter;
        }
      }
    }
    
    return { boojum: boojumLetter, snark: snarkLetter };
  };

  if (loading) {
    return (
      <div className="daily-board-page">
        <div className="loading-state">Loading board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="daily-board-page">
        <div className="no-boards">Board not found</div>
      </div>
    );
  }

  return (
    <div className="daily-board-page">
      <div className="daily-board-container">
        {/* Back button */}
        <div className="daily-board-pagination">
          <div className="pagination-top-left">
            <div className="pagination-left-container">
              <button className="pagination-btn" onClick={() => navigate('/daily-boards/archive')} aria-label="Back">
              </button>
              <span className="pagination-text">Back to Archive</span>
            </div>
          </div>
        </div>

        {/* Board Info */}
        <div className="daily-board-header">
          <div className="daily-board-date">{formatDate(board.date)}</div>
          <div className="daily-board-meta">
            {board.type === 'bonus' && (
              <span className="board-type bonus">Bonus Letters</span>
            )}
            <span className="board-time-limit">
              Time Limit: <span className="time-value">{board.time_limit}s</span>
            </span>
          </div>
        </div>

        {/* Play Button */}
        {!board.played && (
          <div className="daily-board-play-section">
            {isAuthenticated ? (
              <button className="play-board-btn" onClick={handlePlay}>
                Play Now
              </button>
            ) : (
              <div className="login-prompt">
                <em>Please <Link to="/login" style={{ color: 'var(--color-blue)', textShadow: 'var(--glow-blue-text)', textDecoration: 'none' }}>log in</Link> to play</em>
              </div>
            )}
          </div>
        )}

        {/* High Scores Table */}
        <div className="daily-board-scores-section">
          <h1 className="daily-board-title">{board.title}</h1>
          {board.scores.length > 0 ? (
            <div className="scores-table-container">
              <table className="scores-table">
                <thead>
                  <tr>
                    <th className="rank-col"></th>
                    <th className="player-col"></th>
                    <th className="score-col">Score</th>
                    <th className="word-col">Best Word</th>
                    <th className="words-col">Words</th>
                  </tr>
                </thead>
                <tbody>
                  {board.scores.map((score, index) => (
                    <tr
                      key={score.player_id || index}
                      className={`${score.is_current_user ? 'current-user-score' : ''} ${selectedPlayerIds.has(score.player_id) ? 'player-filter-selected' : ''}`}
                      onClick={(e) => togglePlayerFilter(score.player_id, e)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="rank-col">{index + 1}</td>
                      <td className="player-col">
                        <div className="player-info">
                          <ProfilePicture
                            profilePictureUrl={score.player_profile_picture}
                            chatColor={score.player_chat_color}
                            size={40}
                            showBorder={true}
                          />
                          <Username
                            username={score.player_display_name}
                            chatColor={score.player_chat_color}
                          />
                        </div>
                      </td>
                      <td className="score-col">{score.score} <span className="score-pts">pts</span></td>
                      <td className="word-col">
                        <div className="best-word-container">
                          {score.best_word ? (
                            <span className="best-word-text">{score.best_word}</span>
                          ) : (
                            <span className="hidden-word">*****</span>
                          )}
                          {score.best_word_score != null && score.best_word_score !== '' && (
                            <span className="best-word-score">
                              {score.best_word_score}<span className="best-word-score-pts">pts</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="words-col">{score.number_of_words}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-scores">No scores yet</div>
          )}
        </div>

        {/* Board Solution and Word List (if played) */}
        {board.played && board.board_letters && board.words_by_length && (
          <div className="daily-board-solution">
            <h2 className="solution-title">Board Solution</h2>
            <div className="board-display-container">
              <div className="board-wrapper">
                <div 
                  id="daily-board" 
                  className={`board ${darkMode ? 'board-dark' : 'board-light'}`}
                >
                {Array.from({ length: 16 }, (_, i) => {
                  const row = Math.floor(i / 4);
                  const col = i % 4;
                  const letter = board.board_letters?.[row]?.[col] || '';
                  let bonusValue = 0;
                  if (board.boojum && Array.isArray(board.boojum) && board.boojum[row]) {
                    bonusValue = board.boojum[row][col] || 0;
                  }
                  const isSnark = bonusValue === 1;
                  const isBoojum = bonusValue === 2;
                  
                  return (
                    <div 
                      key={i} 
                      className={`letter ${darkMode ? 'dark-mode' : 'light-mode'} ${isSnark ? 'snark' : ''} ${isBoojum ? 'boojum' : ''}`}
                      data-x={row}
                      data-y={col}
                      data-index={i}
                      data-letter={letter}
                    >
                      <div className="letValue">{letter}</div>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
            
            <h3 className="word-list-title">All Words</h3>
            {selectedPlayerIds.size > 0 && (
              <div className="player-filter-banner">
                <span className="filter-label">Filtered by:</span>
                {Array.from(selectedPlayerIds).map(playerId => {
                  const player = board.scores.find(s => s.player_id === playerId);
                  return player ? (
                    <span 
                      key={playerId} 
                      className="filtered-player-name" 
                      style={{ color: player.player_chat_color }}
                      onClick={(e) => {
                        togglePlayerFilter(playerId, e);
                      }}
                    >
                      {player.player_display_name}
                    </span>
                  ) : null;
                })}
                <button 
                  className="clear-filter-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlayerIds(new Set());
                    toast.info('Filter cleared - showing all players');
                  }}
                >
                  Clear Filter
                </button>
              </div>
            )}
            {selectedPlayerIds.size === 0 && (
              <div className="player-filter-banner">
                <span className="filter-label">Showing: All players</span>
                <span className="filter-hint">select players to add filters</span>
              </div>
            )}
            {(() => {
              const { boojum, snark } = getBonusLetters(board);
              const wordsByLengthForComponent: Record<string, Record<string, { word: string; sum_players_found: number; players_found: (number | null)[] }>> = {};
              
              if (board.words_by_length) {
                Object.keys(board.words_by_length).forEach(length => {
                  const words = board.words_by_length![length];
                  wordsByLengthForComponent[length] = {};
                  words.forEach(wordData => {
                    wordsByLengthForComponent[length][wordData.word] = wordData;
                  });
                });
              }
              
              return (
                <WordLists
                  wordsByLength={wordsByLengthForComponent}
                  wordsFound={new Set()}
                  gameStatus="finished"
                  hasFinalScores={true}
                  boojum={boojum}
                  snark={snark}
                  currentUserId={user?.id || null}
                  filteredPlayerIds={selectedPlayerIds}
                  showColorBanner={true}
                  showDefinitionBanner={true}
                />
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

