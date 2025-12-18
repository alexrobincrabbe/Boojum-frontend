import { useRef, useState, useCallback } from "react";
import type { GameState } from "../../../ws/protocol";
import { useBoardSwipe } from "../../../hooks/useBoardSwipe";
import { useKeyboardInput } from "../../../hooks/useKeyboardInput";
import { ConfirmationDialog } from "./ConfirmationDialog";
import "./GameBoard.css";

interface GameBoardProps {
  gameState: GameState;
  hasBoardBeenShown: boolean;
  previousBoard: string[][] | null;
  timerState?: {
    displayTime: number | null;
    progressBarWidth: number;
    initialTimer: number;
  };
  scoreState?: {
    currentScore: number;
    totalScore: number;
  };
  onWordSubmit: (word: string) => void | string;
  wordsFound: Set<string>;
  boardWords?: string[];
  onShowScores?: () => void;
  oneShotSubmitted?: boolean; // Disable input if word already submitted in one-shot mode
  onOneShotConfirmed?: (word: string) => void; // Callback when one-shot word is confirmed
  colorsOffOverride?: boolean; // Override global colorsOff setting (for timeless boards)
  onExactMatch?: (word: string) => void; // Callback when a word turns green (exact match found)
}

export function GameBoard({
  gameState,
  hasBoardBeenShown,
  previousBoard,
  timerState,
  scoreState,
  onWordSubmit,
  wordsFound,
  boardWords,
  onShowScores,
  oneShotSubmitted = false,
  onOneShotConfirmed,
  colorsOffOverride,
  onExactMatch,
}: GameBoardProps) {
  const [boardRotation, setBoardRotation] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);
  const [confirmationWord, setConfirmationWord] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  const activePointerIdRef = useRef<number | null>(null);
  const isPointerDownRef = useRef(false);

  // Wrapper for onWordSubmit that handles one-shot confirmation
  const handleWordSubmitWrapper = useCallback(
    (word: string) => {
      const result = onWordSubmit(word);

      // If result is a string (word), it means we need to show confirmation for one-shot
      if (
        typeof result === "string" &&
        gameState.oneShot &&
        !oneShotSubmitted
      ) {
        setConfirmationWord(result);
        return;
      }

      // For normal games, onWordSubmit returns void/undefined and the submission is already handled
      // No additional action needed
    },
    [onWordSubmit, gameState?.oneShot, oneShotSubmitted]
  );

  // Handle confirmation dialog
  const handleConfirm = useCallback(() => {
    if (confirmationWord && onOneShotConfirmed) {
      onOneShotConfirmed(confirmationWord);
      setConfirmationWord(null);
    }
  }, [confirmationWord, onOneShotConfirmed]);

  const handleCancel = useCallback(() => {
    setConfirmationWord(null);
  }, []);

  // Board swipe functionality
  const {
    svgContainerRef,
    handleMouseDown,
    finalizeWordSelection,
    handlePointerPosition,
    debugDot,
    debugPath,
  } = useBoardSwipe(
    boardRef,
    gameState?.gameStatus,
    oneShotSubmitted ? () => {} : handleWordSubmitWrapper, // Use wrapper to handle one-shot confirmation
    boardWords,
    wordsFound,
    colorsOffOverride,
    onExactMatch,
    debugMode,
    boardRotation
  );

  // Keyboard input functionality
  const { currentWord: keyboardWord, clearWord: clearKeyboardWord } =
    useKeyboardInput({
      gameStatus: gameState?.gameStatus,
      board: gameState?.board,
      boardWords,
      wordsFound,
      onWordSubmit: oneShotSubmitted ? () => {} : handleWordSubmitWrapper, // Disable if one-shot submitted
    });

  // Clear keyboard word when swipe starts
  const handleMouseDownWithClear = useCallback(
    (e: React.MouseEvent) => {
      clearKeyboardWord();
      handleMouseDown(e);
    },
    [clearKeyboardWord, handleMouseDown]
  );

  // Attach touch event listeners directly to DOM with non-passive option to prevent scrolling
  // This avoids the "Unable to preventDefault inside passive event listener" warning

  return (
    <div className="game-board">
      {/* add somewhere sensible, e.g. near rotate buttons */}
      <div className="debug-toggle">
        <label className="switch">
          <input
            type="checkbox"
            checked={debugMode}
            onChange={() => setDebugMode((v) => !v)}
          />
          <span className="slider" />
        </label>
        <span className="debug-label">Debug</span>
      </div>

      <div className="board-container">
        {/* Rotate Buttons and Timer Bar */}
        <div id="rotate-buttons">
          <button
            id="anti-clockwise-button"
            className="rotate-button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setBoardRotation((prev) => prev - 90);
            }}
            aria-label="Rotate board counter-clockwise"
          >
            &#8634;
          </button>
          <div id="timer-bar-container">
            {scoreState ? (
              <>
                <span
                  id="timer"
                  className="info"
                  data-score={scoreState.currentScore}
                >
                  {scoreState.currentScore}/{scoreState.totalScore} pts
                </span>
                <span
                  id="timer-bar"
                  className={
                    scoreState.totalScore > 0
                      ? scoreState.currentScore / scoreState.totalScore >= 0.75
                        ? "green-background"
                        : scoreState.currentScore / scoreState.totalScore >= 0.5
                        ? "yellow-background"
                        : "pink-background"
                      : ""
                  }
                  style={{
                    width:
                      scoreState.totalScore > 0
                        ? `${
                            (scoreState.currentScore / scoreState.totalScore) *
                            100
                          }%`
                        : "0%",
                    transition: "width 0.1s linear, background-color 0.3s ease",
                  }}
                ></span>
              </>
            ) : timerState ? (
              <>
                <span id="timer" className="info">
                  {timerState.displayTime !== null && gameState
                    ? `${
                        gameState.gameStatus === "playing"
                          ? "Remaining"
                          : "Next game"
                      }: ${timerState.displayTime}s`
                    : "--"}
                </span>
                <span
                  id="timer-bar"
                  className={
                    gameState?.gameStatus === "playing" &&
                    timerState.initialTimer > 0 &&
                    timerState.displayTime !== null
                      ? timerState.displayTime / timerState.initialTimer >= 0.75
                        ? "green-background"
                        : timerState.displayTime / timerState.initialTimer >=
                          0.5
                        ? "yellow-background"
                        : "pink-background"
                      : gameState?.gameStatus === "waiting"
                      ? "yellow-background"
                      : ""
                  }
                  style={{
                    width: `${timerState.progressBarWidth}px`,
                  }}
                ></span>
              </>
            ) : null}
          </div>
          <button
            id="clockwise-button"
            className="rotate-button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              setBoardRotation((prev) => prev + 90);
            }}
            aria-label="Rotate board clockwise"
          >
            &#8635;
          </button>
        </div>

        {/* Board with rounded square wrapper */}
        <div className="board-wrapper">
          <div
            ref={boardRef}
            id="board"
            className="" // Class will be set by BoardThemeContext
            style={{
              position: "relative",
              touchAction: "none",
              transform: `rotate(${boardRotation}deg)`,
              WebkitTransform: `rotate(${boardRotation}deg)`,
              MozTransform: `rotate(${boardRotation}deg)`,
              msTransform: `rotate(${boardRotation}deg)`,
              OTransform: `rotate(${boardRotation}deg)`,
            }}
            onMouseDown={handleMouseDownWithClear}
            onPointerDown={(e) => {
              if (gameState?.gameStatus !== "playing") return;

              isPointerDownRef.current = true;
              activePointerIdRef.current = e.pointerId;

              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

              clearKeyboardWord();
              handlePointerPosition(e.clientX, e.clientY, e.pointerType);
            }}
            onPointerMove={(e) => {
              if (!isPointerDownRef.current) return;
              if (activePointerIdRef.current !== e.pointerId) return;

              handlePointerPosition(e.clientX, e.clientY, e.pointerType);
            }}
            onPointerUp={(e) => {
              if (activePointerIdRef.current !== e.pointerId) return;

              isPointerDownRef.current = false;
              activePointerIdRef.current = null;
              finalizeWordSelection();
            }}
            onPointerCancel={() => {
              isPointerDownRef.current = false;
              activePointerIdRef.current = null;
              finalizeWordSelection();
            }}
          >
            {debugMode &&
              debugPath?.map((p, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: p.x - 4,
                    top: p.y - 4,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: p.overLetter ? "lime" : "red",
                    opacity: 0.8,
                    pointerEvents: "none",
                    zIndex: 9999,
                  }}
                />
              ))}

            {debugMode && debugDot && (
              <div
                style={{
                  position: "absolute",
                  left: debugDot.x - 12,
                  top: debugDot.y - 12,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: debugDot.overLetter ? "lime" : "red",
                  boxShadow: debugDot.overLetter
                    ? "0 0 8px lime"
                    : "0 0 8px red",
                  pointerEvents: "none",
                  zIndex: 9999,
                }}
              />
            )}

            {!hasBoardBeenShown && !gameState.board
              ? // Show pulsating circles only on first game start (when user joins, before board is available)
                Array.from({ length: 16 }, (_, i) => {
                  const row = Math.floor(i / 4);
                  const col = i % 4;
                  return (
                    <div
                      key={i}
                      className="letter"
                      data-x={row}
                      data-y={col}
                      data-index={i}
                      data-letter=""
                      style={{
                        transform: `rotate(${-boardRotation}deg)`,
                        WebkitTransform: `rotate(${-boardRotation}deg)`,
                        MozTransform: `rotate(${-boardRotation}deg)`,
                        msTransform: `rotate(${-boardRotation}deg)`,
                        OTransform: `rotate(${-boardRotation}deg)`,
                      }}
                    >
                      <div className="letValue">
                        <div className={`dot-${i}`}></div>
                      </div>
                    </div>
                  );
                })
              : gameState.gameStatus === "waiting" && previousBoard
              ? // Show previous board letters in faded color between games
                Array.from({ length: 16 }, (_, i) => {
                  const row = Math.floor(i / 4);
                  const col = i % 4;
                  const letter = previousBoard?.[row]?.[col] || "";
                  return (
                    <div
                      key={i}
                      className="letter"
                      data-x={row}
                      data-y={col}
                      data-index={i}
                      data-letter={letter}
                      style={{
                        transform: `rotate(${-boardRotation}deg)`,
                        WebkitTransform: `rotate(${-boardRotation}deg)`,
                        MozTransform: `rotate(${-boardRotation}deg)`,
                        msTransform: `rotate(${-boardRotation}deg)`,
                        OTransform: `rotate(${-boardRotation}deg)`,
                      }}
                    >
                      <div className="letValue grey">{letter}</div>
                    </div>
                  );
                })
              : // Show board letters when available (game in progress)
                Array.from({ length: 16 }, (_, i) => {
                  const row = Math.floor(i / 4);
                  const col = i % 4;
                  const letter = gameState.board?.[row]?.[col] || "";
                  // Check if this tile is a bonus tile (snark = 1, boojum = 2)
                  const bonusValue = gameState.boojumBonus?.[row]?.[col] || 0;
                  const isSnark = bonusValue === 1;
                  const isBoojum = bonusValue === 2;

                  return (
                    <div
                      key={i}
                      className={`letter ${isSnark ? "snark" : ""} ${
                        isBoojum ? "boojum" : ""
                      }`}
                      data-x={row}
                      data-y={col}
                      data-index={i}
                      data-letter={letter}
                      style={{
                        transform: `rotate(${-boardRotation}deg)`,
                        WebkitTransform: `rotate(${-boardRotation}deg)`,
                        MozTransform: `rotate(${-boardRotation}deg)`,
                        msTransform: `rotate(${-boardRotation}deg)`,
                        OTransform: `rotate(${-boardRotation}deg)`,
                      }}
                    >
                      <div className="letValue">{letter}</div>
                    </div>
                  );
                })}
            {/* Show scores button - when scores are available and game is finished or waiting (during interval) */}
            {gameState?.finalScores &&
            (gameState?.gameStatus === "finished" ||
              gameState?.gameStatus === "waiting") &&
            onShowScores ? (
              <button
                id="show-scores-button"
                className="show-scores-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowScores();
                }}
                style={{
                  transform: `rotate(${-boardRotation}deg)`,
                }}
              >
                Open
                <br />
                scores
              </button>
            ) : null}
          </div>
          {/* SVG container for drawing lines between letters */}
          <svg
            className="board-svg-overlay"
            ref={svgContainerRef}
            id="svgContainer"
          />

          {/* Confirmation Dialog for One-Shot Games */}
          <ConfirmationDialog
            isOpen={confirmationWord !== null}
            word={confirmationWord || ""}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            boardRef={boardRef}
          />
        </div>

        {/* Display current word when typing with keyboard - always reserve space */}
        <div
          id="guess"
          style={{
            visibility:
              keyboardWord && gameState?.gameStatus === "playing"
                ? "visible"
                : "hidden",
          }}
        >
          {keyboardWord || "\u00A0"}
        </div>
      </div>
    </div>
  );
}
