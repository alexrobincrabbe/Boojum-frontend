import { getTodayString } from '../pages/minigames/utils/cluejum.utils';

export interface BoojumbleStatus {
  id: number;
  N: number;
  rows: string[];
  cols: string[];
}

export interface DoodledumCheckData {
  is_doodledum: string;
  is_drawn: string;
  is_current_user_drawing?: boolean;
  drawer?: string | null;
}

export function isBoojumbleSolved(boojumble: BoojumbleStatus): boolean {
  const storedLetters = localStorage.getItem(`minigames-${boojumble.id}`);
  if (!storedLetters) return false;

  let flatLetters: string[];
  try {
    flatLetters = JSON.parse(storedLetters);
  } catch {
    return false;
  }

  if (!Array.isArray(flatLetters) || flatLetters.length !== boojumble.N * boojumble.N) {
    return false;
  }

  const currentLetters: string[][] = [];
  for (let i = 0; i < boojumble.N; i++) {
    currentLetters.push([]);
    for (let j = 0; j < boojumble.N; j++) {
      currentLetters[i].push(flatLetters[i * boojumble.N + j] || '');
    }
  }

  const rowWords: string[] = [];
  const colWords: string[] = [];

  for (let i = 0; i < boojumble.N; i++) {
    rowWords.push(currentLetters[i].join(''));
  }

  for (let j = 0; j < boojumble.N; j++) {
    let colWord = '';
    for (let i = 0; i < boojumble.N; i++) {
      colWord += currentLetters[i][j] || '';
    }
    colWords.push(colWord);
  }

  const rows = Array.isArray(boojumble.rows) ? boojumble.rows : [];
  const cols = Array.isArray(boojumble.cols) ? boojumble.cols : [];

  return (
    rowWords.every((word, idx) => word === rows[idx]) ||
    colWords.every((word, idx) => word === cols[idx])
  );
}

export function areAllBoojumblesSolved(boojumbles: BoojumbleStatus[]): boolean {
  if (boojumbles.length === 0) return true;
  return boojumbles.every(isBoojumbleSolved);
}

export function isCluejumSolved(today = getTodayString()): boolean {
  return localStorage.getItem(`wordClues-${today}`) === '3';
}

export function needsDoodledumGuess(
  data: DoodledumCheckData,
  username?: string | null,
): boolean {
  if (data.is_doodledum !== 'yes' || data.is_drawn !== 'yes') {
    return false;
  }

  if (data.is_current_user_drawing) {
    return false;
  }

  if (username && data.drawer && data.drawer.toLowerCase() === username.toLowerCase()) {
    return false;
  }

  return true;
}

export function boojumbleNeedsAttention(boojumbles: BoojumbleStatus[]): boolean {
  return boojumbles.length > 0 && !areAllBoojumblesSolved(boojumbles);
}

export function cluejumNeedsAttention(hasWordClue: boolean): boolean {
  return hasWordClue && !isCluejumSolved();
}

export const DAILY_CHALLENGES_UPDATED_EVENT = 'daily-challenges-updated';

export function notifyDailyChallengesUpdated(): void {
  window.dispatchEvent(new CustomEvent(DAILY_CHALLENGES_UPDATED_EVENT));
}
