import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWordTracking } from '../game-room/services/useWordTracking';
import { useGameWebSocket } from '../game-room/services/useGameWebSocket';
import { GameBoard } from '../game-room/components/GameBoard';
import { WordLists } from '../game-room/components/WordLists';
import { ScoresModal } from '../game-room/components/ScoresModal';
import { toast } from 'react-toastify';
import '../game-room/GameRoom.css';

export default function OpenPlayGameRoom() {
  const { openPlayId } = useParams<{ openPlayId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const token = localStorage.getItem('access_token') || '';

  useEffect(() => {
    if (!user || !token) {
      navigate('/login');
    }
  }, [user, token, navigate]);

  const [showStartButton, setShowStartButton] = useState(true);
  const [showBackButton, setShowBackButton] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const wordTrackingRef = useRef<{
    initializeWordLists: (wordsByLength: Record<string, string[]>) => void;
  } | null>(null);

  const wsUrl = useMemo(() => {
    if (!openPlayId) return '';
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    const djangoBaseUrl = apiBaseUrl.replace('/api', '');
    const wsBaseUrlEnv = import.meta.env.VITE_WS_BASE_URL;
    const wsBaseUrl = wsBaseUrlEnv
      ? wsBaseUrlEnv.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
      : djangoBaseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${wsBaseUrl}/ws/openplay/play/${openPlayId}/`;
  }, [openPlayId]);

  const {
    connectionState,
    gameState,
    timerState,
    hasBoardBeenShown,
    previousBoard,
    reconnect,
    resetState,
    sendJson,
  } = useGameWebSocket({
    roomId: openPlayId,
    token,
    isGuest: false,
    wsUrl,
    initializeWordLists: (wordsByLength) => {
      wordTrackingRef.current?.initializeWordLists(wordsByLength);
    },
    onScoreInChat: () => {},
    onMessage: (message) => {
      if (message.type === 'SHOW_BACK_BUTTON') {
        setShowBackButton(true);
      }
      if (message.type === 'ERROR') {
        toast.error(message.message || 'An error occurred');
        if (message.code === 'ALREADY_PLAYED' || message.code === 'AUTH_REQUIRED') {
          setTimeout(() => navigate('/open-play'), 2000);
        }
      }
    },
  });

  const {
    wordsFound,
    handleWordSubmit,
    initializeWordLists,
    wordCounts,
    wordCountMax,
    wordsByLength,
    submitFinalScore,
  } = useWordTracking(gameState);

  const handleWordSubmitForBoard = useCallback(
    (word: string): string | void => {
      handleWordSubmit(word);
    },
    [handleWordSubmit]
  );

  const handleStartGame = useCallback(() => {
    if (sendJson && !gameStarted) {
      sendJson({ type: 'START_GAME' });
      setShowStartButton(false);
      setGameStarted(true);
    }
  }, [sendJson, gameStarted]);

  const [isScoresModalOpen, setIsScoresModalOpen] = useState(false);
  const prevGameStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentStatus = gameState?.gameStatus;
    const prevStatus = prevGameStatusRef.current;
    if (prevStatus === 'playing' && currentStatus === 'finished' && sendJson) {
      submitFinalScore(sendJson);
    }
    prevGameStatusRef.current = currentStatus;
  }, [gameState?.gameStatus, submitFinalScore, sendJson]);

  useEffect(() => {
    wordTrackingRef.current = { initializeWordLists };
  }, [initializeWordLists]);

  useEffect(() => {
    if (gameState?.finalScores && gameState.gameStatus === 'finished') {
      setIsScoresModalOpen(true);
      setShowBackButton(true);
    }
  }, [gameState?.finalScores, gameState?.gameStatus]);

  useEffect(() => {
    if (gameState?.gameStatus === 'playing') {
      setShowStartButton(false);
      setGameStarted(true);
    } else if (gameState?.gameStatus === 'waiting' && !gameStarted) {
      setShowStartButton(true);
    }
  }, [gameState?.gameStatus, gameStarted]);

  useEffect(() => {
    if (openPlayId) {
      const timeoutId = setTimeout(() => {
        resetState();
        setIsScoresModalOpen(false);
        setShowStartButton(true);
        setShowBackButton(false);
        setGameStarted(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [openPlayId, resetState]);

  if (!openPlayId) {
    return <div className="game-room-error">Invalid board ID</div>;
  }

  if (!user || !token) {
    return <div className="loading-state">Redirecting to login...</div>;
  }

  return (
    <div className="game-room">
      {gameState && (
        <div className="game-content">
          <div className="game-header">
            {showBackButton && (
              <div className="pagination-left-container">
                <button
                  className="pagination-btn"
                  onClick={() => navigate(`/open-play?board=${openPlayId}`)}
                  aria-label="Back to Open Play"
                />
                <span className="pagination-text">Back to Open Play</span>
              </div>
            )}
            <h1 className="daily-board-game-title">Open Play</h1>
          </div>

          <div className="game-main-layout">
            <div className={`board-section ${connectionState !== 'open' ? 'disconnected' : ''}`}>
              {connectionState !== 'open' && (
                <div className="connection-overlay">
                  <div className="connection-overlay-content">
                    <span className="status-text">
                      {connectionState === 'connecting' && 'Connecting to game...'}
                      {connectionState === 'reconnecting' && 'Reconnecting game...'}
                      {connectionState === 'closed' && 'Game connection closed'}
                    </span>
                    {(connectionState === 'reconnecting' || connectionState === 'closed') && (
                      <button onClick={reconnect} className="reconnect-button" type="button">
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              )}

              {showStartButton && connectionState === 'open' && gameState.gameStatus === 'waiting' && (
                <div className="start-game-overlay">
                  <button className="start-game-button" onClick={handleStartGame} type="button">
                    Start Game
                  </button>
                </div>
              )}

              <GameBoard
                gameState={gameState}
                hasBoardBeenShown={hasBoardBeenShown}
                previousBoard={previousBoard}
                timerState={timerState}
                onWordSubmit={handleWordSubmitForBoard}
                wordsFound={wordsFound}
                boardWords={gameState.boardWords as string[] | undefined}
                onShowScores={() => setIsScoresModalOpen(true)}
                wordCounts={wordCounts}
                wordCountMax={wordCountMax}
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
            language={gameState.language}
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
        isOneShot={false}
        openPlayBoardId={openPlayId ? parseInt(openPlayId, 10) : undefined}
      />
    </div>
  );
}
