import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useWordTracking } from './services/useWordTracking';
import { useGameWebSocket } from './services/useGameWebSocket';
import { useChatWebSocket } from './services/useChatWebSocket';
import { lobbyAPI } from '../../services/api';
import { GameBoard } from './components/GameBoard';
import { WordCounters } from './components/WordCounters';
import { WordLists } from './components/WordLists';
import { PlayersList } from './components/PlayersList';
import { Chat } from './components/Chat';
import { ScoresModal } from './components/ScoresModal';
import { fetchDefinition } from '../../utils/dictionary';
import type { WordData } from '../../ws/protocol';
import './GameRoom.css';

export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();

  const token = localStorage.getItem('access_token') || '';
  const isGuest = !user || !token;

  // ✅ Single source of truth for guest name
  const [guestName, setGuestName] = useState<string>('');
  
  // Room color state
  const [roomColor, setRoomColor] = useState<string>('#f5ce45'); // Default to yellow

  // Fetch room color
  useEffect(() => {
    const fetchRoomColor = async () => {
      if (!roomId) return;
      try {
        const data = await lobbyAPI.getLobbyData();
        const room = data.rooms?.find((r: any) => r.room_slug === roomId);
        if (room?.color) {
          setRoomColor(room.color);
        }
      } catch (error) {
        console.error('Error fetching room color:', error);
      }
    };
    fetchRoomColor();
  }, [roomId]);

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

  // (Optional) this helps you avoid connecting before guestName exists
  const guestReady = !isGuest || !!guestName;

  // Word tracking ref (WS can call into it)
  const wordTrackingRef = useRef<{
    initializeWordLists: (wordsByLength: Record<string, string[]>) => void;
    updateWordsFromChat: (message: string, user: string) => void;
  } | null>(null);

  // GAME WS
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
    roomId,
    token,
    isGuest,
    initializeWordLists: (wordsByLength, gameState, sendJson) => {
      wordTrackingRef.current?.initializeWordLists(wordsByLength, gameState, sendJson);
    },
    updateWordsFromChat: (message, user) => {
      wordTrackingRef.current?.updateWordsFromChat(message, user);
    },
    onScoreInChat: (playerName, score) => {
      // Format: "player got x points" in blue italics (system message, no username)
      const scoreMessage = `<em style="color:#71bbe9;font-style:italic;">${playerName} got ${score} points</em>`;
      addChatSystemMessage(scoreMessage);
    },
  });

  // CHAT WS
  const {
    messages: chatMessages,
    connectionState: chatConnectionState,
    sendMessage: sendChatMessage,
    reconnect: reconnectChat,
    addSystemMessage: addChatSystemMessage,
  } = useChatWebSocket({
    roomId: roomId || '',
    token,
    isGuest,
    guestName, // ✅ pass it in
  });

  // Update words from chat messages (for word tracking)
  useEffect(() => {
    chatMessages.forEach((msg) => {
      if (msg.messageType === 'chat_message' && msg.user && msg.message) {
        wordTrackingRef.current?.updateWordsFromChat(msg.message, msg.user);
      }
    });
  }, [chatMessages]);

  // Word tracking (depends on gameState)
  const {
    wordsFound,
    handleWordSubmit,
    initializeWordLists,
    updateWordsFromChat,
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

  // Scores modal state
  const [isScoresModalOpen, setIsScoresModalOpen] = useState(false);

  // Submit final score when game ends (when status changes from 'playing' to 'finished')
  const prevGameStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentStatus = gameState?.gameStatus;
    const prevStatus = prevGameStatusRef.current;
    
    // Submit score when game status changes from 'playing' to 'finished'
    if (prevStatus === 'playing' && currentStatus === 'finished' && sendJson) {
      console.log('[Score] Game ended, submitting score');
      submitFinalScore(sendJson);
    }
    
    // Close scores modal when next game starts (status changes to 'playing' after interval)
    if ((prevStatus === 'finished' || prevStatus === 'waiting') && currentStatus === 'playing') {
      setIsScoresModalOpen(false);
    }
    
    prevGameStatusRef.current = currentStatus;
  }, [gameState?.gameStatus, gameState?.finalScores, submitFinalScore, sendJson, setIsScoresModalOpen]);

  useEffect(() => {
    wordTrackingRef.current = {
      initializeWordLists,
      updateWordsFromChat,
    };
  }, [initializeWordLists, updateWordsFromChat]);

  // Open scores modal when final scores are received
  useEffect(() => {
    if (gameState?.finalScores && gameState.gameStatus === 'finished') {
      setIsScoresModalOpen(true);
      
      // Show unicorn message in chat for one-shot games
      if (gameState.oneShot && gameState.wordsByLength) {
        const findHighestScoringWord = (wordsByLength: Record<string, Record<string, WordData>> | Record<string, string[]>) => {
          let highestScore = 0;
          let highestWord = '';
          
          for (const length in wordsByLength) {
            const words = wordsByLength[length];
            if (typeof words === 'object' && !Array.isArray(words)) {
              // Final format with WordData
              for (const word in words) {
                const wordData = words[word] as WordData;
                if (wordData.score && wordData.score > highestScore) {
                  highestScore = wordData.score;
                  highestWord = word;
                }
              }
            }
          }
          
          return [highestWord, highestScore] as [string, number];
        };
        
        const showUnicornInChat = async () => {
          try {
            const [unicorn, score] = findHighestScoringWord(gameState.wordsByLength!);
            if (unicorn) {
              const definition = await fetchDefinition(unicorn);
              const messageContent = `<span class="pink">Unicorn:</span> &nbsp;<span class="green">${unicorn}</span>&nbsp;<span class="yellow">(${score}pts)</span><br><span class="blue">Definition:</span><br><span class="blue">${definition}</span>`;
              // Send as system message (no username prefix)
              addChatSystemMessage(messageContent);
            }
          } catch (err) {
            console.error('Failed to fetch unicorn definition:', err);
          }
        };
        
        showUnicornInChat();
      }
    }
  }, [gameState?.finalScores, gameState?.gameStatus, gameState?.oneShot, gameState?.wordsByLength, addChatSystemMessage]);


  // Reset state when navigating to a different room
  useEffect(() => {
    if (roomId) {
      const timeoutId = setTimeout(() => {
        resetState();
        setIsScoresModalOpen(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [roomId, resetState]);

  if (!roomId) {
    return <div className="game-room-error">Invalid room ID</div>;
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
            <h1 style={{ color: roomColor }}>Room: {gameState.roomId}</h1>
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

            <div className="chat-desktop">
              <Chat
                messages={chatMessages}
                connectionState={chatConnectionState}
                onSendMessage={sendChatMessage}
                onReconnect={reconnectChat}
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

          <div className="chat-mobile">
            <Chat
              messages={chatMessages}
              connectionState={chatConnectionState}
              onSendMessage={sendChatMessage}
              onReconnect={reconnectChat}
            />
          </div>
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
