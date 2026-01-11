/**
 * Utility functions for persisting game state to localStorage
 * to enable state restoration on reconnection
 */

interface StoredGameState {
  gameRoundId: string;
  roomId: string;
  username: string;  // Add username to stored state
  wordsFound: string[];
  wordCounts: Record<string, number>;
  totalScore: number;
  bestWord: { word: string; score: number };
  wordsFoundArray: string[];
  oneShotSubmitted: boolean;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = 'game_state_';

/**
 * Get storage key for a room and username combination
 */
function getStorageKey(roomId: string, username: string): string {
  return `${STORAGE_KEY_PREFIX}${roomId}_${username}`;
}

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save game state to localStorage
 */
export function saveGameState(
  roomId: string,
  username: string,
  gameRoundId: string | undefined,
  playerState: {
    wordsFound: Set<string>;
    wordCounts: Record<string, number>;
    totalScore: number;
    bestWord: { word: string; score: number };
    wordsFoundArray: string[];
    oneShotSubmitted: boolean;
  }
): void {
  if (!gameRoundId || !username) {
    // No game round ID or username means no active game - don't save
    console.log('[saveGameState] Not saving: missing gameRoundId or username', {
      gameRoundId,
      username,
    });
    return;
  }

  if (!isLocalStorageAvailable()) {
    // localStorage not available (e.g., incognito mode) - skip saving
    console.log('[saveGameState] Not saving: localStorage not available');
    return;
  }

  try {
    const stored: StoredGameState = {
      gameRoundId,
      roomId,
      username,
      wordsFound: Array.from(playerState.wordsFound),
      wordCounts: playerState.wordCounts,
      totalScore: playerState.totalScore,
      bestWord: playerState.bestWord,
      wordsFoundArray: playerState.wordsFoundArray,
      oneShotSubmitted: playerState.oneShotSubmitted,
      timestamp: Date.now(),
    };

    const storageKey = getStorageKey(roomId, username);
    localStorage.setItem(storageKey, JSON.stringify(stored));
    console.log('[saveGameState] Saved to localStorage:', {
      storageKey,
      gameRoundId,
      roomId,
      username,
      totalScore: playerState.totalScore,
      wordsFoundCount: playerState.wordsFound.size,
    });
  } catch (error) {
    console.error('Error saving game state to localStorage:', error);
  }
}

/**
 * Load game state from localStorage if it matches the current game round and username
 */
export function loadGameState(
  roomId: string,
  username: string,
  currentGameRoundId: string | undefined
): StoredGameState | null {
  console.log('[loadGameState] Attempting to load:', {
    roomId,
    username,
    currentGameRoundId,
  });

  if (!currentGameRoundId || !username) {
    // No game round ID or username means no active game - nothing to restore
    console.log('[loadGameState] Missing gameRoundId or username');
    return null;
  }

  if (!isLocalStorageAvailable()) {
    // localStorage not available (e.g., incognito mode) - return null
    console.log('[loadGameState] localStorage not available');
    return null;
  }

  try {
    const storageKey = getStorageKey(roomId, username);
    const stored = localStorage.getItem(storageKey);
    console.log('[loadGameState] Checking localStorage:', {
      storageKey,
      hasStored: !!stored,
    });
    
    if (!stored) {
      console.log('[loadGameState] No stored state found');
      return null;
    }

    const parsed: StoredGameState = JSON.parse(stored);
    console.log('[loadGameState] Parsed stored state:', {
      storedGameRoundId: parsed.gameRoundId,
      storedRoomId: parsed.roomId,
      storedUsername: parsed.username,
      storedTotalScore: parsed.totalScore,
      storedWordsFoundCount: parsed.wordsFound.length,
      matchesGameRoundId: parsed.gameRoundId === currentGameRoundId,
      matchesRoomId: parsed.roomId === roomId,
      matchesUsername: parsed.username === username,
    });

    // Check if stored state matches current game round, room, and username
    if (
      parsed.gameRoundId === currentGameRoundId && 
      parsed.roomId === roomId &&
      parsed.username === username
    ) {
      console.log('[loadGameState] State matches - returning restored state');
      return parsed;
    }

    // Game round or username doesn't match - clear old data for this username
    console.log('[loadGameState] State does not match - clearing old data');
    clearGameState(roomId, username);
    return null;
  } catch (error) {
    console.error('Error loading game state from localStorage:', error);
    clearGameState(roomId, username);
    return null;
  }
}

/**
 * Clear game state from localStorage for a specific user
 */
export function clearGameState(roomId: string, username: string): void {
  if (!isLocalStorageAvailable()) {
    return;
  }
  
  try {
    localStorage.removeItem(getStorageKey(roomId, username));
  } catch (error) {
    console.error('Error clearing game state from localStorage:', error);
  }
}

/**
 * Convert stored words array back to Set
 */
export function wordsArrayToSet(words: string[]): Set<string> {
  return new Set(words);
}

