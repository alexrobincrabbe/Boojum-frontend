export interface BoardSummary {
  date: string;
  played: boolean;
}

export const BOARD_SCORES_UPDATED_EVENT = 'board-scores-updated';

export function notifyBoardScoresUpdated(): void {
  window.dispatchEvent(new CustomEvent(BOARD_SCORES_UPDATED_EVENT));
}

/** @deprecated Prefer server-side /api/daily-boards/alerts/ — uses current board from API, not local date */
export function dailyBoardNeedsPlay(
  boards: BoardSummary[],
  isAuthenticated: boolean,
): boolean {
  if (!isAuthenticated || boards.length === 0) return false;
  const currentBoard = boards[0];
  return currentBoard ? !currentBoard.played : false;
}

/** @deprecated Prefer server-side /api/daily-boards/alerts/ — uses current board from API, not local date */
export function timelessBoardNeedsPlay(
  boardsByLevel: Record<number, BoardSummary[]>,
  isAuthenticated: boolean,
): boolean {
  if (!isAuthenticated) return false;
  for (const level of [4, 7, 10]) {
    const boards = boardsByLevel[level] ?? [];
    const currentBoard = boards[0];
    if (currentBoard && !currentBoard.played) {
      return true;
    }
  }
  return false;
}
