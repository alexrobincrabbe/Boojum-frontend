import { useRef, useState, useEffect, useCallback } from 'react';
import type { GameState } from '../../../ws/protocol';
import { useBoardSwipe } from '../../../hooks/useBoardSwipe';
import { useKeyboardInput } from '../../../hooks/useKeyboardInput';
import { ConfirmationDialog } from './ConfirmationDialog';
import './GameBoard.css';

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
  const lastTouchPositionRef = useRef<{ x: number; y: number } | null>(null);
  const processedLettersInTouchMoveRef = useRef<Set<number>>(new Set());
  const activeTouchIdRef = useRef<number | null>(null); // Track active touch for multi-touch handling on iPad

  // Wrapper for onWordSubmit that handles one-shot confirmation
  const handleWordSubmitWrapper = useCallback((word: string) => {
    const result = onWordSubmit(word);
    
    // If result is a string (word), it means we need to show confirmation for one-shot
    if (typeof result === 'string' && gameState.oneShot && !oneShotSubmitted) {
      setConfirmationWord(result);
      return;
    }
    
    // For normal games, onWordSubmit returns void/undefined and the submission is already handled
    // No additional action needed
  }, [onWordSubmit, gameState?.oneShot, oneShotSubmitted]);

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
    handleTouchEnd,
    handleLetterTouch, // Get handleLetterTouch for direct use in touch handlers
  } = useBoardSwipe(
    boardRef,
    gameState?.gameStatus,
    oneShotSubmitted ? () => {} : handleWordSubmitWrapper, // Use wrapper to handle one-shot confirmation
    boardWords,
    wordsFound,
    colorsOffOverride,
    onExactMatch
  );

  // Keyboard input functionality
  const { currentWord: keyboardWord, clearWord: clearKeyboardWord } = useKeyboardInput({
    gameStatus: gameState?.gameStatus,
    board: gameState?.board,
    boardWords,
    wordsFound,
    onWordSubmit: oneShotSubmitted ? () => {} : handleWordSubmitWrapper, // Disable if one-shot submitted
  });

  // Clear keyboard word when swipe starts
  const handleMouseDownWithClear = useCallback((e: React.MouseEvent) => {
    clearKeyboardWord();
    handleMouseDown(e);
  }, [clearKeyboardWord, handleMouseDown]);

  // Attach touch event listeners directly to DOM with non-passive option to prevent scrolling
  // This avoids the "Unable to preventDefault inside passive event listener" warning
  useEffect(() => {
    const boardElement = boardRef.current;
    if (!boardElement) return;

    // Helper to get letter element from DOM element
    const getLetterFromElement = (element: Element | null) => {
      if (!element) return null;
      
      let letterEl: HTMLElement | null = null;
      if (element.classList.contains('letter')) {
        letterEl = element as HTMLElement;
      } else if (element.parentElement?.classList.contains('letter')) {
        letterEl = element.parentElement as HTMLElement;
      }
      
      if (!letterEl) return null;
      
      const x = parseInt(letterEl.getAttribute('data-x') || '0');
      const y = parseInt(letterEl.getAttribute('data-y') || '0');
      const letter = letterEl.getAttribute('data-letter') || '';
      const index = parseInt(letterEl.getAttribute('data-index') || '0');
      return {
        element: letterEl as HTMLDivElement,
        x,
        y,
        letter,
        index,
      };
    };

    // Helper to sample path between two points and check for letters
    const samplePathForLetters = (startX: number, startY: number, endX: number, endY: number) => {
      const dx = endX - startX;
      const dy = endY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Reset processed letters set for this move
      processedLettersInTouchMoveRef.current.clear();
      
      // Optimization: Skip sampling if movement is very small (less than 5px)
      // Just check the end position directly
      if (distance < 5) {
        const element = document.elementFromPoint(endX, endY);
        const letterElement = getLetterFromElement(element);
        if (letterElement) {
          processedLettersInTouchMoveRef.current.add(letterElement.index);
          handleLetterTouch(letterElement);
        }
        return;
      }
      
      // Adaptive step size: smaller for short distances, larger for long distances
      // This ensures we catch all letters on short swipes while limiting work on long swipes
      // Letters are typically 40-60px, so 12px step catches them reliably
      const baseStepSize = 12;
      // Maximum safe step size: letters are ~40-60px, so 20px ensures at least 2 samples per letter
      const maxSafeStepSize = 20;
      // Cap total samples to prevent performance issues on slower devices, but ensure step size never exceeds safe limit
      const maxSamples = 20; // Increased from 15 to allow longer swipes without missing letters
      const adaptiveStepSize = distance / maxSamples;
      const stepSize = Math.min(maxSafeStepSize, Math.max(baseStepSize, adaptiveStepSize));
      const steps = Math.max(1, Math.ceil(distance / stepSize));
      
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = startX + dx * t;
        const y = startY + dy * t;
        
        const element = document.elementFromPoint(x, y);
        const letterElement = getLetterFromElement(element);
        
        // Only process each letter once per move event to avoid duplicates
        if (letterElement && !processedLettersInTouchMoveRef.current.has(letterElement.index)) {
          processedLettersInTouchMoveRef.current.add(letterElement.index);
          handleLetterTouch(letterElement);
        }
      }
    };

    const handleTouchStartDirect = (e: TouchEvent) => {
      if (gameState?.gameStatus !== 'playing') return;
      // iPad/Safari: Check if there are any touches before accessing
      if (!e.touches || e.touches.length === 0) return;
      
      e.preventDefault();
      e.stopPropagation();
      clearKeyboardWord();
      const touch = e.touches[0];
      // Track this touch identifier for multi-touch handling (important on iPad)
      activeTouchIdRef.current = touch.identifier;
      // Reset last position for new swipe
      lastTouchPositionRef.current = { x: touch.clientX, y: touch.clientY };
      processedLettersInTouchMoveRef.current.clear();
      
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const letterElement = getLetterFromElement(element);
      if (letterElement) {
        handleLetterTouch(letterElement);
      }
    };

    const handleTouchMoveDirect = (e: TouchEvent) => {
      if (gameState?.gameStatus !== 'playing') return;
      // iPad/Safari: Check if there are any touches before accessing
      if (!e.touches || e.touches.length === 0) return;
      
      // Find the active touch by identifier (handles multi-touch on iPad)
      const touch = activeTouchIdRef.current !== null
        ? Array.from(e.touches).find(t => t.identifier === activeTouchIdRef.current) || e.touches[0]
        : e.touches[0];
      
      if (!touch) return;
      
      e.preventDefault();
      e.stopPropagation();
      const currentPos = { x: touch.clientX, y: touch.clientY };
      
      // If we have a last position, sample the path between them
      if (lastTouchPositionRef.current) {
        samplePathForLetters(
          lastTouchPositionRef.current.x,
          lastTouchPositionRef.current.y,
          currentPos.x,
          currentPos.y
        );
      } else {
        // First move - just check current position
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const letterElement = getLetterFromElement(element);
        if (letterElement) {
          handleLetterTouch(letterElement);
        }
      }
      
      // Update last position
      lastTouchPositionRef.current = currentPos;
    };

    const handleTouchEndDirect = (e: TouchEvent) => {
      // iPad/Safari: Check if this is our active touch ending
      // Handle both touchend (specific touch) and touchcancel (all touches)
      if (e.type === 'touchend' && activeTouchIdRef.current !== null) {
        // Check if the ended touch is our active one
        const endedTouch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchIdRef.current);
        if (!endedTouch && e.changedTouches.length > 0) {
          // Different touch ended, ignore it
          return;
        }
      }
      
      e.preventDefault();
      e.stopPropagation();
      // Reset last position
      lastTouchPositionRef.current = null;
      processedLettersInTouchMoveRef.current.clear();
      activeTouchIdRef.current = null; // Clear active touch tracking
      const syntheticEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.TouchEvent;
      handleTouchEnd(syntheticEvent);
    };

    // iPad: Handle touchcancel for when system interrupts touch (notifications, gestures, etc.)
    const handleTouchCancelDirect = (e: TouchEvent) => {
      // Treat cancel same as end - reset everything
      handleTouchEndDirect(e);
    };

    // Attach with { passive: false } to allow preventDefault
    boardElement.addEventListener('touchstart', handleTouchStartDirect, { passive: false });
    boardElement.addEventListener('touchmove', handleTouchMoveDirect, { passive: false });
    boardElement.addEventListener('touchend', handleTouchEndDirect, { passive: false });
    boardElement.addEventListener('touchcancel', handleTouchCancelDirect, { passive: false }); // Important for iPad

    return () => {
      boardElement.removeEventListener('touchstart', handleTouchStartDirect);
      boardElement.removeEventListener('touchmove', handleTouchMoveDirect);
      boardElement.removeEventListener('touchend', handleTouchEndDirect);
      boardElement.removeEventListener('touchcancel', handleTouchCancelDirect);
    };
  }, [boardRef, gameState?.gameStatus, clearKeyboardWord, handleLetterTouch, handleTouchEnd]);

  return (
    <div className="game-board">
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
                <span id="timer" className="info" data-score={scoreState.currentScore}>
                  {scoreState.currentScore}/{scoreState.totalScore} pts
                </span>
                <span
                  id="timer-bar"
                  className={
                    scoreState.totalScore > 0
                      ? scoreState.currentScore / scoreState.totalScore >= 0.75
                        ? 'green-background'
                        : scoreState.currentScore / scoreState.totalScore >= 0.5
                        ? 'yellow-background'
                        : 'pink-background'
                      : ''
                  }
                  style={{
                    width: scoreState.totalScore > 0 
                      ? `${(scoreState.currentScore / scoreState.totalScore) * 100}%`
                      : '0%',
                    transition: 'width 0.1s linear, background-color 0.3s ease',
                  }}
                ></span>
              </>
            ) : timerState ? (
              <>
                <span id="timer" className="info">
                  {timerState.displayTime !== null && gameState
                    ? `${
                        gameState.gameStatus === 'playing'
                          ? 'Remaining'
                          : 'Next game'
                      }: ${timerState.displayTime}s`
                    : '--'}
                </span>
                <span
                  id="timer-bar"
                  className={
                    gameState?.gameStatus === 'playing' &&
                    timerState.initialTimer > 0 &&
                    timerState.displayTime !== null
                      ? timerState.displayTime / timerState.initialTimer >= 0.75
                        ? 'green-background'
                        : timerState.displayTime / timerState.initialTimer >= 0.5
                        ? 'yellow-background'
                        : 'pink-background'
                      : gameState?.gameStatus === 'waiting'
                      ? 'yellow-background'
                      : ''
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
              transform: `rotate(${boardRotation}deg)`,
              WebkitTransform: `rotate(${boardRotation}deg)`,
              MozTransform: `rotate(${boardRotation}deg)`,
              msTransform: `rotate(${boardRotation}deg)`,
              OTransform: `rotate(${boardRotation}deg)`,
            }}
            onMouseDown={handleMouseDownWithClear}
          >
            {!hasBoardBeenShown && !gameState.board ? (
              // Show pulsating circles only on first game start (when user joins, before board is available)
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
            ) : gameState.gameStatus === 'waiting' && previousBoard ? (
              // Show previous board letters in faded color between games
              Array.from({ length: 16 }, (_, i) => {
                const row = Math.floor(i / 4);
                const col = i % 4;
                const letter = previousBoard?.[row]?.[col] || '';
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
            ) : (
              // Show board letters when available (game in progress)
              Array.from({ length: 16 }, (_, i) => {
                const row = Math.floor(i / 4);
                const col = i % 4;
                const letter = gameState.board?.[row]?.[col] || '';
                // Check if this tile is a bonus tile (snark = 1, boojum = 2)
                const bonusValue = gameState.boojumBonus?.[row]?.[col] || 0;
                const isSnark = bonusValue === 1;
                const isBoojum = bonusValue === 2;
                
                return (
                  <div
                    key={i}
                    className={`letter ${isSnark ? 'snark' : ''} ${isBoojum ? 'boojum' : ''}`}
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
              })
            )}
            {/* Show scores button - when scores are available and game is finished or waiting (during interval) */}
            {gameState?.finalScores && (gameState?.gameStatus === 'finished' || gameState?.gameStatus === 'waiting') && onShowScores ? (
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
                Open<br />scores
              </button>
            ) : null}
          </div>
          {/* SVG container for drawing lines between letters */}
          <svg ref={svgContainerRef} id="svgContainer" />
          
          {/* Confirmation Dialog for One-Shot Games */}
          <ConfirmationDialog
            isOpen={confirmationWord !== null}
            word={confirmationWord || ''}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            boardRef={boardRef}
          />
        </div>
        
        {/* Display current word when typing with keyboard - always reserve space */}
        <div id="guess" style={{ visibility: keyboardWord && gameState?.gameStatus === 'playing' ? 'visible' : 'hidden' }}>
          {keyboardWord || '\u00A0'}
        </div>
      </div>
    </div>
  );
}

