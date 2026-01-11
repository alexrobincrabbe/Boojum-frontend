/**
 * WebSocket Message Protocol for Django Channels Game Server
 * 
 * All messages use a discriminated union pattern with a 'type' field.
 * Server messages include a 'seq' (sequence number) for resync support.
 */

// ============================================================================
// Outbound Messages (Client -> Server)
// ============================================================================

export type OutboundMessage =
  | { type: 'JOIN_ROOM'; roomId: string; guestId?: string }
  | { type: 'LEAVE_ROOM'; roomId: string }
  | { type: 'PLAYER_ACTION'; action: string; data: Record<string, unknown> }
  | { type: 'CHAT'; message: string }
  | { type: 'RESYNC'; lastSeq?: number; lastTimestamp?: number }
  | { type: 'PING' }
  | { type: 'UPDATE_SCORE'; finalScore: number; bestWord: { word: string; score: number }; numberOfWordsFound: number; whichWordsFound: number[] }
  | { type: 'START_GAME' };

// ============================================================================
// Inbound Messages (Server -> Client)
// ============================================================================

export type InboundMessage =
  | { type: 'STATE_SNAPSHOT'; seq: number; state: GameState }
  | { type: 'DELTA_UPDATE'; seq: number; delta: Record<string, unknown> }
  | { type: 'SCORE_UPDATE'; seq: number; scores: ScoreUpdate }
  | { type: 'CHAT'; seq: number; user: string; message: string; timestamp: number }
  | { type: 'SCORE_IN_CHAT'; playerName: string; score: number; timestamp: number }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'PONG' }
  | { type: 'FINAL_SCORES'; seq: number; finalScores: Record<string, FinalScore>; totalPoints?: number; wordsByLength?: Record<string, Record<string, WordData>> }
  | { type: 'SHOW_BACK_BUTTON' };

// ============================================================================
// Game State Types
// ============================================================================

export interface GameState {
  roomId: string;
  players: Player[];
  currentPlayerId?: string;  // Stable player ID (user:{id} or guest:{uuid}) - use this for player identification
  currentConnId?: string;  // Channel name (for backwards compatibility)
  gameStatus: 'waiting' | 'playing' | 'finished';
  gameRoundId?: string;  // Unique identifier for this game round (for localStorage persistence)
  currentRound?: number;
  timeRemaining?: number;  // Legacy: remaining time in seconds (deprecated, use phase-based timing)
  initialTimer?: number;  // Legacy: initial timer value (deprecated, use phase-based timing)
  gameTime?: number;  // Actual game timer used (not intermission timer)
  // Phase-based timing (new Redis-based system)
  serverNow?: number;  // Server timestamp (Unix seconds UTC)
  phase?: 'game' | 'intermission';  // Current phase
  phaseStartedAt?: number;  // When current phase started (Unix seconds UTC)
  phaseDuration?: number;  // Duration of current phase in seconds
  remainingTime?: number;  // Remaining time in current phase (calculated client-side)
  guestId?: string;  // Guest UUID (for guests, stored in localStorage)
  board?: string[][];
  boardWords?: string[];  // List of valid words on the board
  finalScores?: Record<string, FinalScore>;  // Final scores when game ends
  totalPoints?: number;  // Total available points
  wordsByLength?: Record<string, string[]> | Record<string, Record<string, WordData>>;  // Words grouped by length (simple format during game, detailed format with scores at end)
  boojum?: string;  // Bonus letter that doubles word multiplier
  snark?: string;  // Bonus letter that doubles letter score
  boojumBonus?: number[][];  // NxN array: 1 = snark, 2 = boojum, 0 = normal
  oneShot?: boolean;  // True if this is a one-shot/unicorn room (only one word allowed)
  boardSize?: number;  // Size of the board (4 for 4x4, 5 for 5x5, defaults to 4)
  language?: string;  // Language for the room (e.g., 'en' for English, 'es' for Spanish, defaults to 'en')
  // Add other game-specific state fields as needed
}

export interface Player {
  id: string;  // Stable player ID (user:{id} or guest:{uuid}) - use this for player identification
  userId?: number | null;  // User ID if authenticated, null/undefined for guests
  username: string;
  score: number;
  isReady: boolean;
  isConnected: boolean;
}

export interface ScoreUpdate {
  playerId: string;
  score: number;
  change: number;
}

export interface FinalScore {
  display_name: string;
  final_score: number;
  number_of_words_found?: number;
  best_word: {
    word: string;
    score: number;
  };
  time?: number; // For one-shot games
  profile_picture?: string;
  chat_color?: string;
  profile_url?: string;
  which_words_found?: number[]; // Array indicating which words this player found
}

export interface WordData {
  score: number;
  player_found: number; // 1 if current player found it, 0 otherwise
  sum_players_found: number; // Total number of players who found it
}

// ============================================================================
// Type Guards
// ============================================================================

export function isInboundMessage(data: unknown): data is InboundMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as { type: unknown }).type === 'string'
  );
}

export function isOutboundMessage(data: unknown): data is OutboundMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    typeof (data as { type: unknown }).type === 'string'
  );
}

