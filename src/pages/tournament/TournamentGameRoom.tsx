import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWordTracking } from '../game-room/services/useWordTracking';
import { useGameWebSocket } from '../game-room/services/useGameWebSocket';
import { GameBoard } from '../game-room/components/GameBoard';
import { WordCounters } from '../game-room/components/WordCounters';
import { WordLists } from '../game-room/components/WordLists';
import { PlayersList } from '../game-room/components/PlayersList';
import { ScoresModal } from '../game-room/components/ScoresModal';
import { tournamentAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Loading } from '../../components/Loading';
import { useGameRecording } from '../../hooks/useGameRecording';
import type { OutboundMessage } from '../../ws/protocol';
import '../game-room/GameRoom.css';

interface MatchInfo {
  match_id: number;
  player_index: number;
  already_played: boolean;
  slugified_username: string;
  tournament: {
    time_limit: number;
    one_shot: boolean;
    type: string;
  };
  round_pass: boolean;
}

export default function TournamentGameRoom() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
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
    const loadMatchInfo = async () => {
      if (!matchId || isGuest) {
        setError('Match ID is required and you must be logged in');
        setLoading(false);
        return;
      }

      try {
        const info = await tournamentAPI.getMatchInfo(parseInt(matchId));
        setMatchInfo(info);
        
        if (info.already_played) {
          setError('You have already played this match');
          setTimeout(() => {
            navigate('/tournament');
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
  }, [matchId, isGuest, navigate]);

  // Word tracking ref (WS can call into it)
  const wordTrackingRef = useRef<{
    initializeWordLists: (wordsByLength: Record<string, string[]>) => void;
  } | null>(null);

  // Custom WebSocket URL for tournament matches
  const wsUrl = useMemo(() => {
    if (!matchId || !matchInfo || !matchInfo.slugified_username) return '';
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
    const djangoBaseUrl = apiBaseUrl.replace('/api', '');
    const wsBaseUrl = djangoBaseUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
    return `${wsBaseUrl}/ws/tournament/play/${matchId}/${matchInfo.slugified_username}/`;
  }, [matchId, matchInfo]);

  // GAME WS - using custom URL for tournament matches
  // Only connect if we have matchInfo and wsUrl is ready
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
    isGuest: false, // Tournament games require authentication
    wsUrl: wsUrl, // Pass the wsUrl - it will be empty string until matchInfo loads, preventing connection
    initializeWordLists: (wordsByLength) => {
      wordTrackingRef.current?.initializeWordLists(wordsByLength);
    },
    onScoreInChat: () => {
      // Tournament games don't have chat, so we don't need to handle score messages in chat
    },
    onMessage: (message) => {
      // Handle show_back_button event
      if (message.type === 'SHOW_BACK_BUTTON') {
        setShowBackButton(true);
      }
      // Handle redirect event (if already played) - backend sends event_type: 'redirect'
      // This is normalized to ERROR with code 'ALREADY_PLAYED' in useGameSocket
      if (message.type === 'ERROR' && message.code === 'ALREADY_PLAYED') {
        toast.error(message.message || 'You have already played this match');
        setTimeout(() => {
          navigate('/tournament');
        }, 2000);
      }
      // Handle ERROR messages
      if (message.type === 'ERROR') {
        toast.error(message.message || 'An error occurred');
      }
    },
  });

  // Game recording for tournament games
  const gameRecording = useGameRecording();

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
    
    // Record word submit
    gameRecording.recordWordSubmit(word);
    
    // For one-shot games, show confirmation dialog
    if (gameState.oneShot && !oneShotSubmitted) {
      return word; // Return word to trigger confirmation in GameBoard
    }
    
    // Normal game - submit word directly
    handleWordSubmit(word);
  }, [gameState, wordsFound, oneShotSubmitted, handleWordSubmit, gameRecording]);

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
      // sendJson automatically converts START_GAME to event_type: 'start_game'
      sendJson({ type: 'START_GAME' });
      setShowStartButton(false);
      setGameStarted(true);
    }
  }, [sendJson, gameStarted]);

  // Scores modal state
  const [isScoresModalOpen, setIsScoresModalOpen] = useState(false);

  // Start recording when game starts
  useEffect(() => {
    if (gameState?.gameStatus === 'playing' && !gameRecording.isRecording) {
      gameRecording.startRecording();
    }
  }, [gameState?.gameStatus, gameRecording]);

  // Stop recording when game ends
  useEffect(() => {
    if (gameState?.gameStatus === 'finished' && gameRecording.isRecording) {
      gameRecording.stopRecording();
    }
  }, [gameState?.gameStatus, gameRecording]);

  // Submit final score when game ends
  const prevGameStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentStatus = gameState?.gameStatus;
    const prevStatus = prevGameStatusRef.current;
    
    // Submit score when game status changes from 'playing' to 'finished'
    if (prevStatus === 'playing' && currentStatus === 'finished' && sendJson) {
      console.log('[Score] Game ended, submitting score');
      // Get recording data
      const recording = gameRecording.getRecording();
      console.log('[Recording] Game recording:', recording.length, 'events');
      
      // Create a wrapper sendJson that includes recording data
      const sendJsonWithRecording = (message: OutboundMessage) => {
        // If this is a submit_final_score message, add recording data
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

  // Open scores modal when final scores are received and show back button
  useEffect(() => {
    if (gameState?.finalScores && gameState.gameStatus === 'finished') {
      console.log('[TournamentGameRoom] Opening scores modal', { 
        hasFinalScores: !!gameState.finalScores, 
        gameStatus: gameState.gameStatus,
        finalScores: gameState.finalScores 
      });
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

  if (loading) {
    return <Loading minHeight="calc(100vh - 70px)" />;
  }

  if (error || !matchInfo) {
    return (
      <div className="game-room-error">
        {error || 'Failed to load match'}
        <button 
          onClick={() => navigate('/tournament')}
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

  if (matchInfo.already_played) {
    return (
      <div className="game-room-error">
        You have already played this match
        <button 
          onClick={() => navigate('/tournament')}
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
            <h1 style={{ color: '#71bbe9' }}>Tournament Match</h1>
            {showBackButton && (
              <button 
                className="back-button"
                onClick={() => {
                  navigate('/tournament');
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

          <PlayersList players={gameState.players ?? []} variant="mobile" />

          <div className="game-main-layout">
            <PlayersList players={gameState.players ?? []} variant="desktop" />

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

