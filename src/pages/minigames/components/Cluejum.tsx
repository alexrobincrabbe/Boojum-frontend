import React, { useEffect, useMemo, useRef, useState } from "react";
import { minigamesAPI } from "../../../services/api";
import "./Cluejum.css";
import { getClue, getSuccessMessage, getTodayString, isLetterMatch } from "../utils/cluejum.utils";

type StageStatus = "playing" | "correct" | "failed";

interface WordClue {
  word: string;
  clue_1: string;
  clue_2: string;
  clue_3: string;
  date: string;
}

interface CluejumProps {
  wordClue: WordClue | null;
  definition: {
    word: string;
    definitions: string[];
    answer: number; // 1-based index
    date: string;
  } | null;
  synonym: {
    word: string;
    synonyms: string[];
    answer: number; // 1-based index
    date: string;
  } | null;
}

const typeText = async (el: HTMLElement, text: string, delay = 70): Promise<void> => {
  el.innerHTML = "";
  for (const ch of text) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => setTimeout(res, delay));
    el.innerHTML += ch;
  }
};

const addGlow = (el: HTMLElement | null, color: "green" | "pink") => {
  if (!el) return;
  el.style.animation = "none";
  void el.offsetWidth; // force reflow
  el.style.animation = `${color}TextGlowFade 2s ease-out forwards`;
};

const Cluejum: React.FC<CluejumProps> = ({ wordClue, definition, synonym }) => {
  const [stage, setStage] = useState<number>(1);
  const [loadedFromStorage, setLoadedFromStorage] = useState(false);

  // Stage 1 state
  const [s1Guess, setS1Guess] = useState("");
  const [s1Guesses, setS1Guesses] = useState<string[]>(["", "", ""]); // store each attempt
  const [s1Attempts, setS1Attempts] = useState(0); // 0..3
  const [s1ClueStep, setS1ClueStep] = useState(1); // 1..3
  const [s1Status, setS1Status] = useState<StageStatus>("playing");

  // Stage 2 state
  const [s2Attempts, setS2Attempts] = useState(0);
  const [s2Status, setS2Status] = useState<StageStatus>("playing");
  const [s2WrongSelections, setS2WrongSelections] = useState<Set<number>>(new Set());

  // Stage 3 state
  const [s3Attempts, setS3Attempts] = useState(0);
  const [s3Status, setS3Status] = useState<StageStatus>("playing");
  const [s3WrongSelections, setS3WrongSelections] = useState<Set<number>>(new Set());

  const [showNext, setShowNext] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const clueRefs = useRef<(HTMLDivElement | null)[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => getTodayString(), []);

  // Load minimal progress (stage only)
  useEffect(() => {
    const savedStage = localStorage.getItem(`wordClues-${today}`);
    if (!savedStage) return;
    setLoadedFromStorage(true);
    const saved = parseInt(savedStage, 10);
    if (Number.isNaN(saved) || saved < 1 || saved > 3) return;
    if (saved >= 2) {
      setStage(saved);
      setS1Status("correct");
      if (saved === 3) {
        setS2Status("correct");
        setGameOver(true);
      }
    }
  }, [today]);

  // Focus first input for stage 1
  useEffect(() => {
    if (stage !== 1 || s1Status !== "playing") return;
    const first = document.getElementById("input-1-0") as HTMLInputElement | null;
    if (first) setTimeout(() => first.focus(), 0);
  }, [stage, s1Status]);

  // Track if typing is in progress to prevent double triggers
  const typingInProgress = useRef(false);

  // Type current clue for stage 1
  useEffect(() => {
    if (!wordClue) return;
    if (stage !== 1 || s1Status !== "playing") return;
    const currentEl = clueRefs.current[s1ClueStep - 1];
    if (!currentEl) return;
    
    // Prevent double triggers - if typing is already in progress, don't start again
    if (typingInProgress.current) return;

    // ensure previous clues are populated (no typing)
    clueRefs.current.forEach((el, idx) => {
      if (!el) return;
      if (idx + 1 < s1ClueStep && !el.textContent?.trim()) {
        el.textContent = getClue(wordClue, idx + 1);
      }
    });

    // Only type if the element is empty (prevent re-typing)
    if (currentEl.textContent?.trim()) return;

    typingInProgress.current = true;
    currentEl.textContent = "";
    typeText(currentEl, getClue(wordClue, s1ClueStep), 70).then(() => {
      typingInProgress.current = false;
    });
  }, [stage, s1ClueStep, s1Status, wordClue]);

  // Glow for status
  useEffect(() => {
    let status: StageStatus = "playing";
    if (stage === 1) status = s1Status;
    if (stage === 2) status = s2Status;
    if (stage === 3) status = s3Status;
    if (status !== "playing") addGlow(statusRef.current, status === "correct" ? "green" : "pink");
  }, [stage, s1Status, s2Status, s3Status]);

  // Type end message when game is over
  useEffect(() => {
    if (gameOver && endRef.current) {
      endRef.current.innerHTML = ""; // Clear any existing content
      typeText(endRef.current, "There will be more Cluejums tomorrow", 70);
    }
  }, [gameOver]);

  if (!wordClue || !definition || !synonym) {
    return <div className="yellow" style={{ textAlign: "center" }}>No clues available today.</div>;
  }

  const saveStage = (s: number) => localStorage.setItem(`wordClues-${today}`, String(s));
  const setScore = (s: number, score: number) =>
    localStorage.setItem(`cluejumScore-${today}-${s}`, String(score));

  /* ---------- Stage 1 logic ---------- */
  const handleStage1Submit = () => {
    if (s1Status !== "playing") return;
    if (s1Guess.length !== wordClue.word.length) return;

    const attempt = s1Attempts + 1;
    const correct = s1Guess.toUpperCase() === wordClue.word.toUpperCase();

    setS1Guesses((prev) => {
      const next = [...prev];
      next[s1ClueStep - 1] = s1Guess;
      return next;
    });

    if (correct) {
      setS1Status("correct");
      setShowNext(true);
      saveStage(1);
      setScore(1, attempt);
      if (messageRef.current) typeText(messageRef.current, getSuccessMessage(1, attempt), 70);
      return;
    }

    if (attempt >= 3) {
      setS1Status("failed");
      setShowNext(true);
      saveStage(1);
      setScore(1, 4);
      if (messageRef.current) {
        const text = "The correct answer was: ";
        typeText(messageRef.current, text, 70).then(() => {
          const span = document.createElement("span");
          span.className = "pink";
          span.style.marginLeft = "5px";
          span.innerText = wordClue.word.toUpperCase();
          messageRef.current?.appendChild(span);
        });
      }
      return;
    }

    setS1Attempts(attempt);
    setS1ClueStep((c) => Math.min(c + 1, 3));
    setS1Guess("");
  };

  const handleStage1Backspace = (idx: number) => {
    if (s1Status !== "playing") return;
    if (s1Guess[idx]) {
      const chars = s1Guess.split("");
      chars[idx] = "";
      setS1Guess(chars.join(""));
    } else if (idx > 0) {
      const chars = s1Guess.split("");
      chars[idx - 1] = "";
      setS1Guess(chars.join(""));
      const prev = document.getElementById(
        `input-1-${s1ClueStep}-${idx - 1}`
      ) as HTMLInputElement | null;
      prev?.focus();
    }
  };

  // Focus first input when a new clue row becomes active
  useEffect(() => {
    if (stage !== 1 || s1Status !== "playing") return;
    const first = document.getElementById(
      `input-1-${s1ClueStep}-0`
    ) as HTMLInputElement | null;
    if (first) setTimeout(() => first.focus(), 0);
  }, [stage, s1Status, s1ClueStep]);

  /* ---------- Stage 2 logic ---------- */
  const handleStage2Choice = (idx: number) => {
    if (stage !== 2 || s2Status !== "playing") return;
    const attempt = s2Attempts + 1;
    const correct = idx + 1 === definition.answer;

    if (correct) {
      setS2Status("correct");
      setShowNext(true);
      saveStage(2);
      setScore(2, attempt);
      if (messageRef.current) typeText(messageRef.current, getSuccessMessage(2, attempt), 70);
      return;
    }

    if (attempt >= 3) {
      setS2Status("failed");
      setS2WrongSelections((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
      setShowNext(true);
      saveStage(2);
      setScore(2, 4);
      if (messageRef.current) {
        const text = "The correct answer was: ";
        const correctWord = definition.definitions[definition.answer - 1] || definition.word;
        typeText(messageRef.current, text, 70).then(() => {
          const span = document.createElement("span");
          span.className = "pink";
          span.style.marginLeft = "5px";
          span.innerText = correctWord.toUpperCase();
          messageRef.current?.appendChild(span);
        });
      }
      return;
    }

    setS2Attempts(attempt);
    setS2WrongSelections((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  /* ---------- Stage 3 logic ---------- */
  const handleStage3Choice = (idx: number) => {
    if (stage !== 3 || s3Status !== "playing") return;
    const attempt = s3Attempts + 1;
    const correct = idx + 1 === synonym.answer;

    if (correct) {
      setS3Status("correct");
      setShowNext(false); // Explicitly hide continue button for stage 3
      setGameOver(true);
      saveStage(3);
      setScore(3, attempt);
      if (messageRef.current) typeText(messageRef.current, getSuccessMessage(3, attempt), 70);
      // Attempt to submit achievement
      const s1Score = Number(localStorage.getItem(`cluejumScore-${today}-1`)) || attempt;
      const s2Score = Number(localStorage.getItem(`cluejumScore-${today}-2`)) || attempt;
      minigamesAPI.setCluejumAchievement(s1Score, s2Score, attempt).catch(console.error);
      return;
    }

    if (attempt >= 3) {
      setS3Status("failed");
      setS3WrongSelections((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
      setShowNext(false); // Explicitly hide continue button for stage 3
      setGameOver(true);
      saveStage(3);
      setScore(3, 4);
      if (messageRef.current) {
        const text = "The correct answer was: ";
        const correctWord = synonym.synonyms[synonym.answer - 1] || synonym.word;
        typeText(messageRef.current, text, 70).then(() => {
          const span = document.createElement("span");
          span.className = "pink";
          span.style.marginLeft = "5px";
          span.innerText = correctWord.toUpperCase();
          messageRef.current?.appendChild(span);
        });
      }
      return;
    }

    setS3Attempts(attempt);
    setS3WrongSelections((prev) => {
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  /* ---------- Next ---------- */
  const handleNext = () => {
    if (stage === 1 && s1Status !== "playing") {
      setStage(2);
      setShowNext(false);
      if (messageRef.current) messageRef.current.innerHTML = "";
    } else if (stage === 2 && s2Status !== "playing") {
      setStage(3);
      setShowNext(false);
      if (messageRef.current) messageRef.current.innerHTML = "";
    }
  };

  /* ---------- Render ---------- */
  // If completed previously (loaded) and gameOver, render only the end message
  if (gameOver && loadedFromStorage) {
    return (
      <div id="word-clues">
        <div
          ref={endRef}
          id="word-game-over"
          className="yellow"
          style={{
            textAlign: "center",
            fontSize: "140%",
            fontWeight: "bold",
            marginTop: 32,
          }}
        />
      </div>
    );
  }

  return (
    <div id="word-clues">
      <>
      {/* Stage 1: typed guesses */}
      {stage === 1 && (
        <div className="word-clue-container" id="word-clue-container-1">
          {[1, 2, 3].slice(0, s1ClueStep).map((stepIdx) => {
            const isActive = s1Status === "playing" && stepIdx === s1ClueStep;
            const guessString =
              stepIdx === s1ClueStep ? s1Guess : s1Guesses[stepIdx - 1] || "";
            return (
              <div key={stepIdx} style={{ marginBottom: 12 }}>
                <div
                  className="clue"
                  id={`word-clue-1-${stepIdx}`}
                  ref={(el) => {
                    clueRefs.current[stepIdx - 1] = el;
                  }}
                  style={{ minHeight: 50 }}
                />
                <div className="word-clue-guess-container">
                  <div className="word-clue-guess">
                    {wordClue.word.split("").map((_, i) => {
                      const isResolved = s1Status !== "playing" || !isActive;
                      const match = isResolved && isLetterMatch(wordClue.word, guessString, i);
                      const wrong = isResolved && guessString[i] && !match;
                      const className = match 
                        ? "letter-input letter-match" 
                        : wrong 
                        ? "letter-input letter-wrong" 
                        : "letter-input";
                      return (
                        <input
                          key={`${stepIdx}-${i}`}
                          id={`input-1-${stepIdx}-${i}`}
                          type="text"
                          maxLength={1}
                          className={className}
                          value={guessString[i] || ""}
                          disabled={!isActive}
                          onChange={(e) => {
                            if (!isActive) return;
                            const chars = guessString.split("");
                            chars[i] = e.target.value.toUpperCase();
                            setS1Guess(chars.join(""));
                            if (e.target.value && i < wordClue.word.length - 1) {
                              const next = document.getElementById(
                                `input-1-${stepIdx}-${i + 1}`
                              ) as HTMLInputElement | null;
                              next?.focus();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (!isActive) return;
                            if (e.key === "Backspace") {
                              e.preventDefault();
                              handleStage1Backspace(i);
                            }
                          }}
                          onKeyUp={(e) => {
                            if (!isActive) return;
                            if (e.key === "Enter") handleStage1Submit();
                          }}
                        />
                      );
                    })}
                    {isActive && (
                      <img
                        id="submit-1"
                        className="enter-button"
                        src="/images/enter-button.svg"
                        alt="Submit"
                        onClick={handleStage1Submit}
                        style={{ cursor: "pointer" }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stage 2: definitions */}
      {stage === 2 && (
        <div className="word-clue-container" id="word-clue-container-2">
          <div className="clue" id="word-clue-2" style={{ minHeight: 50, textAlign: "center" }}>
            {definition.word}
          </div>
          <div className="word-clue-guess-container">
            <div className="word-clue-guess">
              {definition.definitions.map((opt, idx) => {
                const correctIdx = definition.answer - 1;
                const isCorrectPick = s2Status === "correct" && idx === correctIdx;
                const isWrongPick = s2WrongSelections.has(idx);
                return (
                  <div
                    key={idx}
                    className={`word-clue-option${isCorrectPick ? " option-correct" : ""}${
                      isWrongPick ? " option-wrong" : ""
                    }`}
                    onClick={() => handleStage2Choice(idx)}
                    style={{
                      cursor: s2Status === "playing" ? "pointer" : "default",
                    }}
                  >
                    {opt}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stage 3: synonyms */}
      {stage === 3 && (
        <div className="word-clue-container" id="word-clue-container-3">
          <div className="clue" id="word-clue-3" style={{ minHeight: 50, textAlign: "center" }}>
            {synonym.word}
          </div>
          <div className="word-clue-guess-container">
            <div className="word-clue-guess">
              {synonym.synonyms.map((opt, idx) => {
                const correctIdx = synonym.answer - 1;
                const isCorrectPick = s3Status === "correct" && idx === correctIdx;
                const isWrongPick = s3WrongSelections.has(idx);
                return (
                  <div
                    key={idx}
                    className={`word-clue-option${isCorrectPick ? " option-correct" : ""}${
                      isWrongPick ? " option-wrong" : ""
                    }`}
                    onClick={() => handleStage3Choice(idx)}
                    style={{
                      cursor: s3Status === "playing" ? "pointer" : "default",
                    }}
                  >
                    {opt}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      {(() => {
        let status: StageStatus = "playing";
        if (stage === 1) status = s1Status;
        if (stage === 2) status = s2Status;
        if (stage === 3) status = s3Status;
        if (status === "playing") return null;
        return (
          <div
            ref={statusRef}
            className={status === "correct" ? "green" : "pink"}
            style={{
              display: "flex",
              justifyContent: "center",
              fontSize: "140%",
              fontWeight: "bold",
              marginTop: 24,
              minHeight: 40,
            }}
          >
            {status === "correct" ? "CORRECT" : "INCORRECT"}
          </div>
        );
      })()}

      <div
        ref={messageRef}
        className="blue"
        style={{ textAlign: "center", marginTop: 12, minHeight: 28, fontSize: "1.2em" }}
      />

      {/* Next button */}
      {showNext && stage < 3 && (
        <button
          id="next-button"
          onClick={handleNext}
          className="cluejum-next"
        >
          Continue
        </button>
      )}

      {/* End message (shows immediately when finishing final stage this session) */}
      {gameOver && (
        <div
          ref={endRef}
          id="word-game-over"
          className="yellow"
          style={{
            textAlign: "center",
            fontSize: "140%",
            fontWeight: "bold",
            marginTop: 32,
          }}
        />
      )}
      </>
    </div>
  );
};

export default Cluejum;

