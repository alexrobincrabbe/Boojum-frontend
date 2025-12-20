import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tournamentAPI } from '../../services/api';
import { Loading } from '../../components/Loading';
import { fetchDefinition } from '../../utils/dictionary';
import { calculateWordScore } from '../game-room/utils/scoreCalculation';
import { GameReplay } from './components/GameReplay';
import type { RecordingEvent } from '../../hooks/useGameRecording';
import '../game-room/GameRoom.css';
import './MatchResultsPage.css';

interface MatchDetails {
  match: {
    id: number;
    round: number;
    one_shot: boolean;
    pool: number | null;
    group_number: number | null;
  };
  player_1: {
    id: number;
    username: string;
    display_name: string;
    chat_color: string;
  };
  player_2: {
    id: number;
    username: string;
    display_name: string;
    chat_color: string;
  };
  result: {
    score_player_1: number;
    score_player_2: number;
    best_word_player_1: string;
    best_word_score_player_1: number;
    best_word_player_2: string;
    best_word_score_player_2: number;
    number_of_words_player_1: number;
    number_of_words_player_2: number;
    one_shot_time_player_1: number | null;
    one_shot_time_player_2: number | null;
    game_recording_player_1: any[];
    game_recording_player_2: any[];
    winner: {
      id: number;
      username: string;
      display_name: string;
    } | null;
    loser: {
      id: number;
      username: string;
      display_name: string;
    } | null;
  };
  board: {
    letters: string[][];
    words: string[];
    boojum_bonus: string | null;
    snark: string | null;
    boojum_array: number[][] | null;
    words_by_length: Record<string, Array<{
      word: string;
      player1FoundWord: boolean;
      player2FoundWord: boolean;
    }>>;
  };
  player_1_found_words: boolean[];
  player_2_found_words: boolean[];
}

export default function MatchResultsPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [data, setData] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ word: string; definition: string } | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [replayPlayer, setReplayPlayer] = useState<1 | 2 | null>(null);

  useEffect(() => {
    const loadMatchDetails = async () => {
      if (!matchId) {
        setError('Match ID is required');
        setLoading(false);
        return;
      }

      try {
        const matchData = await tournamentAPI.getMatchDetails(parseInt(matchId));
        setData(matchData);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || 'Failed to load match details');
        console.error('Error loading match details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMatchDetails();
  }, [matchId]);

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
    return <Loading minHeight="calc(100vh - 70px)" />;
  }

  if (error || !data) {
    return (
      <div className="match-results-container">
        <div className="error-message">{error || 'Match not found'}</div>
        <Link to="/tournament" className="back-link">← Back to Tournament</Link>
      </div>
    );
  }

  // Convert words_by_length to format expected by WordLists
  const wordsByLengthForLists: Record<string, string[]> = {};
  if (data.board.words_by_length) {
    Object.keys(data.board.words_by_length).forEach(length => {
      wordsByLengthForLists[length] = data.board.words_by_length[length].map(item => item.word);
    });
  }

  // Create word lists with color coding
  const wordsByLengthWithColors: Record<string, Array<{
    word: string;
    player1Found: boolean;
    player2Found: boolean;
  }>> = {};
  if (data.board.words_by_length) {
    Object.keys(data.board.words_by_length).forEach(length => {
      wordsByLengthWithColors[length] = data.board.words_by_length[length].map(item => ({
        word: item.word,
        player1Found: item.player1FoundWord,
        player2Found: item.player2FoundWord,
      }));
    });
  }

  return (
    <div className="match-results-container">
      <div className="match-results-header">
        <Link 
          to={(() => {
            const params = new URLSearchParams();
            if (data.match.round) params.set('round', data.match.round.toString());
            if (data.match.pool) params.set('tier', data.match.pool.toString());
            if (data.match.group_number) {
              // Map group_number (1-6) to selectedGroup (1 or 2) within each tier
              let selectedGroup = 1;
              if (data.match.group_number === 2 || data.match.group_number === 4 || data.match.group_number === 6) {
                selectedGroup = 2;
              }
              params.set('group', selectedGroup.toString());
            }
            const queryString = params.toString();
            return `/tournament${queryString ? `?${queryString}` : ''}`;
          })()}
          className="back-link"
        >
          ← Back to Tournament
        </Link>
        <h1 className="match-results-title">Match Results - Round {data.match.round}</h1>
      </div>

      <div className="match-results-content">
        {/* Player Scores */}
        <div className="match-players-scores">
          <div className="player-score-card">
            <h2 
              className="player-name" 
              style={{ color: data.player_1.chat_color }}
            >
              {data.player_1.display_name}
            </h2>
            <div className="player-stats">
              <div className="stat-item">
                <span className="stat-label pink">Final score:</span>
                <span className="stat-value">{data.result.score_player_1}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label green">Best word:</span>
                <span className="stat-value">
                  {data.result.best_word_player_1} - {data.result.best_word_score_player_1}pts
                </span>
              </div>
              {data.match.one_shot ? (
                <div className="stat-item">
                  <span className="stat-label yellow">Time:</span>
                  <span className="stat-value">
                    {data.result.one_shot_time_player_1 || 0}s
                  </span>
                </div>
              ) : (
                <div className="stat-item">
                  <span className="stat-label yellow">Number of words:</span>
                  <span className="stat-value">{data.result.number_of_words_player_1}</span>
                </div>
              )}
            </div>
            {data.result.game_recording_player_1 && data.result.game_recording_player_1.length > 0 && (
              <button
                onClick={() => setReplayPlayer(1)}
                className="replay-button"
                style={{ borderColor: data.player_1.chat_color }}
              >
                ▶ Watch Replay
              </button>
            )}
          </div>

          <div className="player-score-card">
            <h2 
              className="player-name" 
              style={{ color: data.player_2.chat_color }}
            >
              {data.player_2.display_name}
            </h2>
            <div className="player-stats">
              <div className="stat-item">
                <span className="stat-label pink">Final score:</span>
                <span className="stat-value">{data.result.score_player_2}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label green">Best word:</span>
                <span className="stat-value">
                  {data.result.best_word_player_2} - {data.result.best_word_score_player_2}pts
                </span>
              </div>
              {data.match.one_shot ? (
                <div className="stat-item">
                  <span className="stat-label yellow">Time:</span>
                  <span className="stat-value">
                    {data.result.one_shot_time_player_2 || 0}s
                  </span>
                </div>
              ) : (
                <div className="stat-item">
                  <span className="stat-label yellow">Number of words:</span>
                  <span className="stat-value">{data.result.number_of_words_player_2}                  </span>
                </div>
              )}
            </div>
            {data.result.game_recording_player_2 && data.result.game_recording_player_2.length > 0 && (
              <button
                onClick={() => setReplayPlayer(2)}
                className="replay-button"
                style={{ borderColor: data.player_2.chat_color }}
              >
                ▶ Watch Replay
              </button>
            )}
          </div>
        </div>

        {/* Winner */}
        {data.result.winner && (
          <div className="match-winner">
            <span className="winner-label green">Winner: </span>
            <span 
              className="winner-name"
              style={{ 
                color: data.result.winner.id === data.player_1.id 
                  ? data.player_1.chat_color 
                  : data.player_2.chat_color 
              }}
            >
              {data.result.winner.display_name}
            </span>
          </div>
        )}

        {/* Game Board */}
        {data && (
          <div className="match-board-section">
            <div className="board-wrapper">
              <div 
                id="board"
                className="board-dark"
              >
                {data.board.letters.map((row, rowIndex) =>
                  row.map((letter, colIndex) => {
                    // Check if this tile is a bonus tile (snark = 1, boojum = 2)
                    // boojum_array is a 2D array: [[0,0,0,0], [0,1,0,0], [0,0,2,0], ...]
                    const boojumRow = data.board.boojum_array?.[rowIndex];
                    const bonusValue = boojumRow?.[colIndex] ?? 0;
                    const isSnark = bonusValue === 1;
                    const isBoojum = bonusValue === 2;
                    
                    // Build className string
                    let className = 'letter dark-mode';
                    if (isSnark) {
                      className += ' snark';
                    }
                    if (isBoojum) {
                      className += ' boojum';
                    }
                    
                    return (
                      <div
                        key={`${rowIndex}-${colIndex}`}
                        className={className.trim()}
                      >
                        <div className="letValue">{letter}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Word Lists with Color Coding */}
        <div className="centered-element">
          <div id="word-definition-banner" className="blue">
            CLICK ON A WORD TO SEE THE DEFINITION
          </div>
          <div className="color-coding-banner">
            <span className="color-coding-item" style={{ color: '#FFBE86' }}>Both got it</span>
            <span className="color-coding-item" style={{ color: data.player_1.chat_color || '#71bbe9' }}>
              {data.player_1.display_name} got it
            </span>
            <span className="color-coding-item" style={{ 
              color: (data.player_1.chat_color || '#71bbe9') === (data.player_2.chat_color || '#71bbe9') 
                ? '#B3FFC7' 
                : (data.player_2.chat_color || '#71bbe9')
            }}>
              {data.player_2.display_name} got it
            </span>
            <span className="color-coding-item" style={{ color: '#fff' }}>Neither got it</span>
          </div>
          <div id="word-lists">
            {Object.keys(wordsByLengthWithColors).sort((a, b) => {
              const aNum = a === '9+' ? 9 : parseInt(a);
              const bNum = b === '9+' ? 9 : parseInt(b);
              return bNum - aNum;
            }).map(length => {
              // Sort words: both got it, then player 1, then player 2, then neither
              const sortedWords = [...wordsByLengthWithColors[length]].sort((a, b) => {
                const aBoth = a.player1Found && a.player2Found ? 0 : 1;
                const bBoth = b.player1Found && b.player2Found ? 0 : 1;
                if (aBoth !== bBoth) return aBoth - bBoth;
                
                const aPlayer1 = a.player1Found ? 0 : 1;
                const bPlayer1 = b.player1Found ? 0 : 1;
                if (aPlayer1 !== bPlayer1) return aPlayer1 - bPlayer1;
                
                const aPlayer2 = a.player2Found ? 0 : 1;
                const bPlayer2 = b.player2Found ? 0 : 1;
                if (aPlayer2 !== bPlayer2) return aPlayer2 - bPlayer2;
                
                // If same category, sort alphabetically
                return a.word.localeCompare(b.word);
              });

              return (
                <div key={length} className="word-sublist" id={`word-length-${length}`}>
                  <strong>{length === '9+' ? '9+' : length} - letters</strong>
                  <div className="word-sublist-scroll" style={{ flexDirection: 'column' }}>
                    {sortedWords.map((item, idx) => {
                      let wordColor = '#fff'; // Neither got it - default white
                      
                      if (item.player1Found && item.player2Found) {
                        // Both got it - use yellow/orange fallback
                        wordColor = '#FFBE86';
                      } else if (item.player1Found) {
                        // Player 1 got it - use player 1 color
                        wordColor = data.player_1.chat_color || '#71bbe9';
                      } else if (item.player2Found) {
                        // Player 2 got it - use player 2 color, or fallback if same as player 1
                        const player2Color = data.player_2.chat_color || '#71bbe9';
                        const player1Color = data.player_1.chat_color || '#71bbe9';
                        if (player2Color === player1Color) {
                          // Fallback color if both players have same color
                          wordColor = '#B3FFC7'; // Light green/cyan
                        } else {
                          wordColor = player2Color;
                        }
                      }
                      
                      // Calculate word score
                      const wordScore = calculateWordScore(
                        item.word,
                        data.board.boojum_bonus || undefined,
                        data.board.snark || undefined
                      );
                      
                      return (
                        <div
                          key={idx}
                          className="word"
                          onClick={(e) => handleWordClick(e, item.word)}
                          style={{ 
                            cursor: 'pointer',
                            color: wordColor
                          }}
                        >
                          <span>{item.word}</span>
                          <span className="word-score" style={{ color: wordColor }}>
                            ({wordScore}pts)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
      </div>

      {/* Game Replay Modal */}
      {replayPlayer && data && (
        <GameReplay
          recording={replayPlayer === 1 
            ? (data.result.game_recording_player_1 as RecordingEvent[])
            : (data.result.game_recording_player_2 as RecordingEvent[])
          }
          board={data.board.letters}
          boardWords={data.board.words}
          playerColor={replayPlayer === 1 ? data.player_1.chat_color : data.player_2.chat_color}
          playerName={replayPlayer === 1 ? data.player_1.display_name : data.player_2.display_name}
          foundWords={replayPlayer === 1 ? data.player_1_found_words : data.player_2_found_words}
          onClose={() => setReplayPlayer(null)}
        />
      )}
    </div>
  );
}

