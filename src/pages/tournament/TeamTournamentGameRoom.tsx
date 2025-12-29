import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWordTracking } from '../game-room/services/useWordTracking';
import { useGameWebSocket } from '../game-room/services/useGameWebSocket';
import { GameBoard } from '../game-room/components/GameBoard';
import { WordLists } from '../game-room/components/WordLists';
import { ScoresModal } from '../game-room/components/ScoresModal';
import { teamTournamentAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Loading } from '../../components/Loading';
import { useGameRecording } from '../../hooks/useGameRecording';
import type { OutboundMessage, GameState } from '../../ws/protocol';
import '../game-room/GameRoom.css';

interface MatchInfo {
  match_id: number;
  player_position: string;
  already_played: boolean;
  tournament: {
    time_limit: number;
    type: string;
  };
}

export default function TeamTournamentGameRoom() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const token = localStorage.getItem('access_token') || '';
  const isGuest = !user || !token;

  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStartButton, setShowStartButton] = useState(true);
  const [showBackButton, setShowBackButton] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  // Load match info
  useEffect(() => {
    if (authLoading) return;

    const loadMatchInfo = async () => {
      if (!matchId || isGuest) {
        setError('Match ID is required and you must be logged in');
        setLoading(false);
        return;
      }

      try {
        const info = await teamTournamentAPI.getTeamMatchInfo(parseInt(matchId));
        setMatchInfo(info);
        
        if (info.already_played) {
          setError('You have already played this match');
          setTimeout(() => {
            navigate('/team-tournament');
          }, 2000);
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || 'Failed to load match info');
        console.error('Error loading match info:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMatchInfo();
  }, [matchId, isGuest, navigate, authLoading]);

  // Word tracking ref
  const wordTrackingRef = useRef<{
    initializeWordLists: (
      wordsByLength: Record<string, string[]>,
      gameState?: GameState | null,
      sendJson?: (message: OutboundMessage) => void
    ) => void;
  } | null>(null);

  // Custom WebSocket URL for team tournament matches
  const wsUrl = useMemo(() => {
    if (!matchId || !matchInfo || !matchInfo.player_position) return '';
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    const djangoBaseUrl = apiBaseUrl.replace('/api', '');
    const wsBaseUrl = djangoBaseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${wsBaseUrl}/ws/team-tournament/play/${matchId}/${matchInfo.player_position}/`;
  }, [matchId, matchInfo]);

  // GAME WS
  const {
    connectionState,
    gameState,
    timerState,
    hasBoardBeenShown,
    previousBoard,
    reconnect,
    sendJson,
  } = useGameWebSocket({
    roomId: matchId || '',
    token,
    isGuest: false,
    wsUrl: wsUrl,
    initializeWordLists: (wordsByLength, gameState, sendJson) => {
      wordTrackingRef.current?.initializeWordLists(wordsByLength, gameState, sendJson);
    },
    onScoreInChat: () => {},
    onMessage: (message) => {
      if (message.type === 'SHOW_BACK_BUTTON') {
        setShowBackButton(true);
      }
      if (message.type === 'ERROR' && message.code === 'ALREADY_PLAYED') {
        toast.error(message.message || 'You have already played this match');
        setTimeout(() => {
          navigate('/team-tournament');
        }, 2000);
      }
      if (message.type === 'ERROR') {
        toast.error(message.message || 'An error occurred');
      }
    },
  });

  const gameRecording = useGameRecording();

  const {
    wordsFound,
    handleWordSubmit,
    initializeWordLists,
    wordCounts,
    wordCountMax,
    wordsByLength,
    submitFinalScore,
  } = useWordTracking(gameState);

  const handleStartGame = useCallback(() => {
    if (sendJson && !gameStarted && matchId) {
      // sendJson automatically converts START_GAME to event_type: 'start_game'
      sendJson({ type: 'START_GAME' });
      setShowStartButton(false);
      setGameStarted(true);
    }
  }, [sendJson, gameStarted, matchId]);

  const [isScoresModalOpen, setIsScoresModalOpen] = useState(false);

  useEffect(() => {
    if (gameState?.gameStatus === 'playing' && !gameRecording.isRecording) {
      gameRecording.startRecording();
    }
  }, [gameState?.gameStatus, gameRecording]);

  useEffect(() => {
    if (gameState?.gameStatus === 'finished' && gameRecording.isRecording) {
      gameRecording.stopRecording();
    }
  }, [gameState?.gameStatus, gameRecording]);

  const prevGameStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentStatus = gameState?.gameStatus;
    const prevStatus = prevGameStatusRef.current;
    
    if (prevStatus === 'playing' && currentStatus === 'finished' && sendJson) {
      const recording = gameRecording.getRecording();
      const sendJsonWithRecording = (message: OutboundMessage) => {
        if (message.type === 'PLAYER_ACTION' && message.action === 'submit_final_score' && message.data) {
          message.data.game_recording = recording;
        }
        sendJson(message);
      };
      
      submitFinalScore(sendJsonWithRecording);
    }
    
    prevGameStatusRef.current = currentStatus;
  }, [gameState?.gameStatus, gameState?.finalScores, submitFinalScore, sendJson, gameRecording]);

  useEffect(() => {
    wordTrackingRef.current = {
      initializeWordLists,
    };
  }, [initializeWordLists]);

  useEffect(() => {
    if (gameState?.finalScores && gameState.gameStatus === 'finished') {
      setIsScoresModalOpen(true);
      setShowBackButton(true);
    }
  }, [gameState?.finalScores, gameState?.gameStatus]);

  if (loading || authLoading) {
    return <Loading minHeight="calc(100vh - 70px)" />;
  }

  if (error) {
    return (
      <div className="game-room-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!matchInfo) {
    return (
      <div className="game-room-container">
        <div className="error-message">Match not found</div>
      </div>
    );
  }

  if (matchInfo.already_played) {
    return (
      <div className="game-room-error">
        You have already played this match
        <button 
          onClick={() => navigate('/team-tournament')}
          style={{
            marginTop: '20px',
            padding: '8px 16px',
            backgroundColor: '#71bbe9',
            color: '#1b1835',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Back to Tournament
        </button>
      </div>
    );
  }

  return (
    <div className="game-room">
      {gameState && (
        <div className="game-content">
          <div className="game-header">
            <h1 style={{ color: '#71bbe9' }}>Team Tournament Match</h1>
            {showBackButton && (
              <button 
                className="back-button"
                onClick={() => {
                  navigate('/team-tournament');
                }}
                style={{
                  marginLeft: '20px',
                  padding: '8px 16px',
                  backgroundColor: '#71bbe9',
                  color: '#1b1835',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                ← Back to Tournament
              </button>
            )}
          </div>

          <div className="game-main-layout">
            <div className={`board-section ${connectionState !== 'open' ? 'disconnected' : ''}`}>
              {connectionState !== 'open' && (
                <div className="connection-overlay">
                  <div className="connection-overlay-content">
                    <span className="status-icon">🎮</span>
                    <span className="status-text">
                      {connectionState === 'connecting' && 'Connecting to game...'}
                      {connectionState === 'reconnecting' && 'Reconnecting game...'}
                      {connectionState === 'closed' && 'Game connection closed'}
                      {connectionState === 'closing' && 'Game connection closing...'}
                    </span>
                    {(connectionState === 'reconnecting' || connectionState === 'closed') && (
                      <button onClick={reconnect} className="reconnect-button">
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Start Game Button */}
              {showStartButton && connectionState === 'open' && gameState.gameStatus === 'waiting' && (
                <div className="start-game-overlay">
                  <button 
                    className="start-game-button"
                    onClick={handleStartGame}
                  >
                    Start Game
                  </button>
                </div>
              )}

              <GameBoard
                gameState={gameState}
                hasBoardBeenShown={hasBoardBeenShown}
                previousBoard={previousBoard}
                timerState={timerState}
                onWordSubmit={(word: string) => {
                  const result = handleWordSubmit(word);
                  return result === undefined ? undefined : '';
                }}
                wordsFound={wordsFound}
                boardWords={gameState.boardWords as string[] | undefined}
                wordCounts={wordCounts}
                wordCountMax={wordCountMax}
                onShowScores={() => setIsScoresModalOpen(true)}
                onRecordSwipeLetter={gameRecording.recordSwipeLetter}
                onRecordSwipeWord={gameRecording.recordSwipeWord}
                onRecordKeyboardWord={gameRecording.recordKeyboardWord}
                onRecordBoardRotation={gameRecording.recordBoardRotation}
              />
            </div>

          </div>

          <WordLists
            wordsByLength={gameState.wordsByLength || wordsByLength}
            wordsFound={wordsFound}
            gameStatus={gameState.gameStatus}
            hasFinalScores={!!gameState.finalScores}
            boojum={gameState.boojum}
            snark={gameState.snark}
          />
        </div>
      )}

      {!gameState && connectionState === 'open' && (
        <div className="loading-state">Loading game state...</div>
      )}

      <ScoresModal
        isOpen={isScoresModalOpen}
        onClose={() => setIsScoresModalOpen(false)}
        finalScores={gameState?.finalScores || null}
        totalPoints={gameState?.totalPoints}
        isOneShot={gameState?.oneShot || false}
      />
    </div>
  );
}

