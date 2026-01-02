import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWordTracking } from '../game-room/services/useWordTracking';
import { useGameWebSocket } from '../game-room/services/useGameWebSocket';
import { GameBoard } from '../game-room/components/GameBoard';
import { WordLists } from '../game-room/components/WordLists';
import { ScoresModal } from '../game-room/components/ScoresModal';
// WordData unused here
import { toast } from 'react-toastify';
import { lobbyAPI } from '../../services/api';
import '../game-room/GameRoom.css';

export default function DailyBoardGameRoom() {
  const { dailyBoardId } = useParams<{ dailyBoardId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fromArchive = searchParams.get('from_archive') === 'true';

  const token = localStorage.getItem('access_token') || '';
  const isGuest = !user || !token;

  // ✅ Single source of truth for guest name
  const [guestName, setGuestName] = useState<string>('');
  const [showStartButton, setShowStartButton] = useState(true);
  const [showBackButton, setShowBackButton] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [boardTitle, setBoardTitle] = useState<string>('Daily Board');

  useEffect(() => {
    if (!isGuest) {
      setGuestName('');
      return;
    }

    const existing = localStorage.getItem('guest_name');
    if (existing) {
      setGuestName(existing);
      return;
    }

    const name = `Guest_${
      crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(16).slice(2, 10)
    }`;

    localStorage.setItem('guest_name', name);
    setGuestName(name);
  }, [isGuest]);

  // Fetch board title
  useEffect(() => {
    const fetchBoardTitle = async () => {
      if (!dailyBoardId) return;
      
      try {
        const data = await lobbyAPI.getDailyBoards();
        const boardsData = data.boards || [];
        const board = boardsData.find((b: { id: number }) => b.id === parseInt(dailyBoardId, 10));
        if (board?.title) {
          setBoardTitle(board.title);
        }
      } catch (error) {
        console.error('Error fetching board title:', error);
      }
    };

    fetchBoardTitle();
  }, [dailyBoardId]);

  // (Optional) this helps you avoid connecting before guestName exists
  const guestReady = !isGuest || !!guestName;

  // Word tracking ref (WS can call into it)
  const wordTrackingRef = useRef<{
    initializeWordLists: (wordsByLength: Record<string, string[]>) => void;
  } | null>(null);

  // Custom WebSocket URL for daily boards
  const wsUrl = useMemo(() => {
    if (!dailyBoardId) return '';
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    const djangoBaseUrl = apiBaseUrl.replace('/api', '');
    // Convert VITE_WS_BASE_URL from https:// to wss:// if set, otherwise use fallback
    const wsBaseUrlEnv = import.meta.env.VITE_WS_BASE_URL;
    const wsBaseUrl = wsBaseUrlEnv
      ? wsBaseUrlEnv.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
      : djangoBaseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    // Include from_archive parameter if present - WebSocket query strings go after the path
    const queryString = fromArchive ? '?from_archive=true' : '';
    return `${wsBaseUrl}/ws/dailyboard/play/${dailyBoardId}/${queryString}`;
  }, [dailyBoardId, fromArchive]);
  
  // Debug: log the WebSocket URL
  useEffect(() => {
    if (wsUrl) {
      console.log('[DailyBoardGameRoom] WebSocket URL:', wsUrl);
    }
  }, [wsUrl]);

  // GAME WS - using custom URL for daily boards
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
    roomId: dailyBoardId,
    token,
    isGuest,
    wsUrl: wsUrl, // Pass custom WebSocket URL
    initializeWordLists: (wordsByLength) => {
      wordTrackingRef.current?.initializeWordLists(wordsByLength);
    },
    onScoreInChat: (_playerName, _score) => {
      // Daily boards don't have chat, so we don't need to handle score messages in chat
    },
    onMessage: (message) => {
      // Handle show_back_button event
      if (message.type === 'SHOW_BACK_BUTTON') {
        setShowBackButton(true);
      }
      // Handle ERROR messages
      if (message.type === 'ERROR') {
        toast.error(message.message || 'An error occurred');
        // If it's an "already played" or "access denied" error, navigate back
        if (message.code === 'ALREADY_PLAYED' || message.code === 'ACCESS_DENIED') {
          setTimeout(() => {
            navigate('/daily-boards');
          }, 2000); // Give user time to read the message
        }
      }
    },
  });

  // Daily boards don't have chat - no chat WebSocket needed

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

  // Open scores modal when final scores are received and show back button
  useEffect(() => {
    if (gameState?.finalScores && gameState.gameStatus === 'finished') {
      setIsScoresModalOpen(true);
      setShowBackButton(true); // Show back button when game finishes
      
    }
  }, [gameState?.finalScores, gameState?.gameStatus]);

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
    if (dailyBoardId) {
      const timeoutId = setTimeout(() => {
        resetState();
        setIsScoresModalOpen(false);
        setShowStartButton(true);
        setShowBackButton(false);
        setGameStarted(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [dailyBoardId, resetState]);

  if (!dailyBoardId) {
    return <div className="game-room-error">Invalid daily board ID</div>;
  }

  // ✅ If guest, wait until guestName exists before rendering the WS-driven UI
  if (!guestReady) {
    return <div className="loading-state">Preparing guest session...</div>;
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
                    // Navigate back to archive detail page if accessed from archive, otherwise to daily boards page
                    if (dailyBoardId) {
                      if (fromArchive) {
                        navigate(`/daily-boards/archive/${dailyBoardId}`);
                      } else {
                        navigate(`/daily-boards?board=${dailyBoardId}`);
                      }
                    } else {
                      navigate(fromArchive ? '/daily-boards/archive' : '/daily-boards');
                    }
                  }}
                  aria-label={fromArchive ? "Back to Archive" : "Back to Everyday Boards"}
                >
                </button>
                <span className="pagination-text">{fromArchive ? "Back to Archive" : "Back to Everyday Boards"}</span>
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

