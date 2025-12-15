import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBoardTheme } from '../../contexts/BoardThemeContext';
import { lobbyAPI } from '../../services/api';
import { fetchDefinition } from '../../utils/dictionary';
import { calculateWordScore } from '../game-room/utils/scoreCalculation';
import { toast } from 'react-toastify';
import './TimelessBoardPage.css';
import '../game-room/GameRoom.css';

interface TimelessBoardScore {
  player_id: number | null;
  player_username: string;
  player_display_name: string;
  player_profile_url: string;
  player_profile_picture: string;
  player_chat_color: string;
  score_percentage: number;
  best_word: string | null;
  number_of_words: number;
  is_current_user: boolean;
}

interface WordData {
  word: string;
  playerFound?: number;
  totalFound?: number;
}

interface TimelessBoard {
  id: number;
  title: string;
  date: string;
  type: 'normal' | 'bonus';
  time_remaining_seconds: number;
  time_remaining_str: string;
  played: boolean;
  scores: TimelessBoardScore[];
  board_letters?: string[][];
  board_words?: string[];
  boojum?: number[][];
  words_by_length?: Record<string, WordData[]>;
}

const LEVELS = [
  { value: 4, name: 'Curious', description: 'a cosy dictionary of familiar favourites' },
  { value: 7, name: 'Curiouser', description: 'a broader trove, with trickier, less common words' },
  { value: 10, name: 'Rabbit Hole', description: 'vast and peculiar, bursting with the rare, the archaic … and the downright obscure' },
];

export default function TimelessBoardPage() {
    const lastQueryRef = useRef<string | null>(null);


  // Store boards for each level separately
  const [boardsByLevel, setBoardsByLevel] = useState<Record<number, TimelessBoard[]>>({
    4: [],
    7: [],
    10: [],
  });
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentLevel, setCurrentLevel] = useState<number>(10); // Default to Rabbit Hole
  const { isAuthenticated, user } = useAuth();
  const { darkMode, colorsOff } = useBoardTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Definition popup state
  const [popup, setPopup] = useState<{ word: string; definition: string } | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  
  // Get boards for current level
  const boards = boardsByLevel[currentLevel] || [];

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

  const formatTimeRemaining = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const fetchBoards = useCallback(async () => {
    try {
      setLoading(true);
      
      const data = await lobbyAPI.getTimelessBoardsAll([4, 7, 10]);


setBoardsByLevel({
  4: data?.data?.["4"]?.boards ?? [],
  7: data?.data?.["7"]?.boards ?? [],
  10: data?.data?.["10"]?.boards ?? [],
});

      
      // Check if there's a board ID in the URL
      const boardIdParam = searchParams.get('board');
      if (boardIdParam) {
        const boardId = parseInt(boardIdParam, 10);
        // Find which level this board belongs to
        let foundLevel = 10; // default
        let boardIndex = -1;
        
        const boards4 = data?.data?.["4"]?.boards ?? [];
        const boards7 = data?.data?.["7"]?.boards ?? [];
        const boards10 = data?.data?.["10"]?.boards ?? [];
        
        if (boards4.some(b => b.id === boardId)) {
          foundLevel = 4;
          boardIndex = boards4.findIndex(b => b.id === boardId);
        } else if (boards7.some(b => b.id === boardId)) {
          foundLevel = 7;
          boardIndex = boards7.findIndex(b => b.id === boardId);
        } else if (boards10.some(b => b.id === boardId)) {
          foundLevel = 10;
          boardIndex = boards10.findIndex(b => b.id === boardId);
        }
        
        if (boardIndex !== -1) {
          setCurrentLevel(foundLevel);
          setCurrentPage(boardIndex);
        } else {
          setCurrentPage(0);
        }
      } else {
        setCurrentPage(0);
      }
    } catch (error) {
      console.error('Error fetching timeless boards:', error);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    const key = searchParams.toString(); // e.g. "board=123"
    if (lastQueryRef.current === key) return;
    lastQueryRef.current = key;
  
    fetchBoards();
  }, [fetchBoards, searchParams]);
  

  const currentBoard = boards[currentPage];

  // Update timer every second
  useEffect(() => {
    if (!currentBoard || currentBoard.time_remaining_seconds <= 0) return;

    setTimeRemaining(currentBoard.time_remaining_seconds);
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Reload boards when timer reaches 0 to get solution
          fetchBoards();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentBoard?.id, currentBoard?.time_remaining_seconds]);
  const hasNext = currentPage > 0; // Can go to newer board (later day) - going backwards in array
  const hasPrevious = currentPage < boards.length - 1; // Can go to older board (earlier day) - going forwards in array

  const handleNext = () => {
    if (hasNext) {
      setCurrentPage(currentPage - 1); // Go to newer board (earlier in array)
    }
  };

  const handlePrevious = () => {
    if (hasPrevious) {
      setCurrentPage(currentPage + 1); // Go to older board (later in array)
    }
  };

  const handleLevelChange = (level: number) => {
    const newBoards = boardsByLevel[level] || [];
    // Keep current page when changing level, but ensure it's valid for the new level
    if (currentPage >= newBoards.length) {
      setCurrentPage(Math.max(0, newBoards.length - 1));
    }
    setCurrentLevel(level);
    // No need to reload - boards are already loaded for all levels
  };

  const handlePlay = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (currentBoard?.id && currentBoard.time_remaining_seconds > 0) {
      navigate(`/timeless-boards/play/${currentBoard.id}/${currentLevel}`);
    } else {
      toast.error('This board has expired');
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

  const getBonusLetters = (board: TimelessBoard) => {
    let boojumLetter: string | undefined;
    let snarkLetter: string | undefined;

    if (board.boojum && board.board_letters) {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (board.boojum[r][c] === 1) {
            snarkLetter = board.board_letters[r][c];
          } else if (board.boojum[r][c] === 2) {
            boojumLetter = board.board_letters[r][c];
          }
        }
      }
    }
    return { boojum: boojumLetter, snark: snarkLetter };
  };

  const handleWordClick = async (word: string) => {
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }
    
    try {
      const definition = await fetchDefinition(word);
      setPopup({ word, definition });
      
      // Auto-close after 5 seconds
      popupTimeoutRef.current = setTimeout(() => {
        setPopup(null);
      }, 5000);
    } catch (error) {
      console.error('Error fetching definition:', error);
    }
  };

  if (loading) {
    return <div className="timeless-board-page">Loading timeless boards...</div>;
  }

  if (!currentBoard) {
    return (
      <div className="timeless-board-page">
        <div className="no-boards">No timeless boards available</div>
      </div>
    );
  }

  const solutionRevealed = currentBoard.time_remaining_seconds <= 0;
  const displayTimeRemaining = timeRemaining > 0 ? timeRemaining : currentBoard.time_remaining_seconds;

  return (
    <div className="timeless-board-page">
      {/* Pagination buttons at top corners */}
      <div className="timeless-board-top-pagination">
        <div className="pagination-top-left">
          {hasPrevious && (
            <div className="pagination-left-container">
              <button className="pagination-btn" onClick={handlePrevious}>
                ← Previous
              </button>
              <div className="see-solution-text">see solution</div>
            </div>
          )}
        </div>
        <div className="pagination-top-right">
          {hasNext && (
            <button className="pagination-btn" onClick={handleNext}>
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Header with title, timer, and info */}
      <div className="timeless-board-header">
        <div className="timeless-board-header-content">
          <h1 className="timeless-board-title">{currentBoard.title}</h1>
          <div className="timeless-board-date">{formatDate(currentBoard.date)}</div>
          <div className="timeless-board-meta">
            {currentBoard.type === 'bonus' && (
              <span className="board-type bonus">Bonus Letters</span>
            )}
          </div>
          {/* Timer */}
          {!solutionRevealed && (
            <div className="time-remaining-header">
              <span className="time-label">Time remaining: </span>
              <span className="time-value">{formatTimeRemaining(displayTimeRemaining)}</span>
            </div>
          )}
          {/* Info text */}
          <div className="timeless-board-info">
            <p className="yellow">
              You can submit a score for each level of each board - Your progress is automatically saved for the 24 hour period,
              so you're free to wander off and stretch your legs.
              <br />
              When the timer reaches 0, a new board will become available, at which time you'll be able to peek at the word lists from previous puzzles
              by clicking 'Previous'.
            </p>
          </div>
        </div>
      </div>

      {/* Main content - single column */}
      <div className="timeless-board-content">
        {/* Level selector with play button */}
        <div className="level-selector">
          <div className="level-selector-title">CHOOSE YOUR LEVEL</div>
          <div className="level-buttons">
            {LEVELS.map((level) => (
              <button
                key={level.value}
                className={`level-button ${currentLevel === level.value ? 'active' : ''}`}
                onClick={() => handleLevelChange(level.value)}
              >
                {level.name}
              </button>
            ))}
          </div>
          <div className="level-descriptions">
            {LEVELS.map((level) => (
              <div key={level.value} className={`level-description ${currentLevel === level.value ? 'active' : ''}`}>
                <span className="level-name">{level.name}</span>: {level.description}
              </div>
            ))}
          </div>
          {/* Play button */}
          {!solutionRevealed && (
            <div className="play-button-container">
              {isAuthenticated ? (
                !currentBoard.played ? (
                  <button className="play-now-btn-small" onClick={handlePlay}>
                    Play ({LEVELS.find(l => l.value === currentLevel)?.name})
                  </button>
                ) : (
                  <div className="already-played">
                    <em className="yellow">
                      You have played this board on level -{' '}
                      <span className="pink">{LEVELS.find(l => l.value === currentLevel)?.name}</span>.
                    </em>
                  </div>
                )
              ) : (
                <em className="yellow">Please log in to play the timeless boards</em>
              )}
            </div>
          )}
        </div>

        {/* Scores table */}
        {currentBoard.scores.length > 0 && (
          <div className="timeless-scores-container">
            <table className="timeless-scores-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Score (%)</th>
                </tr>
              </thead>
              <tbody>
                {currentBoard.scores.map((score, index) => (
                  <tr key={score.player_id || index} className={score.is_current_user ? 'current-user-score' : ''}>
                    <td>
                      <div className="player-info">
                        {score.player_profile_picture && score.player_profile_picture !== '/images/default.png' ? (
                          <img
                            src={score.player_profile_picture}
                            alt={score.player_display_name}
                            className="player-avatar"
                          />
                        ) : (
                          <div className="player-avatar-initial" style={{ backgroundColor: score.player_chat_color }}>
                            {score.player_display_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ color: score.player_chat_color }}>{score.player_display_name}</span>
                      </div>
                    </td>
                    <td>
                      <div className="score-percentage-bar">
                        <div
                          className="score-percentage-fill"
                          style={{ width: `${score.score_percentage}%` }}
                        >
                          {score.score_percentage}%
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Solution display */}
        {solutionRevealed && (
          <div className="timeless-board-solution">
            <h2 className="solution-title">Board Solution</h2>
            {currentBoard.board_letters && (
              <div className="board-display-container">
                <div 
                  id="timeless-board" 
                  className={`board ${darkMode ? 'board-dark' : 'board-light'}`}
                  style={{
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    aspectRatio: '1 / 1',
                    width: 'min(400px, 100%)',
                  }}
                >
                  {Array.from({ length: 16 }, (_, i) => {
                    const row = Math.floor(i / 4);
                    const col = i % 4;
                    const letter = currentBoard.board_letters?.[row]?.[col] || '';
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
                      >
                        {letter}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Word lists */}
            {currentBoard.words_by_length && (
              <div className="timeless-word-lists">
                <div className="color-explanation-banner">
                  <span className="color-green">You got it</span>
                  <span className="color-white">You didn't get it</span>
                </div>
                <div className="daily-word-lists">
                  {Object.keys(currentBoard.words_by_length)
                    .sort((a, b) => {
                      const aNum = a === '9+' ? 9 : parseInt(a);
                      const bNum = b === '9+' ? 9 : parseInt(b);
                      return aNum - bNum;
                    })
                    .map((length) => {
                      const words = currentBoard.words_by_length![length];
                      const { boojum, snark } = getBonusLetters(currentBoard);
                      
                      return (
                        <div key={length} className="daily-word-list-section">
                          <h3 className="word-length-header">{length} Letter Words</h3>
                          <div className="word-list-words">
                            {words.map((wordData, idx) => {
                              // Simple: green if player found it, white if not
                              const wordClass = wordData.playerFound === 1 ? 'green' : 'default-white';
                              const wordScore = wordData.word
                                ? calculateWordScore(wordData.word, boojum, snark)
                                : 0;
                              
                              return (
                                <span
                                  key={idx}
                                  className={`word ${wordClass}`}
                                  onClick={() => handleWordClick(wordData.word)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {wordData.word} ({wordScore})
                                </span>
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
        )}
      </div>

      {/* Definition popup */}
      {popup && (
        <div className="definition-popup" ref={popupRef}>
          <div className="definition-popup-content">
            <h3>{popup.word}</h3>
            <p>{popup.definition}</p>
            <button onClick={() => setPopup(null)}>Close</button>
          </div>
        </div>  
      )}
    </div>
  );
}


  