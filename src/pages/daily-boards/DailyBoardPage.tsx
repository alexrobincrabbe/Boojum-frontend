import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
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

export default function DailyBoardPage() {
  const [boards, setBoards] = useState<DailyBoard[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number | null>>(new Set()); // Empty = show all
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isAuthenticated, user } = useAuth();
  const { darkMode } = useBoardTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        const data = await lobbyAPI.getDailyBoards();
        const boardsData = data.boards || [];
        setBoards(boardsData);
        
        // Check if there's a board ID in the URL
        const boardIdParam = searchParams.get('board');
        if (boardIdParam) {
          const boardId = parseInt(boardIdParam, 10);
          const boardIndex = boardsData.findIndex((board: DailyBoard) => board.id === boardId);
          if (boardIndex !== -1) {
            // Found the board - set to that page
            setCurrentPage(boardIndex);
          } else {
            // Board not found - default to page 0 (today's board)
            setCurrentPage(0);
          }
        } else {
          // No board ID in URL - set current page to 0 (today's board, which is first)
          setCurrentPage(0);
        }
      } catch (error) {
        console.error('Error fetching daily boards:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBoards();
  }, [searchParams]);

  const currentBoard = boards[currentPage];
  // Boards are ordered newest first (index 0 = today)
  // Previous = older board (higher index, earlier date)
  // Next = newer board (lower index, later date)
  const hasNext = currentPage > 0; // Can go to newer board
  const hasPrevious = currentPage < boards.length - 1; // Can go to older board

  const handleNext = () => {
    if (hasNext) {
      setCurrentPage(currentPage - 1); // Go to newer board (lower index)
    }
  };

  const handlePrevious = () => {
    if (hasPrevious) {
      setCurrentPage(currentPage + 1); // Go to older board (higher index)
    }
  };

  const handlePlay = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (currentBoard?.id) {
      navigate(`/daily-boards/play/${currentBoard.id}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Toggle player in filter
  const togglePlayerFilter = (playerId: number | null, e?: React.MouseEvent) => {
    // Prevent event propagation to avoid double calls
    if (e) {
      e.stopPropagation();
    }
    
    // Clear any pending toast timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    
    const wasSelected = selectedPlayerIds.has(playerId);
    const player = boards[currentPage]?.scores?.find((s: DailyBoardScore) => s.player_id === playerId);
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
    
    // Show toast message after a short delay to avoid duplicates
    toastTimeoutRef.current = setTimeout(() => {
      if (wasSelected) {
        toast.info(`Removed ${playerName} from filter`);
      } else {
        toast.success(`Added ${playerName} to filter`);
      }
      toastTimeoutRef.current = null;
    }, 0);
  };


  // Extract boojum and snark letters from boojum array
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
        <div className="loading-state">Loading daily boards...</div>
      </div>
    );
  }

  if (!currentBoard) {
    return (
      <div className="daily-board-page">
        <div className="no-boards">No daily boards available</div>
      </div>
    );
  }

  return (
    <div className="daily-board-page">
      <div className="daily-board-container">
        {/* Pagination Controls */}
        <div className="daily-board-pagination">
          <div className="pagination-top-left">
            {hasPrevious && (
              <div className="pagination-left-container">
                <button className="pagination-btn" onClick={handlePrevious} aria-label="Previous">
                </button>
                <span className="pagination-text">Previous</span>
              </div>
            )}
          </div>
          <div className="pagination-info">
            Board {currentPage + 1} of {boards.length}
          </div>
          {hasNext && (
            <div className="pagination-top-right">
              <div className="pagination-right-container">
                <span className="pagination-text">Next</span>
                <button className="pagination-btn" onClick={handleNext} aria-label="Next">
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Board Info */}
        <div className="daily-board-header">
          <div className="daily-board-date">{formatDate(currentBoard.date)}</div>
          <div className="daily-board-meta">
            {currentBoard.type === 'bonus' && (
              <span className="board-type bonus">Bonus Letters</span>
            )}
            <span className="board-time-limit">
              Time Limit: <span className="time-value">{currentBoard.time_limit}s</span>
            </span>
          </div>
        </div>

        {/* Play Button */}
        {!currentBoard.played && (
          <div className="daily-board-play-section">
            {isAuthenticated ? (
              <button className="play-board-btn" onClick={handlePlay}>
                Play Now
              </button>
            ) : (
              <div className="login-prompt">
                <em>Please <Link to="/login" style={{ color: 'var(--color-blue)', textShadow: 'var(--glow-blue-text)', textDecoration: 'none' }}>log in</Link> to play the Everyday Boards</em>
              </div>
            )}
          </div>
        )}

        {/* High Scores Table */}
        <div className="daily-board-scores-section">
          <h1 className="daily-board-title">{currentBoard.title}</h1>
          <h2 className="scores-title">High Scores</h2>
          {currentBoard.scores.length > 0 ? (
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
                  {currentBoard.scores.map((score, index) => (
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
        {currentBoard.played && currentBoard.board_letters && currentBoard.words_by_length && (
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
                  const letter = currentBoard.board_letters?.[row]?.[col] || '';
                  // boojum is a 2D array: [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]]
                  // Values: 0 = no bonus, 1 = snark (doubles letter), 2 = boojum (doubles word)
                  let bonusValue = 0;
                  if (currentBoard.boojum && Array.isArray(currentBoard.boojum) && currentBoard.boojum[row]) {
                    bonusValue = currentBoard.boojum[row][col] || 0;
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
            {/* Player filter banner */}
            {selectedPlayerIds.size > 0 && (
              <div className="player-filter-banner">
                <span className="filter-label">Filtered by:</span>
                {Array.from(selectedPlayerIds).map(playerId => {
                  const player = currentBoard.scores.find(s => s.player_id === playerId);
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
            {/* Word Lists - using unified component */}
            {(() => {
              const { boojum, snark } = getBonusLetters(currentBoard);
              // Convert words_by_length format to match WordLists expected format
              // Daily board format: Record<string, WordData[]>
              // WordLists expects: Record<string, Record<string, ExtendedWordData>>
              const wordsByLengthForComponent: Record<string, Record<string, { word: string; sum_players_found: number; players_found: (number | null)[] }>> = {};
              
              if (currentBoard.words_by_length) {
                Object.keys(currentBoard.words_by_length).forEach(length => {
                  const words = currentBoard.words_by_length![length];
                  wordsByLengthForComponent[length] = {};
                  words.forEach(wordData => {
                    wordsByLengthForComponent[length][wordData.word] = wordData;
                  });
                });
              }
              
              return (
                <WordLists
                  wordsByLength={wordsByLengthForComponent}
                  wordsFound={new Set()} // Daily board solution shows all words, not just found ones
                  gameStatus="finished" // Always finished for solution view
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

