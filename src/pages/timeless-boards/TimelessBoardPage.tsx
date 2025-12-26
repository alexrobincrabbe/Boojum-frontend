import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBoardTheme } from '../../contexts/BoardThemeContext';
import { lobbyAPI } from '../../services/api';
import { calculateWordScore } from '../game-room/utils/scoreCalculation';
import { WordLists } from '../game-room/components/WordLists';
import { toast } from 'react-toastify';
import { Loading } from '../../components/Loading';
import { Username } from '../../components/Username';
import { ProfilePicture } from '../../components/ProfilePicture';
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
  which_words_found?: string[]; // Array of words found by this player
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
  const { isAuthenticated } = useAuth();
  const { darkMode } = useBoardTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  
  // Get boards for current level
  const boards = boardsByLevel[currentLevel] || [];

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
        
        if (boards4.some((b: TimelessBoard) => b.id === boardId)) {
          foundLevel = 4;
          boardIndex = boards4.findIndex((b: TimelessBoard) => b.id === boardId);
        } else if (boards7.some((b: TimelessBoard) => b.id === boardId)) {
          foundLevel = 7;
          boardIndex = boards7.findIndex((b: TimelessBoard) => b.id === boardId);
        } else if (boards10.some((b: TimelessBoard) => b.id === boardId)) {
          foundLevel = 10;
          boardIndex = boards10.findIndex((b: TimelessBoard) => b.id === boardId);
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


  if (loading) {
    return <Loading minHeight="calc(100vh - 70px)" />;
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

  // Determine timer color class based on remaining time
  const getTimerColorClass = (seconds: number) => {
    if (seconds < 1800) { // Less than 30 minutes
      return 'timer-pink';
    } else if (seconds < 7200) { // Less than 2 hours
      return 'timer-yellow';
    }
    return 'timer-green'; // 2+ hours (default)
  };

  return (
    <div className="timeless-board-page">
      {/* Pagination buttons at top corners */}
      <div className="timeless-board-top-pagination">
        <div className="pagination-top-left">
          {hasPrevious && (
            <div className="pagination-left-container">
              <button className="pagination-btn" onClick={handlePrevious} aria-label="Previous">
              </button>
              <span className="pagination-text">Previous (solution)</span>
            </div>
          )}
        </div>
        <div className="pagination-top-right">
          {hasNext && (
            <div className="pagination-right-container">
              <span className="pagination-text">Next</span>
              <button className="pagination-btn" onClick={handleNext} aria-label="Next">
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Header with title, timer, and info */}
      <div className="timeless-board-header">
        <div className="timeless-board-header-content">
          <h1 className="timeless-board-title">{currentBoard.title}</h1>
          {currentPage > 0 && (
            <div className="timeless-board-date">{formatDate(currentBoard.date)}</div>
          )}
          <div className="timeless-board-meta">
            {currentBoard.type === 'bonus' && (
              <span className="board-type bonus">Bonus Letters</span>
            )}
          </div>
          {/* Timer */}
          {!solutionRevealed && (
            <div className={`time-remaining-header ${getTimerColorClass(displayTimeRemaining)}`}>
              <span className="time-value">{formatTimeRemaining(displayTimeRemaining)}</span>
            </div>
          )}
          {/* Info text */}
          <div className="timeless-board-info">
            <ul className="text-blue-glow">
              <li>You can submit a score for each level of each board - Your progress is automatically saved for the 24 hour period, so you're free to wander off and stretch your legs.</li>
              <li>When the timer reaches 0, a new board will become available, at which time you'll be able to peek at the word lists from previous puzzles by clicking 'Previous'.</li>
            </ul>
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
                className={`level-button level-${level.value} ${currentLevel === level.value ? 'active' : ''}`}
                onClick={() => handleLevelChange(level.value)}
              >
                {level.name}
              </button>
            ))}
          </div>
          <div className="level-descriptions">
            {LEVELS.map((level) => (
              <div key={level.value} className={`level-description ${currentLevel === level.value ? 'active' : ''}`}>
                <span className={`level-name level-name-${level.value}`}>{level.name}</span>: {level.description}
              </div>
            ))}
          </div>
          {/* Play button */}
          {!solutionRevealed && (
            <div className="play-button-container">
              {isAuthenticated ? (
                !currentBoard.played ? (
                  <button className={`play-now-btn-small play-level-${currentLevel}`} onClick={handlePlay}>
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
                  <th></th>
                  <th>Score (%)</th>
                </tr>
              </thead>
              <tbody>
                {currentBoard.scores.map((score, index) => (
                  <tr key={score.player_id || index} className={score.is_current_user ? 'current-user-score' : ''}>
                    <td>
                      <div className="player-info">
                        <ProfilePicture
                          profilePictureUrl={score.player_profile_picture}
                          profileUrl={score.player_profile_url}
                          chatColor={score.player_chat_color}
                          size={30}
                          showBorder={true}
                        />
                        <Username
                          username={score.player_display_name}
                          profileUrl={score.player_profile_url}
                          chatColor={score.player_chat_color}
                        />
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
            <h2 className="solution-title">Solution</h2>
            {currentBoard.board_letters && (
              <div className="board-display-container">
                <div className="board-wrapper">
                  <div 
                    id="timeless-board" 
                    className={`board ${darkMode ? 'board-dark' : 'board-light'}`}
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
            )}

            {/* Word Lists - using unified component */}
            {currentBoard.words_by_length && currentBoard.board_words && (() => {
              const { boojum, snark } = getBonusLetters(currentBoard);
              
              // Get current user's score to find which words they found
              const currentUserScore = currentBoard.scores.find(score => score.is_current_user);
              const userWordsFound = currentUserScore?.which_words_found || [];
              const userWordsFoundSet = new Set(userWordsFound.map((word: string) => word.toLowerCase()));
              
              // Debug logging
              console.log('=== Timeless Board Word Highlighting Debug ===');
              console.log('Current User Score:', currentUserScore);
              console.log('User Words Found (raw):', userWordsFound);
              console.log('User Words Found Set (lowercase):', Array.from(userWordsFoundSet));
              console.log('Board Words Count:', currentBoard.board_words?.length);
              console.log('Words by Length Keys:', Object.keys(currentBoard.words_by_length || {}));
              
              // Build a map of words from words_by_length for quick lookup
              const wordsByLengthMap = new Map<string, WordData>();
              Object.keys(currentBoard.words_by_length).forEach(length => {
                const words = currentBoard.words_by_length![length];
                words.forEach(wordData => {
                  wordsByLengthMap.set(wordData.word.toLowerCase(), wordData);
                });
              });
              
              // Convert timeless board WordData format to protocol format for WordLists
              // Include ALL words from board_words, not just those in words_by_length
              const wordsByLengthForComponent: Record<string, Record<string, { score: number; player_found: number; sum_players_found: number }>> = {};
              
              // Process all words from board_words to ensure all words are shown
              currentBoard.board_words.forEach(word => {
                const wordLower = word.toLowerCase();
                const wordLength = word.length;
                const lengthKey = wordLength >= 9 ? '9+' : String(wordLength);
                
                // Initialize the length category if it doesn't exist
                if (!wordsByLengthForComponent[lengthKey]) {
                  wordsByLengthForComponent[lengthKey] = {};
                }
                
                // Get word data from words_by_length if available, otherwise create default
                const wordData = wordsByLengthMap.get(wordLower);
                
                // Check if current user found this word
                const playerFound = userWordsFoundSet.has(wordLower) ? 1 : 0;
                // Use totalFound from wordData if available, otherwise 0 (no one found it)
                const sumPlayersFound = wordData?.totalFound ?? 0;
                const score = calculateWordScore(word, boojum, snark);
                
                wordsByLengthForComponent[lengthKey][word] = {
                  score,
                  player_found: playerFound,
                  sum_players_found: sumPlayersFound,
                };
              });
              
              // Debug: Log a sample of words to check player_found values
              const sampleWords: Array<{word: string, player_found: number}> = [];
              Object.keys(wordsByLengthForComponent).forEach(length => {
                const words = wordsByLengthForComponent[length];
                Object.keys(words).slice(0, 5).forEach(word => {
                  sampleWords.push({
                    word,
                    player_found: words[word].player_found
                  });
                });
              });
              console.log('Sample words with player_found:', sampleWords);
              console.log('Words with player_found=1:', 
                Object.values(wordsByLengthForComponent)
                  .flatMap(words => Object.entries(words))
                  .filter(([, data]) => data.player_found === 1)
                  .map(([word]) => word)
              );
              console.log('Words Found Set passed to WordLists:', Array.from(userWordsFoundSet));
              console.log('========================================');
              
              return (
                <WordLists
                  wordsByLength={wordsByLengthForComponent}
                  wordsFound={userWordsFoundSet}
                  gameStatus="finished" // Always finished for solution view
                  hasFinalScores={true}
                  boojum={boojum}
                  snark={snark}
                  showColorBanner={false}
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


  