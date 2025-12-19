import { useEffect } from 'react';
import type { GameState, OutboundMessage } from '../../../ws/protocol';

interface WordTrackingRef {
  initializeWordLists: (wordsByLength: Record<string, string[]>, gameState?: GameState | null, sendJson?: (message: OutboundMessage) => void) => void;
}

export function useWordTrackingRef(
  wordTrackingRef: React.MutableRefObject<WordTrackingRef | null>,
  initializeWordLists: (wordsByLength: Record<string, string[]>) => void
): void {
  useEffect(() => {
    wordTrackingRef.current = {
      initializeWordLists,
    };
  }, [wordTrackingRef, initializeWordLists]);
}

