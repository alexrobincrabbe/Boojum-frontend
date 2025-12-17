export type WordClue = {
  word: string;
  clue_1: string;
  clue_2: string;
  clue_3: string;
  date: string;
};

export const getTodayString = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const getClue = (wordClue: WordClue, step: number) => {
  switch (step) {
    case 1:
      return wordClue.clue_1;
    case 2:
      return wordClue.clue_2;
    case 3:
      return wordClue.clue_3;
    default:
      return "";
  }
};

export const getSuccessMessage = (stage: number, guessCount: number): string => {
  const msg: Record<number, Record<number, string>> = {
    1: {
      1: "Like a phoenix in sequins: you rose, you shone, you dazzled us all!",
      2: "Got it in two! That's success with a side of dramatic flair!",
      3: "Almost out of guesses, but you pulled the rabbit out of the hat!",
    },
    2: {
      1: "You outshone the stars, you twinkling gem of greatness!",
      2: "You made it! With style, suspense and a twirl of brilliance!",
      3: "Third guess wizardry - because suspense makes success sweeter!",
    },
    3: {
      1: "You danced through that like a disco ball on a sugar rush!",
      2: "You fumbled once, but then came back like a fabulous boomerang!",
      3: "Down to the wire and you still dazzled - what a finish!",
    },
  };

  return msg[stage]?.[guessCount] ?? "Congratulations! You solved it!";
};

export const isLetterMatch = (word: string, guess: string | undefined, index: number) => {
  if (!guess || guess.length <= index) return false;
  return guess.toUpperCase()[index] === word.toUpperCase()[index];
};

