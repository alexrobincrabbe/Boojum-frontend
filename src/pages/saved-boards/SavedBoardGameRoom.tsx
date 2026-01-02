import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWordTracking } from '../game-room/services/useWordTracking';
import { useGameWebSocket } from '../game-room/services/useGameWebSocket';
import { GameBoard } from '../game-room/components/GameBoard';
import { WordCounters } from '../game-room/components/WordCounters';
import { WordLists } from '../game-room/components/WordLists';
import { ScoresModal } from '../game-room/components/ScoresModal';
import { toast } from 'react-toastify';
import { lobbyAPI } from '../../services/api';
import '../game-room/GameRoom.css';

export default function SavedBoardGameRoom() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const token = localStorage.getItem('access_token') || '';
  const isGuest = !user || !token;

  const [showStartButton, setShowStartButton] = useState(true);
  const [showBackButton, setShowBackButton] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [boardTitle, setBoardTitle] = useState<string>('Saved Board');

  // Fetch board data
  useEffect(() => {
    const fetchBoardData = async () => {
      if (!boardId) return;
      
      try {
        const data = await lobbyAPI.getSavedBoardGame(parseInt(boardId, 10));
        setBoardTitle(`Saved Board - ${data.room_type}`);
      } catch (error: any) {
        console.error('Error fetching saved board data:', error);
        toast.error(error.response?.data?.error || 'Failed to load saved board');
        // Navigate back to dashboard after a delay
        setTimeout(() => {
          navigate('/dashboard?saved-boards');
        }, 2000);
      }
    };

    fetchBoardData();
  }, [boardId, navigate]);

  // Word tracking ref (WS can call into it)
  const wordTrackingRef = useRef<{
    initializeWordLists: (wordsByLength: Record<string, string[]>) => void;
  } | null>(null);

  // Custom WebSocket URL for saved boards
  const wsUrl = useMemo(() => {
    if (!boardId) return '';
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    const djangoBaseUrl = apiBaseUrl.replace('/api', '');
    // Convert VITE_WS_BASE_URL from https:// to wss:// if set, otherwise use fallback
    const wsBaseUrlEnv = import.meta.env.VITE_WS_BASE_URL;
    const wsBaseUrl = wsBaseUrlEnv
      ? wsBaseUrlEnv.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
      : djangoBaseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${wsBaseUrl}/ws/saved-board/play/${boardId}/`;
  }, [boardId]);

  // GAME WS - using custom URL for saved boards
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
    roomId: boardId,
    token,
    isGuest,
    wsUrl: wsUrl, // Pass custom WebSocket URL
    initializeWordLists: (wordsByLength) => {
      wordTrackingRef.current?.initializeWordLists(wordsByLength);
    },
    onScoreInChat: (_playerName, _score) => {
      // Saved boards don't have chat, so we don't need to handle score messages in chat
    },
    onMessage: (message) => {
      // Handle show_back_button event
      if (message.type === 'SHOW_BACK_BUTTON') {
        setShowBackButton(true);
      }
      // Handle ERROR messages
      if (message.type === 'ERROR') {
        toast.error(message.message || 'An error occurred');
      }
    },
  });

  // Word tracking (depends on gameState)
  const {
    wordsFound,
    handleWordSubmit,
    initializeWordLists,
    wordCounts,
    wordCountMax,
    wordsByLength,
    submitFinalScore,
    submitOneShotWord,
    oneShotSubmitted,
  } = useWordTracking(gameState);

  // Wrapper for word submission that handles one-shot confirmation
  const handleWordSubmitWithConfirmation = useCallback((word: string): string | void => {
    if (!word || gameState?.gameStatus !== 'playing') return;
    
    // Check if word is valid
    const isValidWord = gameState.boardWords?.includes(word) || false;
    if (!isValidWord) return;
    
    // Check if already found
    const wordLower = word.toLowerCase();
    if (wordsFound.has(wordLower)) return;
    
    // For one-shot games, show confirmation dialog
    if (gameState.oneShot && !oneShotSubmitted) {
      return word; // Return word to trigger confirmation in GameBoard
    }
    
    // Normal game - submit word directly
    handleWordSubmit(word);
  }, [gameState, wordsFound, oneShotSubmitted, handleWordSubmit]);

  // Handle confirmed one-shot word submission
  const handleOneShotConfirmed = useCallback((word: string) => {
    if (!gameState || !timerState.displayTime || !timerState.initialTimer) return;
    
    // Calculate time: initialTimer - currentTime (in seconds)
    const time = Math.max(0, timerState.initialTimer - timerState.displayTime);
    
    submitOneShotWord(word, time, sendJson);
  }, [gameState, timerState, submitOneShotWord, sendJson]);

  // Handle start game button
  const handleStartGame = useCallback(() => {
    if (sendJson && !gameStarted) {
      sendJson({ type: 'START_GAME' });
      setShowStartButton(false);
      setGameStarted(true);
    }
  }, [sendJson, gameStarted]);

  // Scores modal state
  const [isScoresModalOpen, setIsScoresModalOpen] = useState(false);

  // Submit final score when game ends
  const prevGameStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentStatus = gameState?.gameStatus;
    const prevStatus = prevGameStatusRef.current;
    
    // Submit score when game status changes from 'playing' to 'finished'
    if (prevStatus === 'playing' && currentStatus === 'finished' && sendJson) {
      console.log('[Score] Game ended, submitting score');
      submitFinalScore(sendJson);
    }
    
    prevGameStatusRef.current = currentStatus;
  }, [gameState?.gameStatus, gameState?.finalScores, submitFinalScore, sendJson]);

  useEffect(() => {
    wordTrackingRef.current = {
      initializeWordLists,
    };
  }, [initializeWordLists]);

  // Open scores modal when game ends (for saved boards, the modal will fetch saved board scores)
  // Don't wait for finalScores - just open when game status is finished
  useEffect(() => {
    if (gameState?.gameStatus === 'finished' && boardId) {
      setIsScoresModalOpen(true);
      setShowBackButton(true); // Show back button when game finishes
    }
  }, [gameState?.gameStatus, boardId]);

  // Hide start button if game is already playing (e.g., on reconnect)
  useEffect(() => {
    if (gameState?.gameStatus === 'playing') {
      setShowStartButton(false);
      setGameStarted(true);
    } else if (gameState?.gameStatus === 'waiting' && !gameStarted) {
      // Only show start button if game is waiting and hasn't been started yet
      setShowStartButton(true);
    }
  }, [gameState?.gameStatus, gameStarted]);

  // Reset state when navigating to a different board
  useEffect(() => {
    if (boardId) {
      const timeoutId = setTimeout(() => {
        resetState();
        setIsScoresModalOpen(false);
        setShowStartButton(true);
        setShowBackButton(false);
        setGameStarted(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [boardId, resetState]);

  if (!boardId) {
    return <div className="game-room-error">Invalid saved board ID</div>;
  }

  if (!user) {
    return <div className="game-room-error">You must be logged in to play saved boards</div>;
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
                  onClick={() => {
                    navigate('/dashboard?saved-boards');
                  }}
                  aria-label="Back to Saved Boards"
                >
                </button>
                <span className="pagination-text">Back to Saved Boards</span>
              </div>
            )}
            <h1 className="daily-board-game-title">{boardTitle}</h1>
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

              <div className="word-counters-container">
                <WordCounters
                  wordCounts={wordCounts}
                  wordCountMax={wordCountMax}
                  gameStatus={gameState.gameStatus}
                />
              </div>

              <GameBoard
                gameState={gameState}
                hasBoardBeenShown={hasBoardBeenShown}
                previousBoard={previousBoard}
                timerState={timerState}
                onWordSubmit={handleWordSubmitWithConfirmation}
                wordsFound={wordsFound}
                boardWords={gameState.boardWords as string[] | undefined}
                onShowScores={() => setIsScoresModalOpen(true)}
                oneShotSubmitted={oneShotSubmitted}
                onOneShotConfirmed={handleOneShotConfirmed}
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
        finalScores={null} // Don't pass finalScores for saved boards - only show saved board scores
        totalPoints={gameState?.totalPoints}
        isOneShot={gameState?.oneShot || false}
        savedBoardId={boardId ? parseInt(boardId, 10) : undefined}
      />
    </div>
  );
}

