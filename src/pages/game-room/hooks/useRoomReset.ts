import { useEffect } from 'react';

export function useRoomReset(
  roomId: string | undefined,
  resetState: () => void,
  setIsScoresModalOpen: (open: boolean) => void
): void {
  useEffect(() => {
    if (roomId) {
      const timeoutId = setTimeout(() => {
        resetState();
        setIsScoresModalOpen(false);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [roomId, resetState, setIsScoresModalOpen]);
}

