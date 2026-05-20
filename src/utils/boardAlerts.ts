import { getTodayString } from '../pages/minigames/utils/cluejum.utils';

export interface BoardSummary {
  date: string;
  played: boolean;
}

export const BOARD_SCORES_UPDATED_EVENT = 'board-scores-updated';

export function notifyBoardScoresUpdated(): void {
  window.dispatchEvent(new CustomEvent(BOARD_SCORES_UPDATED_EVENT));
}

export function dailyBoardNeedsPlay(
  boards: BoardSummary[],
  isAuthenticated: boolean,
): boolean {
  if (!isAuthenticated || boards.length === 0) return false;
  const today = getTodayString();
  const todayBoard = boards.find((b) => b.date === today);
  return todayBoard ? !todayBoard.played : false;
}

export function timelessBoardNeedsPlay(
  boardsByLevel: Record<number, BoardSummary[]>,
  isAuthenticated: boolean,
): boolean {
  if (!isAuthenticated) return false;
  const today = getTodayString();
  for (const level of [4, 7, 10]) {
    const boards = boardsByLevel[level] ?? [];
    const todayBoard = boards.find((b) => b.date === today);
    if (todayBoard && !todayBoard.played) {
      return true;
    }
  }
  return false;
}
