import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBoardTheme } from '../../contexts/BoardThemeContext';
import { lobbyAPI } from '../../services/api';
import { calculateWordScore } from '../game-room/utils/scoreCalculation';
import { WordLists } from '../game-room/components/WordLists';
import { Username } from '../../components/Username';
import { toast } from 'react-toastify';
import './TimelessBoardPage.css';
import '../game-room/GameRoom.css';

interface TimelessBoardScore {
  player_id: number | null;
  player_display_name: string;
  score_percentage: number;
  is_current_user: boolean;
  which_words_found?: string[];
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

export default function TimelessBoardArchiveDetailPage() {
  const { boardId, level } = useParams<{ boardId: string; level: string }>();
  const [board, setBoard] = useState<TimelessBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const currentLevel = level ? parseInt(level, 10) : 10;
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
        navigate('/timeless-boards/archive');
        return;
      }

      try {
        setLoading(true);
        const boardData = await lobbyAPI.getTimelessBoardArchiveDetail(parseInt(boardId, 10), currentLevel);
        setBoard(boardData);
      } catch (error: any) {
        console.error('Error fetching board:', error);
        if (error.response?.status === 403) {
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
  }, [boardId, currentLevel, isAuthenticated, user, navigate]);

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
    if (board?.id) {
      navigate(`/timeless-boards/play/${board.id}/${currentLevel}?from_archive=true`);
    }
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
    return (
      <div className="timeless-board-page">
        <div className="loading-state">Loading board...</div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="timeless-board-page">
        <div className="no-boards">Board not found</div>
      </div>
    );
  }

  return (
    <div className="timeless-board-page">
      {/* Back button */}
      <div className="timeless-board-top-pagination">
        <div className="pagination-top-left">
          <div className="pagination-left-container">
            <button className="pagination-btn" onClick={() => navigate('/timeless-boards/archive')} aria-label="Back">
            </button>
            <span className="pagination-text">Back to Archive</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="timeless-board-header">
        <div className="timeless-board-header-content">
          <h1 className="timeless-board-title">{board.title}</h1>
          <div className="timeless-board-date">{formatDate(board.date)}</div>
          <div className="timeless-board-meta">
            {board.type === 'bonus' && (
              <span className="board-type bonus">Bonus Letters</span>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="timeless-board-content">
        {/* Level selector with play button */}
        <div className="level-selector">
          <div className="level-selector-title">CHOOSE YOUR LEVEL</div>
          <div className="level-buttons">
            {LEVELS.map((level) => (
              <button
                key={level.value}
                className={`level-button level-${level.value} ${currentLevel === level.value ? 'active' : ''}`}
                onClick={() => navigate(`/timeless-boards/archive/${boardId}/${level.value}`)}
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
          {!board.played && (
            <div className="play-button-container">
              <button className={`play-now-btn-small play-level-${currentLevel}`} onClick={handlePlay}>
                Play ({LEVELS.find(l => l.value === currentLevel)?.name})
              </button>
            </div>
          )}
        </div>

        {/* Scores table */}
        {board.scores.length > 0 && (
          <div className="timeless-scores-container">
            <table className="timeless-scores-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Score (%)</th>
                </tr>
              </thead>
              <tbody>
                {board.scores.map((score, index) => (
                  <tr key={score.player_id || index} className={score.is_current_user ? 'current-user-score' : ''}>
                    <td>
                      <div className="player-info">
                        <Username
                          username={score.player_display_name}
                          chatColor="#71bbe9"
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

        {/* Solution display - only show if user has played */}
        {board.played && board.board_letters && board.words_by_length && (
          <div className="timeless-board-solution">
            <h2 className="solution-title">Solution</h2>
            {board.board_letters && (
              <div className="board-display-container">
                <div className="board-wrapper">
                  <div 
                    id="timeless-board" 
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
            )}

            {/* Word Lists */}
            {board.words_by_length && board.board_words && (() => {
              const { boojum, snark } = getBonusLetters(board);
              
              const currentUserScore = board.scores.find(score => score.is_current_user);
              const userWordsFound = currentUserScore?.which_words_found || [];
              const userWordsFoundSet = new Set(userWordsFound.map((word: string) => word.toLowerCase()));
              
              // Convert timeless board words_by_length format to WordLists format
              // Backend returns: Record<string, WordData[]> where WordData has word, playerFound, totalFound
              // WordLists expects: Record<string, Record<string, { score, player_found, sum_players_found }>>
              const wordsByLengthForComponent: Record<string, Record<string, { score: number; player_found: number; sum_players_found: number }>> = {};
              
              // Process all words from board_words to ensure all words are shown
              board.board_words.forEach(word => {
                const wordLower = word.toLowerCase();
                const wordLength = word.length;
                const lengthKey = wordLength >= 9 ? '9+' : String(wordLength);
                
                if (!wordsByLengthForComponent[lengthKey]) {
                  wordsByLengthForComponent[lengthKey] = {};
                }
                
                // Find word data from words_by_length
                const wordData = board.words_by_length?.[lengthKey]?.find((w: WordData) => w.word.toLowerCase() === wordLower);
                const playerFound = userWordsFoundSet.has(wordLower) ? 1 : 0;
                const sumPlayersFound = wordData?.totalFound ?? 0;
                const score = calculateWordScore(word, boojum, snark);
                
                wordsByLengthForComponent[lengthKey][word] = {
                  score,
                  player_found: playerFound,
                  sum_players_found: sumPlayersFound,
                };
              });
              
              return (
                <WordLists
                  wordsByLength={wordsByLengthForComponent}
                  wordsFound={userWordsFoundSet}
                  gameStatus="finished"
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

