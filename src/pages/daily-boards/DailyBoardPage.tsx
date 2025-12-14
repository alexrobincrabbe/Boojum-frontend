import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBoardTheme } from '../../contexts/BoardThemeContext';
import { lobbyAPI } from '../../services/api';
import { fetchDefinition } from '../../utils/dictionary';
import { calculateWordScore } from '../game-room/utils/scoreCalculation';
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
  const { isAuthenticated, user } = useAuth();
  const { darkMode, colorsOff } = useBoardTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Definition popup state
  const [popup, setPopup] = useState<{ word: string; definition: string } | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Cleanup popup timeout on unmount
  useEffect(() => {
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
    };
  }, []);

  // Close popup when clicking outside of it
  useEffect(() => {
    if (!popup) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        if (popupTimeoutRef.current) {
          clearTimeout(popupTimeoutRef.current);
        }
        setPopup(null);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popup]);

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
          const boardIndex = boardsData.findIndex(board => board.id === boardId);
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
  const togglePlayerFilter = (playerId: number | null) => {
    setSelectedPlayerIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  // Get word class for color coding based on filtered players
  // Always from current user's perspective. Selected players determine which "other players" are considered.
  const getWordClass = (wordData: WordData, filteredPlayerIds: Set<number | null>): string => {
    let wordClass = 'word';
    const { players_found, sum_players_found } = wordData;
    
    // Always check from current user's perspective
    const currentUserId = user?.id || null;
    const currentUserFound = currentUserId && players_found.includes(currentUserId) ? 1 : 0;
    
    if (filteredPlayerIds.size === 0) {
      // No filter: count all other players
      if (currentUserFound === 1) {
        // Current user found it
        if (sum_players_found === 1) {
          // Only current user found it
          wordClass += ' green';
        } else if (sum_players_found === 2) {
          // Current user + 1 other found it
          wordClass += ' yellow';
        } else if (sum_players_found > 2) {
          // Current user + 2+ others found it
          wordClass += ' pink';
        }
      } else if (sum_players_found > 0) {
        // Current user didn't find it, but others did
        wordClass += ' blue';
      }
      return wordClass;
    }
    
    // Filter is applied: only count selected players as "other players"
    // Count how many selected players found it (these are the "other players" we consider)
    const selectedPlayersFound = players_found.filter(id => filteredPlayerIds.has(id));
    const selectedPlayersCount = selectedPlayersFound.length;
    
    if (currentUserFound === 1) {
      // Current user found it
      if (selectedPlayersCount === 0) {
        // Current user found it, and no selected players found it
        // This means only current user found it (from the perspective of selected players)
        wordClass += ' green';
      } else if (selectedPlayersCount === 1) {
        // Current user found it, and exactly 1 selected player also found it
        wordClass += ' yellow';
      } else if (selectedPlayersCount >= 2) {
        // Current user found it, and 2+ selected players also found it
        wordClass += ' pink';
      }
    } else if (selectedPlayersCount > 0) {
      // Current user didn't find it, but at least one selected player found it
      wordClass += ' blue';
    }
    // If no one found it (from the perspective of current user and selected players), no additional class
    
    return wordClass;
  };

  // Helper function to get color priority for sorting (green=0, yellow=1, pink=2, blue=3, default=4)
  const getColorPriority = (wordClass: string): number => {
    if (wordClass.includes('green')) return 0;
    if (wordClass.includes('yellow')) return 1;
    if (wordClass.includes('pink')) return 2;
    if (wordClass.includes('blue')) return 3;
    return 4;
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

  // Handle word click to show definition
  const handleWordClick = async (e: React.MouseEvent, word: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }

    setPopup({
      word,
      definition: 'Loading',
    });

    try {
      const definition = await fetchDefinition(word);
      setPopup({
        word,
        definition,
      });

      popupTimeoutRef.current = setTimeout(() => {
        setPopup(null);
      }, 5000);
    } catch {
      setPopup({
        word,
        definition: '❌ Failed to load definition.',
      });

      popupTimeoutRef.current = setTimeout(() => {
        setPopup(null);
      }, 5000);
    }
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
          <button
            className="pagination-btn"
            onClick={handlePrevious}
            disabled={!hasPrevious}
          >
            ← Previous
          </button>
          <div className="pagination-info">
            Board {currentPage + 1} of {boards.length}
          </div>
          <button
            className="pagination-btn"
            onClick={handleNext}
            disabled={!hasNext}
          >
            Next →
          </button>
        </div>

        {/* Board Info */}
        <div className="daily-board-header">
          <h1 className="daily-board-title">{currentBoard.title}</h1>
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
                <em>Please log in to play the daily boards</em>
              </div>
            )}
          </div>
        )}

        {/* High Scores Table */}
        <div className="daily-board-scores-section">
          <h2 className="scores-title">High Scores</h2>
          {currentBoard.scores.length > 0 ? (
            <div className="scores-table-container">
              <table className="scores-table">
                <thead>
                  <tr>
                    <th className="rank-col">Rank</th>
                    <th className="player-col">Player</th>
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
                      onClick={() => togglePlayerFilter(score.player_id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="rank-col">{index + 1}</td>
                      <td className="player-col">
                        <div className="player-info">
                          {score.player_profile_picture && 
                           !score.player_profile_picture.includes('placeholder') && 
                           !score.player_profile_picture.includes('default.png') ? (
                            <img
                              src={score.player_profile_picture}
                              alt={score.player_display_name}
                              className="player-avatar"
                            />
                          ) : (
                            <div className="player-avatar-placeholder">
                              {score.player_display_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className="player-name"
                            style={{ color: score.player_chat_color }}
                          >
                            {score.player_display_name}
                          </span>
                        </div>
                      </td>
                      <td className="score-col">{score.score} pts</td>
                      <td className="word-col">
                        {score.best_word ? (
                          <>
                            {score.best_word}{' '}
                            <span className="word-score">
                              ({score.best_word_score}pts)
                            </span>
                          </>
                        ) : (
                          <span className="hidden-word">*****</span>
                        )}
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
                        e.stopPropagation();
                        togglePlayerFilter(playerId);
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
                  }}
                >
                  Clear Filter
                </button>
              </div>
            )}
            {selectedPlayerIds.size === 0 && (
              <div className="player-filter-banner">
                <span className="filter-label">Showing: All players</span>
              </div>
            )}
            {/* Color coding explanation banner */}
            <div id="color-coding-banner" className="color-coding-banner">
              <span className="color-coding-item green-text">You found it</span>
              <span className="color-coding-item yellow-text">You & 1 other found it</span>
              <span className="color-coding-item pink-text">You & 2+ others found it</span>
              <span className="color-coding-item blue-text">Others found it</span>
            </div>
            <div id="word-lists" className="daily-word-lists">
              {Object.keys(currentBoard.words_by_length)
                .sort((a, b) => {
                  const aNum = a === '9+' ? 9 : parseInt(a);
                  const bNum = b === '9+' ? 9 : parseInt(b);
                  return aNum - bNum; // Sort ascending: 3, 4, 5, 6, 7, 8, 9+
                })
                .map((length) => {
                  const words = currentBoard.words_by_length![length];
                  const { boojum, snark } = getBonusLetters(currentBoard);
                  
                  // Sort words: first by color (green, yellow, pink, blue, default), then alphabetically
                  const sortedWords = [...words].sort((a, b) => {
                    const aClass = getWordClass(a, selectedPlayerIds);
                    const bClass = getWordClass(b, selectedPlayerIds);
                    const aPriority = getColorPriority(aClass);
                    const bPriority = getColorPriority(bClass);
                    if (aPriority !== bPriority) {
                      return aPriority - bPriority;
                    }
                    return a.word.localeCompare(b.word);
                  });
                  
                  return (
                    <div key={length} className="daily-word-list-section">
                      <h4 className="word-length-header">{length} Letters</h4>
                      <div className="word-list-words">
                        {sortedWords.map((wordData, idx) => {
                          const wordClass = getWordClass(wordData, selectedPlayerIds);
                          const wordScore = calculateWordScore(wordData.word, boojum, snark);
                          return (
                            <div
                              key={idx}
                              className={`word ${wordClass}`}
                              onClick={(e) => handleWordClick(e, wordData.word)}
                              style={{ cursor: 'pointer' }}
                            >
                              <span>{wordData.word}</span>
                              <span className="word-score">({wordScore}pts)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
      
      {/* Definition Popup */}
      {popup && (
        <div 
          ref={popupRef}
          className="definition-popup"
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{popup.word}</div>
          <div className={popup.definition === 'Loading' ? 'loading-dots' : ''}>
            {popup.definition}
          </div>
        </div>
      )}
    </div>
  );
}

