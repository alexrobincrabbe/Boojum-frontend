import { useRef, useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useWordTracking } from "./services/useWordTracking";
import { useGameWebSocket } from "./services/useGameWebSocket";
import type { GameState } from "../../ws/protocol";
import type { OutboundMessage } from "../../ws/protocol";
import { useChatWebSocket } from "./services/useChatWebSocket";
import { GameBoard } from "./components/GameBoard";
import { WordCounters } from "./components/WordCounters";
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
import {
  useWordSubmitWithConfirmation,
  useOneShotConfirmed,
} from "./hooks/useWordSubmitWithConfirmation";
import { lobbyAPI } from "../../services/api";
import { toast } from "react-toastify";
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
  } = useChatWebSocket({
    roomId: roomId || "",
    token,
    isGuest,
    guestName, // ✅ pass it in
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
  const [isSavingBoard, setIsSavingBoard] = useState(false);

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

    // Get timer from room API to ensure we get the correct game timer (not intermission timer)
    // timerState.initialTimer might be intermission (10s) instead of game_time (e.g., 20s)
    let timer = 90; // default
    try {
      const lobbyData = await lobbyAPI.getLobbyData();
      const room = lobbyData.rooms?.find((r: any) => r.room_slug === roomId);
      if (room?.timer) {
        timer = room.timer;
      }
    } catch (error) {
      console.error('Error fetching room timer:', error);
      // Fallback to timerState if API fails
      timer = timerState?.initialTimer || 90;
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
    setIsScoresModalOpen
  );
  useWordTrackingRef(wordTrackingRef, initializeWordLists);
  useScoresModal(gameState, setIsScoresModalOpen, addChatSystemMessage);
  useRoomReset(roomId, resetState, setIsScoresModalOpen);

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
                onSaveBoard={!isGuest ? handleSaveBoard : undefined}
                remainingSaves={!isGuest ? remainingSaves : undefined}
                isSavingBoard={!isGuest ? isSavingBoard : false}
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
    </div>
  );
}
