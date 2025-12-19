import { useEffect, useRef } from 'react';

interface GameState {
  gameStatus?: string;
  finalScores?: any;
}

export function useGameScoreSubmission(
  gameState: GameState | null,
  submitFinalScore: (sendJson: (data: any) => void) => void,
  sendJson: ((data: any) => void) | undefined,
  setIsScoresModalOpen: (open: boolean) => void
): void {
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
}

