/**
 * Score calculation utilities matching the original Django implementation
 */

interface LetterTiers {
  onePoint: string[];
  twoPoints: string[];
  threePoints: string[];
  fourPoints: string[];
  fivePoints: string[];
  eightPoints: string[];
  tenPoints: string[];
}

function defineLetterTiers(): LetterTiers {
  return {
    onePoint: ['A', 'E', 'I', 'O', 'U', 'L', 'N', 'S', 'T', 'R'],
    twoPoints: ['D', 'G'],
    threePoints: ['B', 'C', 'M', 'P'],
    fourPoints: ['F', 'H', 'V', 'W', 'Y'],
    fivePoints: ['K'],
    eightPoints: ['J', 'X'],
    tenPoints: ['Q', 'Z'],
  };
}

function getLetterScore(letter: string, letterTiers: LetterTiers, snark?: string): number {
  const upperLetter = letter.toUpperCase();
  let letterScore = 0;
  
  if (letterTiers.onePoint.includes(upperLetter)) {
    letterScore = 1;
  } else if (letterTiers.twoPoints.includes(upperLetter)) {
    letterScore = 2;
  } else if (letterTiers.threePoints.includes(upperLetter)) {
    letterScore = 3;
  } else if (letterTiers.fourPoints.includes(upperLetter)) {
    letterScore = 4;
  } else if (letterTiers.fivePoints.includes(upperLetter)) {
    letterScore = 5;
  } else if (letterTiers.eightPoints.includes(upperLetter)) {
    letterScore = 8;
  } else if (letterTiers.tenPoints.includes(upperLetter)) {
    letterScore = 10;
  }
  
  // Double score if letter is snark
  if (snark && upperLetter === snark.toUpperCase()) {
    letterScore *= 2;
  }
  
  return letterScore;
}

function getWordScore(word: string, snark?: string): number {
  const letterTiers = defineLetterTiers();
  let wordScore = 0;
  
  for (const letter of word) {
    wordScore += getLetterScore(letter, letterTiers, snark);
  }
  
  return wordScore;
}

function getWordScoreMultiplier(word: string, boojum?: string): number {
  let multiplier = 0;
  
  if (word.length === 3) {
    multiplier = 1;
  } else {
    multiplier = word.length - 3;
  }
  
  // Double multiplier if word contains boojum
  if (boojum && word.toUpperCase().includes(boojum.toUpperCase())) {
    multiplier *= 2;
  }
  
  return multiplier;
}

export function calculateWordScore(word: string, boojum?: string, snark?: string): number {
  const wordScore = getWordScore(word, snark);
  const multiplier = getWordScoreMultiplier(word, boojum);
  return wordScore * multiplier;
}

