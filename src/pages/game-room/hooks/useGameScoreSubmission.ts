import { useEffect, useRef } from 'react';

interface GameState {
  gameStatus?: string;
  finalScores?: any;
  boardWords?: string[];
  phase?: string;
}

export function useGameScoreSubmission(
  gameState: GameState | null,
  submitFinalScore: (sendJson: (data: any) => void) => void,
  sendJson: ((data: any) => void) | undefined,
  setIsScoresModalOpen: (open: boolean) => void,
  connectionState?: string
): void {
  const prevGameStatusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentStatus = gameState?.gameStatus;
    const prevStatus = prevGameStatusRef.current;
    
    // Submit score when game status changes from 'playing' to 'finished'
    if (prevStatus === 'playing' && currentStatus === 'finished' && sendJson) {
      submitFinalScore(sendJson);
    }
    
    // Close scores modal when next game starts (status changes to 'playing' after interval)
    if ((prevStatus === 'finished' || prevStatus === 'waiting') && currentStatus === 'playing') {
      setIsScoresModalOpen(false);
    }
    
    prevGameStatusRef.current = currentStatus;
  }, [gameState?.gameStatus, gameState?.finalScores, submitFinalScore, sendJson, setIsScoresModalOpen]);

  // Retry submission after reconnect/resync while the score window is still open
  useEffect(() => {
    if (!sendJson || !gameState?.boardWords || gameState.finalScores) {
      return;
    }

    const inScoreWindow =
      gameState.gameStatus === 'finished' ||
      (gameState.gameStatus === 'waiting' && gameState.phase === 'intermission');

    if (inScoreWindow && connectionState === 'open') {
      submitFinalScore(sendJson);
    }
  }, [
    connectionState,
    gameState?.gameStatus,
    gameState?.phase,
    gameState?.finalScores,
    gameState?.boardWords,
    sendJson,
    submitFinalScore,
  ]);
}

