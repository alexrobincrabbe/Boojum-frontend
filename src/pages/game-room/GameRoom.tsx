import { useRef, useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useWordTracking } from "./services/useWordTracking";
import { useGameWebSocket } from "./services/useGameWebSocket";
import type { GameState } from "../../ws/protocol";
import type { OutboundMessage } from "../../ws/protocol";
import { useChatWebSocket } from "./services/useChatWebSocket";
import { GameBoard } from "./components/GameBoard";
import { WordLists } from "./components/WordLists";
import { PlayersList } from "./components/PlayersList";
import { Chat } from "./components/Chat";
import { ScoresModal } from "./components/ScoresModal";
import { useRoomColor } from "./hooks/useRoomColor";
import { useGuestName } from "./hooks/useGuestName";
import { useGameScoreSubmission } from "./hooks/useGameScoreSubmission";
import { useWordTrackingRef } from "./hooks/useWordTrackingRef";
import { useScoresModal } from "./hooks/useScoresModal";
import { useRoomReset } from "./hooks/useRoomReset";
import { GameInstructionsModal } from "./components/GameInstructionsModal";
import { SavedBoardInfoModal } from "./components/SavedBoardInfoModal";
import {
  useWordSubmitWithConfirmation,
  useOneShotConfirmed,
} from "./hooks/useWordSubmitWithConfirmation";
import { lobbyAPI } from "../../services/api";
import { toast } from "react-toastify";
import { playSound } from "../../utils/sounds";
import "./GameRoom.css";

export default function GameRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const token = localStorage.getItem("access_token") || "";
  const isGuest = !user || !token;
  const roomColor = useRoomColor(roomId);
  const [guestName, guestReady] = useGuestName(isGuest);

  // Word tracking ref (WS can call into it)
  const wordTrackingRef = useRef<{
    initializeWordLists: (wordsByLength: Record<string, string[]>, gameState?: GameState | null, sendJson?: (message: OutboundMessage) => void) => void;
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
    userList: _chatUserList,
  } = useChatWebSocket({
    roomId: roomId || "",
    token,
    isGuest,
    guestName,
    showAdminTraces: Boolean(user?.is_superuser),
  });

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
  const handleWordSubmitWithConfirmation = useWordSubmitWithConfirmation(
    gameState,
    wordsFound,
    oneShotSubmitted,
    handleWordSubmit
  );
  const handleOneShotConfirmed = useOneShotConfirmed(
    gameState,
    timerState,
    submitOneShotWord,
    sendJson
  );
  const [isScoresModalOpen, setIsScoresModalOpen] = useState(false);
  const [remainingSaves, setRemainingSaves] = useState<number>(10);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
  const [isSavedBoardInfoModalOpen, setIsSavedBoardInfoModalOpen] = useState(false);
  const [isSavingBoard, setIsSavingBoard] = useState(false);
  const [lastExpandedMessageCount, setLastExpandedMessageCount] = useState(0);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevGameStatusRef = useRef<"waiting" | "playing" | "finished" | undefined>(undefined);
  const lastBleepSecondRef = useRef<number | null>(null);

  // Play ping sound when game round starts
  useEffect(() => {
    const currentStatus = gameState?.gameStatus;
    const prevStatus = prevGameStatusRef.current;

    // Play ping when status changes to "playing" from "waiting" or "finished"
    if (currentStatus === "playing" && (prevStatus === "waiting" || prevStatus === "finished")) {
      playSound("roundStart"); // Using "round-start.mp3" for round start sound
    }

    prevGameStatusRef.current = currentStatus;
  }, [gameState?.gameStatus]);

  // Play bleep sound for last 3 seconds of intermission
  useEffect(() => {
    const currentStatus = gameState?.gameStatus;
    const displayTime = timerState?.displayTime;

    // Only play during intermission (waiting status)
    if (currentStatus === "waiting" && displayTime !== null && displayTime !== undefined) {
      const timeRemaining = Math.ceil(displayTime);
      
      // Play bleep for last 3 seconds (3, 2, 1)
      if (timeRemaining <= 3 && timeRemaining >= 1) {
        // Only play once per second
        if (lastBleepSecondRef.current !== timeRemaining) {
          playSound("blip"); // Using "blip.mp3" for bleep sound
          lastBleepSecondRef.current = timeRemaining;
        }
      } else if (timeRemaining > 3) {
        // Reset the ref when we're past the 3-second mark
        lastBleepSecondRef.current = null;
      }
    } else if (currentStatus !== "waiting") {
      // Reset the ref when we're no longer in waiting status
      lastBleepSecondRef.current = null;
    }
  }, [gameState?.gameStatus, timerState?.displayTime]);

  // Fetch remaining saves count
  useEffect(() => {
    if (user && gameState?.finalScores) {
      const fetchRemainingSaves = async () => {
        try {
          const data = await lobbyAPI.getSavedBoards();
          setRemainingSaves(data.remaining_saves || 10);
        } catch (error) {
          console.error('Error fetching remaining saves:', error);
        }
      };
      fetchRemainingSaves();
    }
  }, [user, gameState?.finalScores]);

  const handleSaveBoard = useCallback(async () => {
    if (!gameState || !user || !roomId || isSavingBoard) return;
    
    const currentPlayerId = gameState.currentPlayerId;
    if (!currentPlayerId || !gameState.finalScores) {
      toast.error('Unable to save board - game not finished');
      return;
    }

    const playerScore = gameState.finalScores[currentPlayerId];
    if (!playerScore) {
      toast.error('Unable to save board - score not found');
      return;
    }

    if (!gameState.board || !gameState.boardWords || !gameState.boojumBonus) {
      toast.error('Unable to save board - board data missing');
      return;
    }

    setIsSavingBoard(true);

    // Get timer - prioritize gameTime from gameState (actual game timer used)
    // gameTime is the actual game timer, not the intermission timer
    // gameState.initialTimer might be the intermission timer (10s) if game status is 'finished'
    let timer = 90; // default
    if (gameState.gameTime && gameState.gameTime > 0) {
      // gameTime is the actual game timer used - this is the most reliable source
      timer = gameState.gameTime;
    } else {
      // Fallback to room API if gameTime not available
      try {
        const lobbyData = await lobbyAPI.getLobbyData();
        const room = lobbyData.rooms?.find((r: any) => r.room_slug === roomId);
        if (room?.timer) {
          timer = room.timer;
        }
      } catch (error) {
        console.error('Error fetching room timer:', error);
      }
    }
    const oneShot = gameState.oneShot || false;

    try {
      const response = await lobbyAPI.saveBoard({
        board_letters: gameState.board,
        board_words: gameState.boardWords,
        bonus_letters: gameState.boojumBonus,
        room_slug: roomId, // roomId is the room slug
        score: typeof playerScore.final_score === 'number' ? playerScore.final_score : 0,
        timer: timer,
        one_shot: oneShot,
        best_word: playerScore.best_word?.word || '',
        best_word_score: playerScore.best_word?.score || 0,
        number_of_words_found: typeof playerScore.number_of_words_found === 'number' ? playerScore.number_of_words_found : 0,
        time: typeof playerScore.time === 'number' ? playerScore.time : 0,
      });
      
      toast.success('Board saved successfully!');
      setRemainingSaves(response.remaining_saves || 0);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to save board';
      toast.error(errorMessage);
    } finally {
      setIsSavingBoard(false);
    }
  }, [gameState, user, roomId, timerState, isSavingBoard]);

  useGameScoreSubmission(
    gameState,
    submitFinalScore,
    sendJson,
    setIsScoresModalOpen,
    connectionState
  );
  useWordTrackingRef(wordTrackingRef, initializeWordLists);
  useScoresModal(gameState, setIsScoresModalOpen, addChatSystemMessage);
  useRoomReset(roomId, resetState, setIsScoresModalOpen);

  // Initialize message count on mount
  useEffect(() => {
    if (lastExpandedMessageCount === 0 && chatMessages.length > 0) {
      setLastExpandedMessageCount(chatMessages.length);
    }
  }, [chatMessages.length, lastExpandedMessageCount]);

  // Track new messages when chat is collapsed
  useEffect(() => {
    if (!isChatExpanded && chatMessages.length > lastExpandedMessageCount) {
      setHasNewMessages(true);
    }
  }, [chatMessages.length, isChatExpanded, lastExpandedMessageCount]);

  // Reset new messages indicator when chat is expanded
  useEffect(() => {
    if (isChatExpanded) {
      setLastExpandedMessageCount(chatMessages.length);
      setHasNewMessages(false);
    }
  }, [isChatExpanded, chatMessages.length]);

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
          <PlayersList
            players={gameState.players ?? []}
            variant="mobile"
            roomId={gameState.roomId}
            roomColor={roomColor}
          />

          <div className="game-main-layout">
            <PlayersList
              players={gameState.players ?? []}
              variant="desktop"
              roomId={gameState.roomId}
              roomColor={roomColor}
            />

            <div
              className={`board-section ${
                connectionState !== "open" ? "disconnected" : ""
              }`}
            >
              {connectionState !== "open" && (
                <div className="connection-overlay">
                  <div className="connection-overlay-content">
                    <span className="status-icon">🎮</span>
                    <span className="status-text">
                      {connectionState === "connecting" &&
                        "Connecting to game..."}
                      {connectionState === "reconnecting" &&
                        "Reconnecting game..."}
                      {connectionState === "closed" && "Game connection closed"}
                      {connectionState === "closing" &&
                        "Game connection closing..."}
                    </span>
                    {(connectionState === "reconnecting" ||
                      connectionState === "closed") && (
                      <button onClick={reconnect} className="reconnect-button">
                        Retry
                      </button>
                    )}
                  </div>
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
                onSaveBoard={!isGuest ? handleSaveBoard : undefined}
                remainingSaves={!isGuest ? remainingSaves : undefined}
                isSavingBoard={!isGuest ? isSavingBoard : false}
                oneShotSubmitted={oneShotSubmitted}
                onOneShotConfirmed={handleOneShotConfirmed}
                wordCounts={wordCounts}
                wordCountMax={wordCountMax}
              />
            </div>

            <div className="chat-desktop">
              <Chat
                messages={chatMessages}
                connectionState={chatConnectionState}
                onSendMessage={sendChatMessage}
                onReconnect={reconnectChat}
                showTraceLinks={Boolean(user?.is_superuser)}
              />
            </div>
          </div>

          <div className="chat-mobile">
            {!isChatExpanded && (
              <button
                className={`chat-mobile-toggle ${hasNewMessages ? 'has-new-messages' : ''}`}
                onClick={() => setIsChatExpanded(!isChatExpanded)}
                aria-label="Expand chat"
              >
                <span className="chat-toggle-text">Chat</span>
                {hasNewMessages && <span className="chat-new-messages-indicator">●</span>}
                <span className="chat-toggle-icon">▼</span>
              </button>
            )}
            {isChatExpanded && (
              <div className="chat-mobile-expanded">
                <Chat
                  messages={chatMessages}
                  connectionState={chatConnectionState}
                  onSendMessage={sendChatMessage}
                  onReconnect={reconnectChat}
                  showTraceLinks={Boolean(user?.is_superuser)}
                />
                <button
                  className={`chat-mobile-toggle chat-mobile-toggle-bottom ${hasNewMessages ? 'has-new-messages' : ''}`}
                  onClick={() => setIsChatExpanded(!isChatExpanded)}
                  aria-label="Collapse chat"
                >
                  <span className="chat-toggle-text">Chat</span>
                  {hasNewMessages && <span className="chat-new-messages-indicator">●</span>}
                  <span className="chat-toggle-icon">▲</span>
                </button>
              </div>
            )}
          </div>

          <WordLists
            wordsByLength={gameState.wordsByLength || wordsByLength}
            wordsFound={wordsFound}
            gameStatus={gameState.gameStatus}
            hasFinalScores={!!gameState.finalScores}
            boojum={gameState.boojum}
            snark={gameState.snark}
            language={gameState.language || 'en'}
            isLiveGameRoom={true}
          />
        </div>
      )}

      {!gameState && connectionState === "open" && (
        <div className="loading-state">Loading game state...</div>
      )}

      <ScoresModal
        isOpen={isScoresModalOpen}
        onClose={() => setIsScoresModalOpen(false)}
        finalScores={gameState?.finalScores || null}
        totalPoints={gameState?.totalPoints}
        isOneShot={gameState?.oneShot || false}
      />
      {gameState?.finalScores &&
        (gameState?.gameStatus === "finished" ||
          gameState?.gameStatus === "waiting") &&
        !isGuest && handleSaveBoard && remainingSaves !== undefined && (
          <div className="save-board-button-container">
            <button
              className="save-board-button-fixed"
              onClick={handleSaveBoard}
              disabled={remainingSaves === 0 || isSavingBoard}
              aria-label="Save board"
            >
              {isSavingBoard ? 'Saving...' : `Save board (${remainingSaves})`}
            </button>
            <button
              className="save-board-info-link"
              onClick={() => setIsSavedBoardInfoModalOpen(true)}
              aria-label="What is this?"
            >
              what is this?
            </button>
          </div>
        )}
      <button
        className="game-instructions-button-fixed"
        onClick={() => setIsInstructionsModalOpen(true)}
        aria-label="How to play"
      >
        How to Play
      </button>
      <GameInstructionsModal
        isOpen={isInstructionsModalOpen}
        onClose={() => setIsInstructionsModalOpen(false)}
      />
      <SavedBoardInfoModal
        isOpen={isSavedBoardInfoModalOpen}
        onClose={() => setIsSavedBoardInfoModalOpen(false)}
      />
    </div>
  );
}
