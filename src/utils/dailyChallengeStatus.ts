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

const boojumbleSolvedKey = (id: number) => `minigames-solved-${id}`;

function normalizeSolutionWord(line: unknown): string {
  if (typeof line === 'string') return line.trim().toUpperCase();
  if (Array.isArray(line)) {
    return line.map((c) => String(c)).join('').trim().toUpperCase();
  }
  return '';
}

function normalizeSolution(solution: unknown, n: number): string[] {
  if (!Array.isArray(solution)) return [];
  return solution.slice(0, n).map(normalizeSolutionWord);
}

export function markBoojumbleSolved(boojumbleId: number): void {
  localStorage.setItem(boojumbleSolvedKey(boojumbleId), 'true');
}

export function isBoojumbleSolvedFromGrid(boojumble: BoojumbleStatus): boolean {
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
      const letter = flatLetters[i * boojumble.N + j];
      currentLetters[i].push(
        typeof letter === 'string' ? letter.trim().toUpperCase() : '',
      );
    }
  }

  const rowWords: string[] = [];

  for (let i = 0; i < boojumble.N; i++) {
    rowWords.push(currentLetters[i].join(''));
  }

  const rows = normalizeSolution(boojumble.rows, boojumble.N);
  const cols = normalizeSolution(boojumble.cols, boojumble.N);

  return isBoojumbleWordsSolved(rowWords, rows, cols, boojumble.N);
}

/** Original orientation or the transpose (the UI treats both as solved). */
export function isBoojumbleWordsSolved(
  rowWords: string[],
  rows: string[],
  cols: string[],
  n: number,
): boolean {
  if (rows.length !== n || cols.length !== n || rowWords.length !== n) {
    return false;
  }
  const currentRows = rowWords.map((word) => word.trim().toUpperCase());
  const solutionRows = rows.map((word) => word.trim().toUpperCase());
  const solutionCols = cols.map((word) => word.trim().toUpperCase());
  const original = currentRows.every((word, idx) => word === solutionRows[idx]);
  const transposed = currentRows.every((word, idx) => word === solutionCols[idx]);
  return original || transposed;
}

export function isBoojumbleSolved(boojumble: BoojumbleStatus): boolean {
  if (localStorage.getItem(boojumbleSolvedKey(boojumble.id)) === 'true') {
    return true;
  }
  return isBoojumbleSolvedFromGrid(boojumble);
}

export function areAllBoojumblesSolved(boojumbles: BoojumbleStatus[]): boolean {
  if (boojumbles.length === 0) return true;
  return boojumbles.every(isBoojumbleSolved);
}

export function isCluejumSolved(puzzleDate?: string | null): boolean {
  if (!puzzleDate) return false;
  return localStorage.getItem(`wordClues-${puzzleDate}`) === '3';
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

export function cluejumNeedsAttention(
  hasWordClue: boolean,
  puzzleDate?: string | null,
): boolean {
  return hasWordClue && !isCluejumSolved(puzzleDate);
}

export const DAILY_CHALLENGES_UPDATED_EVENT = 'daily-challenges-updated';

export function notifyDailyChallengesUpdated(): void {
  window.dispatchEvent(new CustomEvent(DAILY_CHALLENGES_UPDATED_EVENT));
}
