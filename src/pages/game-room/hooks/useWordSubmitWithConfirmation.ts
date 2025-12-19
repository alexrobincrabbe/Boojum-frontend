import { useCallback } from 'react';
import type { GameState } from '../../../ws/protocol';

interface TimerState {
  displayTime: number | null;
  progressBarWidth: number;
  initialTimer: number;
}

export function useWordSubmitWithConfirmation(
  gameState: GameState | null,
  wordsFound: Set<string>,
  oneShotSubmitted: boolean,
  handleWordSubmit: (word: string) => void
): (word: string) => string | void {
  return useCallback(
    (word: string): string | void => {
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
    },
    [gameState, wordsFound, oneShotSubmitted, handleWordSubmit]
  );
}

export function useOneShotConfirmed(
  gameState: GameState | null,
  timerState: TimerState,
  submitOneShotWord: (word: string, time: number, sendJson: (data: any) => void) => void,
  sendJson: ((data: any) => void) | undefined
): (word: string) => void {
  return useCallback(
    (word: string) => {
      if (!gameState || !timerState.displayTime || !timerState.initialTimer) return;

      // Calculate time: initialTimer - currentTime (in seconds)
      const time = Math.max(0, timerState.initialTimer - timerState.displayTime);

      if (sendJson) {
        submitOneShotWord(word, time, sendJson);
      }
    },
    [gameState, timerState, submitOneShotWord, sendJson]
  );
}

