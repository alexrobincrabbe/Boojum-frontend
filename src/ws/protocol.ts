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
  | { type: 'JOIN_ROOM'; roomId: string }
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
  currentPlayerId?: string;  // channel_name of the current player (so frontend knows which player is "me")
  gameStatus: 'waiting' | 'playing' | 'finished';
  gameRoundId?: string;  // Unique identifier for this game round (for localStorage persistence)
  currentRound?: number;
  timeRemaining?: number;
  initialTimer?: number;  // Initial timer value for progress bar calculation
  board?: string[][];
  boardWords?: string[];  // List of valid words on the board
  finalScores?: Record<string, FinalScore>;  // Final scores when game ends
  totalPoints?: number;  // Total available points
  wordsByLength?: Record<string, string[]> | Record<string, Record<string, WordData>>;  // Words grouped by length (simple format during game, detailed format with scores at end)
  boojum?: string;  // Bonus letter that doubles word multiplier
  snark?: string;  // Bonus letter that doubles letter score
  boojumBonus?: number[][];  // 4x4 array: 1 = snark, 2 = boojum, 0 = normal
  oneShot?: boolean;  // True if this is a one-shot/unicorn room (only one word allowed)
  // Add other game-specific state fields as needed
}

export interface Player {
  id: string;  // channel_name - unique per WebSocket connection
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

