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

    const handleTouchStartDirect = (e: TouchEvent) => {
      if (gameState?.gameStatus !== 'playing') return;
      e.preventDefault();
      e.stopPropagation();
      clearKeyboardWord();
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (element) {
        // Get letter element using the same logic as useBoardSwipe's getContainerDiv
        let letterEl: HTMLElement | null = null;
        if (element.classList.contains('letter')) {
          letterEl = element as HTMLElement;
        } else if (element.parentElement?.classList.contains('letter')) {
          letterEl = element.parentElement as HTMLElement;
        }
        
        if (letterEl) {
          // Extract letter data and call handleLetterTouch directly
          const x = parseInt(letterEl.getAttribute('data-x') || '0');
          const y = parseInt(letterEl.getAttribute('data-y') || '0');
          const letter = letterEl.getAttribute('data-letter') || '';
          const index = parseInt(letterEl.getAttribute('data-index') || '0');
          const letterElement = {
            element: letterEl as HTMLDivElement,
            x,
            y,
            letter,
            index,
          };
          handleLetterTouch(letterElement);
        }
      }
    };

    const handleTouchMoveDirect = (e: TouchEvent) => {
      if (gameState?.gameStatus !== 'playing') return;
      e.preventDefault();
      e.stopPropagation();
      const touch = e.touches[0];
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      if (element) {
        // Get letter element using the same logic as useBoardSwipe's getContainerDiv
        let letterEl: HTMLElement | null = null;
        if (element.classList.contains('letter')) {
          letterEl = element as HTMLElement;
        } else if (element.parentElement?.classList.contains('letter')) {
          letterEl = element.parentElement as HTMLElement;
        }
        
        if (letterEl) {
          // Extract letter data and call handleLetterTouch directly
          const x = parseInt(letterEl.getAttribute('data-x') || '0');
          const y = parseInt(letterEl.getAttribute('data-y') || '0');
          const letter = letterEl.getAttribute('data-letter') || '';
          const index = parseInt(letterEl.getAttribute('data-index') || '0');
          const letterElement = {
            element: letterEl as HTMLDivElement,
            x,
            y,
            letter,
            index,
          };
          handleLetterTouch(letterElement);
        }
      }
    };

    const handleTouchEndDirect = (e: TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const syntheticEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
      } as unknown as React.TouchEvent;
      handleTouchEnd(syntheticEvent);
    };

    // Attach with { passive: false } to allow preventDefault
    boardElement.addEventListener('touchstart', handleTouchStartDirect, { passive: false });
    boardElement.addEventListener('touchmove', handleTouchMoveDirect, { passive: false });
    boardElement.addEventListener('touchend', handleTouchEndDirect, { passive: false });

    return () => {
      boardElement.removeEventListener('touchstart', handleTouchStartDirect);
      boardElement.removeEventListener('touchmove', handleTouchMoveDirect);
      boardElement.removeEventListener('touchend', handleTouchEndDirect);
    };
  }, [boardRef, gameState?.gameStatus, clearKeyboardWord, handleLetterTouch]);

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

