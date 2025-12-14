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
    return;
  }

  if (!isLocalStorageAvailable()) {
    // localStorage not available (e.g., incognito mode) - skip saving
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

    localStorage.setItem(getStorageKey(roomId, username), JSON.stringify(stored));
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
  if (!currentGameRoundId || !username) {
    // No game round ID or username means no active game - nothing to restore
    return null;
  }

  if (!isLocalStorageAvailable()) {
    // localStorage not available (e.g., incognito mode) - return null
    return null;
  }

  try {
    const stored = localStorage.getItem(getStorageKey(roomId, username));
    if (!stored) {
      return null;
    }

    const parsed: StoredGameState = JSON.parse(stored);

    // Check if stored state matches current game round, room, and username
    if (
      parsed.gameRoundId === currentGameRoundId && 
      parsed.roomId === roomId &&
      parsed.username === username
    ) {
      return parsed;
    }

    // Game round or username doesn't match - clear old data for this username
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

