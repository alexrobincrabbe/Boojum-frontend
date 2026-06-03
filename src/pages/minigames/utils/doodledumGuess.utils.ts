export function countDoodleGuessLetters(word: string): number {
  return word.replace(/ /g, '').length;
}

export function createEmptyGuessLetters(word: string): string[] {
  return new Array(countDoodleGuessLetters(word)).fill('');
}

export function assembleDoodleGuess(word: string, letters: string[]): string {
  let letterIndex = 0;
  return word
    .split('')
    .map((ch) => {
      if (ch === ' ') return ' ';
      const letter = letters[letterIndex] ?? '';
      letterIndex += 1;
      return letter;
    })
    .join('');
}

export type DoodleGuessRenderSlot =
  | { kind: 'space'; key: string }
  | { kind: 'letter'; key: string; letterIndex: number };

export function buildDoodleGuessRenderSlots(word: string): DoodleGuessRenderSlot[] {
  let letterIndex = 0;
  return word.split('').map((ch, i) => {
    if (ch === ' ') {
      return { kind: 'space' as const, key: `space-${i}` };
    }
    const slot = { kind: 'letter' as const, key: `letter-${i}`, letterIndex };
    letterIndex += 1;
    return slot;
  });
}

export type DoodleGuessWordGroup = {
  key: string;
  letterIndices: number[];
};

export function buildDoodleGuessWordGroups(word: string): DoodleGuessWordGroup[] {
  const groups: DoodleGuessWordGroup[] = [];
  let letterIndex = 0;

  word.split(' ').forEach((segment, groupIndex) => {
    if (!segment) return;
    const letterIndices: number[] = [];
    for (let i = 0; i < segment.length; i++) {
      letterIndices.push(letterIndex);
      letterIndex += 1;
    }
    groups.push({ key: `word-${groupIndex}`, letterIndices });
  });

  return groups;
}
