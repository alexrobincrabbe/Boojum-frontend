import { useRef, useState } from "react";
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
