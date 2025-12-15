import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GameBoard } from '../game-room/components/GameBoard';
import { WordCounters } from '../game-room/components/WordCounters';
import { WordLists } from '../game-room/components/WordLists';
import { calculateWordScore } from '../game-room/utils/scoreCalculation';
import { lobbyAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { playBloop } from '../../utils/sounds';
import '../game-room/GameRoom.css';
import './TimelessBoardGameRoom.css';

interface TimelessBoardData {
  board_letters: string[][];
  board_words: string[];
  words_by_length: Record<string, string[]>;
  boojum?: number[][];
  time_remaining_seconds: number;
  hints_remaining?: number;
}

export default function TimelessBoardGameRoom() {
  const { timelessBoardId, level } = useParams<{ timelessBoardId: string; level: string }>();
  const navigate = useNavigate();

  const [boardData, setBoardData] = useState<TimelessBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [showSubmitButton, setShowSubmitButton] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hintsRemaining, setHintsRemaining] = useState<number>(0);
  const [hintActive, setHintActive] = useState<boolean>(false);
  const [hintLoading, setHintLoading] = useState<boolean>(false);
  const [hintGlowInitial, setHintGlowInitial] = useState<boolean>(false);
  const [hintActiveGlow, setHintActiveGlow] = useState<boolean>(false);
  const hintApiSucceededRef = useRef<boolean>(false);
  const glowStartTimeRef = useRef<number>(0);
  
  // Local state for colors - timeless boards always use grey mode by default
  // This doesn't affect the global user setting
  const [colorsOff, setColorsOff] = useState<boolean>(true); // Default to grey mode (true = colors off)

  // Offline word tracking
  const [wordsFound, setWordsFound] = useState<Set<string>>(new Set());
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({
    '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0
  });
  const [wordCountMax, setWordCountMax] = useState<Record<string, number>>({
    '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0
  });
  const [wordsByLength, setWordsByLength] = useState<Record<string, string[]>>({});
  
  const totalScoreRef = useRef<number>(0);
  const bestWordRef = useRef<{ word: string; score: number }>({ word: '', score: 0 });
  const totalPossibleScoreRef = useRef<number>(0);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [displayScore, setDisplayScore] = useState<number>(0); // For animated score display
  const animationRunRef = useRef<boolean>(false); // Track if animation has run

  // Load saved state from localStorage
  const loadSavedState = useCallback((boardId: string, currentLevelWords: string[], boojumData: number[][] | undefined, boardLetters: string[][]) => {
    try {
      const saved = localStorage.getItem(`timeless_board_${boardId}`);
      if (saved) {
        const savedData = JSON.parse(saved);
        // Words found are shared across all levels for the same board
        // But we only load words that are valid for the current level
        if (savedData.wordsFound && Array.isArray(savedData.wordsFound)) {
          // Filter to only include words available on current level
          const validWords = savedData.wordsFound.filter((word: string) => 
            currentLevelWords.includes(word.toUpperCase())
          );
          setWordsFound(new Set(validWords));
          
          // Recalculate score and word counts for current level only
          const { boojum, snark } = getBonusLetters(boojumData, boardLetters);
          let levelScore = 0;
          const levelWordCounts: Record<string, number> = {
            '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, '9': 0
          };
          
          validWords.forEach((word: string) => {
            const wordScore = calculateWordScore(word, boojum || '', snark || '');
            levelScore += wordScore;
            const wordLength = word.length;
            const lengthKey = wordLength >= 9 ? '9' : String(wordLength);
            levelWordCounts[lengthKey] = (levelWordCounts[lengthKey] || 0) + 1;
          });
          
          totalScoreRef.current = levelScore;
          setCurrentScore(levelScore);
          setWordCounts(levelWordCounts);
        }
        if (savedData.bestWord) {
          // Only use best word if it's valid for current level
          if (currentLevelWords.includes(savedData.bestWord.word?.toUpperCase() || '')) {
            bestWordRef.current = savedData.bestWord;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load saved state:', error);
    }
  }, []);

  // Save state to localStorage
  // This saves ALL words found across all levels for this board
  const saveState = useCallback((boardId: string, updatedWordsFound?: Set<string>) => {
    try {
      // Use provided words set or fall back to current state
      const wordsToSave = updatedWordsFound || wordsFound;
      
      // Load existing saved state to merge with current level's words
      const existing = localStorage.getItem(`timeless_board_${boardId}`);
      let allWordsFound = new Set<string>();
      let bestWordOverall = bestWordRef.current;
      
      if (existing) {
        try {
          const existingData = JSON.parse(existing);
          if (existingData.wordsFound && Array.isArray(existingData.wordsFound)) {
            allWordsFound = new Set(existingData.wordsFound);
          }
          // Keep the best word overall (highest score across all levels)
          if (existingData.bestWord && existingData.bestWord.score > bestWordOverall.score) {
            bestWordOverall = existingData.bestWord;
          }
        } catch {
          // If parsing fails, start fresh
        }
      }
      
      // Merge current level's words with all saved words
      wordsToSave.forEach(word => allWordsFound.add(word));
      
      const stateToSave = {
        wordsFound: Array.from(allWordsFound), // All words found across all levels
        bestWord: bestWordOverall, // Best word across all levels
        // Note: currentScore and wordCounts are level-specific, so we don't save them globally
      };
      localStorage.setItem(`timeless_board_${boardId}`, JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save state:', error);
    }
  }, [wordsFound]);

  // Fetch board data
  useEffect(() => {
    const fetchBoardData = async () => {
      if (!timelessBoardId || !level) return;
      
      try {
        setLoading(true);
        const data = await lobbyAPI.getTimelessBoardGame(parseInt(timelessBoardId), parseInt(level));
        setBoardData(data);
        setTimeRemaining(data.time_remaining_seconds);
        setHintsRemaining(data.hints_remaining || 0);
        
        // Timeless boards always use grey mode by default (colorsOff = true)
        // This is handled by local state, not global setting
        setColorsOff(true);
        
        // Load saved state for this board, filtering to current level's words
        loadSavedState(timelessBoardId, data.board_words, data.boojum, data.board_letters);
        
        // Initialize word lists - only show words valid for current level
        // Filter wordsByLength to only include words in current level's board_words
        const filteredWordsByLength: Record<string, string[]> = {};
        for (const length in data.words_by_length) {
          const wordsForLength = data.words_by_length[length];
          if (Array.isArray(wordsForLength)) {
            filteredWordsByLength[length] = wordsForLength.filter((word: string) =>
              data.board_words.includes(word.toUpperCase())
            );
          }
        }
        setWordsByLength(filteredWordsByLength);
        
        // Calculate max counts
        const maxCounts: Record<string, number> = {};
        for (const length in data.words_by_length) {
          const key = length === '9+' ? '9' : length;
          maxCounts[key] = data.words_by_length[length].length;
        }
        setWordCountMax(maxCounts);
        
        // Calculate total possible score
        const { boojum, snark } = getBonusLetters(data.boojum, data.board_letters);
        let totalPossible = 0;
        for (const word of data.board_words) {
          totalPossible += calculateWordScore(word, boojum, snark);
        }
        totalPossibleScoreRef.current = totalPossible;
        
        setShowSubmitButton(true);
        
        // Reset animation flag when new board is loaded
        animationRunRef.current = false;
        
        // Animate score bar on load (after state is loaded)
        // Use setTimeout to ensure state updates are complete and only run once
        setTimeout(() => {
          if (!animationRunRef.current) {
            animateScoreOnLoad();
          }
        }, 500);
      } catch (error: unknown) {
        console.error('Error fetching timeless board:', error);
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404 || axiosError.response?.status === 403) {
          toast.error('Board not found or expired');
          navigate('/timeless-boards');
        } else {
          toast.error('Failed to load board');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBoardData();
  }, [timelessBoardId, level, navigate]);

  // Timer countdown
  useEffect(() => {
    if (!boardData || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowSubmitButton(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [boardData, timeRemaining]);

  // Animate score bar counting up on page load
  const animateScoreOnLoad = useCallback(() => {
    // Prevent running animation twice
    if (animationRunRef.current) {
      return;
    }
    animationRunRef.current = true;
    
    const targetScore = totalScoreRef.current;
    if (targetScore === 0) {
      setDisplayScore(0);
      return;
    }
    
    // Start from 0
    setDisplayScore(0);
    
    // Calculate animation: 500 points per second, steps of ~10 points
    const stepSize = 10;
    const stepDuration = (1000 / 500) * stepSize; // Time per step to achieve 500 pts/sec (~20ms per step)
    
    let currentDisplay = 0;
    const interval = setInterval(() => {
      currentDisplay += stepSize;
      if (currentDisplay >= targetScore) {
        currentDisplay = targetScore;
        setDisplayScore(currentDisplay);
        clearInterval(interval);
      } else {
        setDisplayScore(currentDisplay);
      }
    }, stepDuration);
    
    return () => clearInterval(interval);
  }, []);

  // Update wordsByLength when wordsFound changes, filtering by current level
  useEffect(() => {
    if (!boardData) return;
    
    // Filter wordsByLength to only show words found that are valid for current level
    const filteredWordsByLength: Record<string, string[]> = {};
    const foundWordsArray = Array.from(wordsFound);
    
    // Group found words by length, but only include words valid for current level
    foundWordsArray.forEach(word => {
      if (boardData.board_words.includes(word)) {
        const wordLength = word.length;
        const lengthKey = wordLength >= 9 ? '9+' : String(wordLength);
        if (!filteredWordsByLength[lengthKey]) {
          filteredWordsByLength[lengthKey] = [];
        }
        if (!filteredWordsByLength[lengthKey].includes(word)) {
          filteredWordsByLength[lengthKey].push(word);
        }
      }
    });
    
    // Sort each length group
    Object.keys(filteredWordsByLength).forEach(key => {
      filteredWordsByLength[key].sort();
    });
    
    setWordsByLength(filteredWordsByLength);
  }, [wordsFound, boardData]);

  // Helper function to animate letters
  const animateLetters = useCallback((letterElements: Element[], targetElement: HTMLElement) => {
    letterElements.forEach((letterEl, index) => {
      // Get the actual letter container (has data-x, data-y attributes)
      const letterContainer = letterEl as HTMLElement;
      const letterDiv = letterContainer.querySelector('.letValue') as HTMLElement;
      if (!letterDiv) {
        console.log(`[animateLetters] Letter ${index}: No letterDiv found`);
        return;
      }
      
      const delay = index * 60; // Stagger the animations
      
      setTimeout(() => {
        // Get position from the letter container (the tile), not the inner div
        const letterRect = letterContainer.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        
        // Check if letter is visible on screen
        if (letterRect.width === 0 || letterRect.height === 0) {
          console.log(`[animateLetters] Letter ${index}: Letter has zero size`, letterRect);
          return;
        }
        
        // Use fixed positioning - get viewport coordinates (no scroll offset needed)
        const letterX = letterRect.left + (letterRect.width / 2);
        const letterY = letterRect.top + (letterRect.height / 2);
        
        // Target the center of the word element
        const targetX = targetRect.left + (targetRect.width / 2);
        const targetY = targetRect.top + (targetRect.height / 2);
        
        const dx = targetX - letterX;
        const dy = targetY - letterY;
        
        // Log coordinates for debugging
        console.log(`[animateLetters] Letter ${index}:`, {
          letterRect: { left: letterRect.left, top: letterRect.top, width: letterRect.width, height: letterRect.height },
          letterPos: { x: letterX, y: letterY },
          targetRect: { left: targetRect.left, top: targetRect.top, width: targetRect.width, height: targetRect.height },
          targetPos: { x: targetX, y: targetY },
          delta: { dx, dy },
          letterText: letterDiv.textContent?.trim(),
          containerVisible: letterRect.width > 0 && letterRect.height > 0,
          viewport: { width: window.innerWidth, height: window.innerHeight }
        });
        
        // Get font size from the inner letter div
        const letterFontSize = parseFloat(getComputedStyle(letterDiv).fontSize);
        const targetFontSize = parseFloat(getComputedStyle(targetElement).fontSize);
        const scaleFactor = targetFontSize / letterFontSize;
        
        // Clone the inner letter div (the actual letter text)
        const clone = letterDiv.cloneNode(true) as HTMLElement;
        
        // Use fixed positioning relative to viewport
        clone.style.position = 'fixed';
        clone.style.left = `${letterX}px`;
        clone.style.top = `${letterY}px`;
        clone.style.transform = 'translate(-50%, -50%)'; // Center the clone on the starting point
        clone.style.fontSize = `${letterFontSize}px`;
        clone.style.zIndex = '9999';
        clone.style.pointerEvents = 'none';
        clone.style.opacity = '1';
        clone.style.willChange = 'transform, opacity'; // Optimize animation
        
        const color = getComputedStyle(letterDiv).color;
        clone.style.color = color;
        
        // Set the animation transform - this will be applied by the CSS animation
        clone.style.setProperty(
          '--move-transform',
          `translate(${dx}px, ${dy}px) scale(${scaleFactor})`
        );
        
        clone.classList.add('letter-animate');
        document.body.appendChild(clone);
        
        // Force a reflow and start animation
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Verify clone is in DOM and visible
            const cloneRect = clone.getBoundingClientRect();
            console.log(`[animateLetters] Letter ${index} clone position:`, {
              left: clone.style.left,
              top: clone.style.top,
              rect: { left: cloneRect.left, top: cloneRect.top, width: cloneRect.width, height: cloneRect.height }
            });
            
            void clone.offsetWidth; // Force reflow
            clone.classList.add('start');
          });
        });
        
        // Remove after animation
        clone.addEventListener('animationend', () => {
          clone.remove();
        });
      }, delay);
    });
  }, []);

  // Animate letters flying from board to word list
  const animateLettersToWord = useCallback((word: string) => {
    // Get the word element in the word list
    const wordListElement = document.getElementById(`word-length-${word.length >= 9 ? '9+' : word.length}`);
    if (!wordListElement) {
      console.log('[animateLettersToWord] Word list element not found');
      return;
    }
    
    // Find the word element we just added - wait a bit for DOM to update
    setTimeout(() => {
      const wordElements = wordListElement.querySelectorAll('.word');
      const wordUpper = word.toUpperCase();
      
      // Find the exact word element - look for one that starts with the word (to avoid partial matches)
      const targetWordElement = Array.from(wordElements).find(el => {
        const text = (el.textContent || '').trim().toUpperCase();
        // Match if the text starts with the word (word might have score appended like "CAT (5pts)")
        return text.startsWith(wordUpper) || text === wordUpper;
      }) as HTMLElement | undefined;
      
      if (!targetWordElement) {
        console.log('[animateLettersToWord] Target word element not found for word:', word);
        return;
      }
      
      // Get selected letters from the board - look for letters with tile classes
      const boardElement = document.getElementById('board');
      if (!boardElement) {
        console.log('[animateLettersToWord] Board element not found');
        return;
      }
      
      // Find letters that have tile classes (highlighted letters)
      // Look for any tile class (tile-match, tile-partial-match, etc.)
      const selectedLetters = boardElement.querySelectorAll('.letter[class*="tile-"]');
      
      if (selectedLetters.length === 0) {
        // Tile classes are cleared, need to find letters by matching word to board structure
        const wordUpper = word.toUpperCase();
        const allLetters = Array.from(boardElement.querySelectorAll('.letter'));
        
        // Create a map of letter positions
        const letterMap = new Map<string, Array<{ element: Element; x: number; y: number }>>();
        allLetters.forEach(letter => {
          const x = parseInt(letter.getAttribute('data-x') || '0');
          const y = parseInt(letter.getAttribute('data-y') || '0');
          const letterText = (letter.querySelector('.letValue')?.textContent || '').trim().toUpperCase();
          if (!letterMap.has(letterText)) {
            letterMap.set(letterText, []);
          }
          letterMap.get(letterText)!.push({ element: letter, x, y });
        });
        
        // Try to find a valid path for the word
        const findPath = (startX: number, startY: number, wordIndex: number, visited: Set<string>): Element[] | null => {
          if (wordIndex >= wordUpper.length) {
            return [];
          }
          
          const targetLetter = wordUpper[wordIndex];
          const candidates = letterMap.get(targetLetter) || [];
          
          for (const candidate of candidates) {
            const key = `${candidate.x},${candidate.y}`;
            if (visited.has(key)) continue;
            
            // Check if this letter is adjacent to the previous one (or is the first letter)
            if (wordIndex === 0 || 
                (Math.abs(candidate.x - startX) <= 1 && Math.abs(candidate.y - startY) <= 1 && 
                 !(candidate.x === startX && candidate.y === startY))) {
              const newVisited = new Set(visited);
              newVisited.add(key);
              const rest = findPath(candidate.x, candidate.y, wordIndex + 1, newVisited);
              if (rest !== null) {
                return [candidate.element, ...rest];
              }
            }
          }
          
          return null;
        };
        
        // Try starting from each possible position for the first letter
        const firstLetterCandidates = letterMap.get(wordUpper[0]) || [];
        for (const candidate of firstLetterCandidates) {
          const visited = new Set<string>();
          visited.add(`${candidate.x},${candidate.y}`);
          const path = findPath(candidate.x, candidate.y, 1, visited);
          if (path && path.length === wordUpper.length - 1) {
            // Prepend the first letter to the path
            const fullPath = [candidate.element, ...path];
            animateLetters(fullPath, targetWordElement);
            return;
          }
        }
        
        console.log('[animateLettersToWord] Could not find valid path for word:', word);
        return;
      }
      
      // Use the selected letters with tile classes
      // Sort them by their position in the word to ensure correct order
      const sortedLetters = Array.from(selectedLetters).sort((a, b) => {
        // Get the letter text from each element
        const aText = (a.querySelector('.letValue')?.textContent || '').trim().toUpperCase();
        const bText = (b.querySelector('.letValue')?.textContent || '').trim().toUpperCase();
        const wordUpper = word.toUpperCase();
        
        // Find the index of each letter in the word
        let aIndex = -1, bIndex = -1;
        let aUsed = 0, bUsed = 0;
        
        for (let i = 0; i < wordUpper.length; i++) {
          if (wordUpper[i] === aText && aUsed === 0) {
            aIndex = i;
            aUsed++;
          }
          if (wordUpper[i] === bText && bUsed === 0) {
            bIndex = i;
            bUsed++;
          }
        }
        
        return aIndex - bIndex;
      });
      
      animateLetters(sortedLetters, targetWordElement);
    }, 150);
  }, [animateLetters]);

  // Handle word submission (offline validation)
  const handleWordSubmit = useCallback((word: string): void | string => {
    if (!boardData) return;
    
    const upperWord = word.toUpperCase();
    
    // Check if word is already found
    if (wordsFound.has(upperWord)) {
      return; // Already found
    }
    
    // Check if word is in board words
    if (!boardData.board_words.includes(upperWord)) {
      return; // Invalid word
    }
    
    // Play sound for found word
    playBloop(upperWord);
    
    // Calculate score
    const { boojum, snark } = getBonusLetters(boardData.boojum, boardData.board_letters);
    const wordScore = calculateWordScore(upperWord, boojum, snark);
    
    // Note: Hint deactivation is now handled by onExactMatch callback
    // This ensures it deactivates as soon as a word turns green, not on submission
    
    // Add word and get updated set
    const updatedWordsFound = new Set([...wordsFound, upperWord]);
    setWordsFound(updatedWordsFound);
    
    // Update word counts
    const wordLength = upperWord.length;
    const lengthKey = wordLength >= 9 ? '9' : String(wordLength);
    setWordCounts(prev => ({
      ...prev,
      [lengthKey]: (prev[lengthKey] || 0) + 1
    }));
    
    // Update total score
    totalScoreRef.current += wordScore;
    setCurrentScore(totalScoreRef.current);
    setDisplayScore(totalScoreRef.current); // Update display score immediately when new word found
    
    // Update best word
    if (wordScore > bestWordRef.current.score) {
      bestWordRef.current = { word: upperWord, score: wordScore };
    }
    
    // Update words by length for display
    setWordsByLength(prev => {
      const newWordsByLength = { ...prev };
      const lengthKey = wordLength >= 9 ? '9+' : String(wordLength);
      if (!newWordsByLength[lengthKey]) {
        newWordsByLength[lengthKey] = [];
      }
      if (!newWordsByLength[lengthKey].includes(upperWord)) {
        newWordsByLength[lengthKey] = [...newWordsByLength[lengthKey], upperWord].sort();
      }
      return newWordsByLength;
    });
    
    // Save state to localStorage with updated words set
    if (timelessBoardId) {
      saveState(timelessBoardId, updatedWordsFound);
    }
    
    // Trigger fly animation after a short delay to allow word element to be created
    setTimeout(() => {
      animateLettersToWord(upperWord);
    }, 100);
  }, [boardData, wordsFound, animateLettersToWord, timelessBoardId, saveState]);

  // Note: Backend will calculate scores for each level by filtering words appropriately

  // Submit scores for all applicable levels
  const handleSubmitScore = useCallback(async () => {
    if (!boardData || !timelessBoardId || !level || submitting || wordsFound.size === 0) {
      if (wordsFound.size === 0) {
        toast.error('Please find at least one word before submitting');
      }
      return;
    }

    setSubmitting(true);

    try {
      const wordsFoundArray = Array.from(wordsFound);
      const currentLevelNum = parseInt(level);

      // Determine which levels to submit based on current level
      const levelsToSubmit: number[] = [];
      if (currentLevelNum === 10) {
        // Level 10: Submit for all 3 levels
        levelsToSubmit.push(10, 7, 4);
      } else if (currentLevelNum === 7) {
        // Level 7: Submit for level 7 and 4
        levelsToSubmit.push(7, 4);
      } else if (currentLevelNum === 4) {
        // Level 4: Submit only for level 4
        levelsToSubmit.push(4);
      }

      // Calculate and submit scores for each level
      // Backend will filter words by level and calculate score percentage
      const submitPromises = levelsToSubmit.map(async (targetLevel) => {
        // Submit all words found - backend will filter by level and calculate score
        return await lobbyAPI.submitTimelessScore(
          parseInt(timelessBoardId),
          targetLevel,
          {
            score_percentage: 0, // Backend will calculate this
            which_words_found: wordsFoundArray,
            best_word: bestWordRef.current.word || '',
          }
        );
      });

      await Promise.all(submitPromises);
      
      toast.success('Score submitted successfully!');
      navigate(`/timeless-boards?board=${timelessBoardId}`);
    } catch (error: unknown) {
      console.error('Error submitting score:', error);
      const axiosError = error as { response?: { data?: { score_exists?: string; board_expired?: string } } };
      if (axiosError.response?.data?.score_exists === 'yes') {
        toast.error('You have already submitted a score for this board');
        navigate(`/timeless-boards?board=${timelessBoardId}`);
      } else if (axiosError.response?.data?.board_expired === 'yes') {
        toast.error('This board has expired');
        navigate('/timeless-boards');
      } else {
        toast.error('Failed to submit score');
      }
    } finally {
      setSubmitting(false);
    }
  }, [boardData, timelessBoardId, level, wordsFound, navigate, submitting]);

  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, []);

  const handleHintClick = useCallback(async () => {
    if (hintsRemaining <= 0 || hintActive || hintLoading || !timelessBoardId) {
      return;
    }

    // Reset API success flag
    hintApiSucceededRef.current = false;

    // Start glow animation immediately when button is pressed
    glowStartTimeRef.current = Date.now();
    
    // Force animation restart by removing and re-adding the class
    setHintGlowInitial(false);
    // Use requestAnimationFrame to ensure DOM update before re-adding class
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setHintGlowInitial(true);
      });
    });
    
    // After initial glow animation (1100ms), check if we should switch to pulsating glow
    setTimeout(() => {
      console.log('[handleHintClick] Initial glow timeout fired, API succeeded:', hintApiSucceededRef.current);
      // Only remove initial glow if API succeeded and we're adding pulsating glow
      if (hintApiSucceededRef.current) {
        console.log('[handleHintClick] Switching to pulsating glow');
        setHintGlowInitial(false);
        // Force restart pulsating animation
        setHintActiveGlow(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHintActiveGlow(true);
          });
        });
      } else {
        console.log('[handleHintClick] API not succeeded yet, keeping initial glow');
      }
      // If API hasn't succeeded yet, keep the initial glow (it maintains base level glow)
    }, 1100);

    try {
      setHintLoading(true);
      const response = await lobbyAPI.useTimelessHint(parseInt(timelessBoardId));
      setHintsRemaining(response.hints_remaining);
      setHintActive(true);
      hintApiSucceededRef.current = true;
      
      // Temporarily disable grey mode (local state only)
      setColorsOff(false); // Turn off grey mode to show colors
      
      // Clear loading state
      setHintLoading(false);
      
      // Ensure pulsating glow is added after initial animation completes
      const elapsedTime = Date.now() - glowStartTimeRef.current;
      const animationDuration = 1100; // Match CSS animation duration
      
      if (elapsedTime >= animationDuration) {
        // Animation has completed (enough time has passed), switch immediately
        console.log('[handleHintClick] Animation completed, switching to pulsating glow immediately');
        setHintGlowInitial(false);
        // Force restart pulsating animation
        setHintActiveGlow(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHintActiveGlow(true);
          });
        });
      } else {
        // Animation still running, calculate remaining time and switch when it completes
        const remainingTime = animationDuration - elapsedTime;
        console.log('[handleHintClick] Animation still running, will switch in', remainingTime, 'ms');
        setTimeout(() => {
          // Use a ref check to avoid stale closure
          if (hintApiSucceededRef.current) {
            console.log('[handleHintClick] Switching to pulsating glow after animation completes');
            setHintGlowInitial(false);
            // Force restart pulsating animation
            setHintActiveGlow(false);
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                setHintActiveGlow(true);
              });
            });
          }
        }, remainingTime);
      }
    } catch (error: unknown) {
      console.error('Error using hint:', error);
      const axiosError = error as { response?: { data?: { error?: string } } };
      toast.error(axiosError.response?.data?.error || 'Failed to use hint');
      setHintLoading(false);
      
      // Remove glow on error
      setHintGlowInitial(false);
      setHintActiveGlow(false);
    }
  }, [hintsRemaining, hintActive, hintLoading, timelessBoardId]);

  // Callback to deactivate hint when a word turns green
  const handleExactMatch = useCallback((word: string) => {
    if (hintActive) {
      setHintActive(false);
      // Re-enable grey mode (local state only)
      setColorsOff(true);
      // Remove glow from hint button
      setHintGlowInitial(false);
      setHintActiveGlow(false);
    }
  }, [hintActive]);

  // Calculate bonus letters for rendering
  const bonusLetters = boardData ? getBonusLetters(boardData.boojum, boardData.board_letters) : { boojum: '', snark: '' };

  if (loading) {
    return (
      <div className="timeless-game-room loading">
        <div>Loading timeless board...</div>
      </div>
    );
  }

  if (!boardData) {
    return (
      <div className="timeless-game-room">
        <div>Board not found</div>
      </div>
    );
  }


  return (
    <div className="timeless-game-room">
      <div className="timeless-game-header">
        <button 
          className="back-button"
          onClick={() => navigate(`/timeless-boards?board=${timelessBoardId}`)}
        >
          ← Back to Timeless Boards
        </button>
      </div>

      <div className="timer-controls-container">
        <button 
          className={`hint-button ${
            hintActive ? 'hint-active' : 
            hintLoading ? 'hint-activating' : 
            'hint-inactive'
          } ${hintGlowInitial ? 'hint-glow-initial' : ''} ${hintActiveGlow ? 'hint-active-glow' : ''}`}
          id="hints"
          onClick={handleHintClick}
          disabled={hintsRemaining <= 0 || hintActive || hintLoading}
        >
          {hintLoading ? (
            <>
              <span>Activating</span>
            </>
          ) : hintActive ? (
            <>
              <span>Active</span>
            </>
          ) : (
            <>
              <span>Clues:</span>
              <span className="hints-remaining">{hintsRemaining}</span>
            </>
          )}
        </button>
        <div className="timer-display">
          <span className="timer-label">Time remaining:</span>
          <span 
            className={`timer-value ${
              timeRemaining < 1800 ? 'timer-pink' : 
              timeRemaining < 7200 ? 'timer-yellow' : 
              'timer-green'
            }`}
          >
            {formatTime(timeRemaining)}
          </span>
        </div>
        {showSubmitButton && (
          <button
            className="submit-score-button-header"
            onClick={handleSubmitScore}
            disabled={submitting || timeRemaining <= 0}
          >
            {submitting ? 'Submitting...' : 'Submit Score'}
          </button>
        )}
      </div>

      {boardData && (
        <>
          <div className="game-room-container">
            <div className="game-board-section">
              <WordCounters 
                wordCounts={wordCounts}
                wordCountMax={wordCountMax}
                gameStatus="playing"
              />
              <GameBoard
                gameState={{
                  roomId: `timeless_${timelessBoardId}`,
                  gameStatus: 'playing',
                  players: [],
                  currentPlayerId: '',
                  board: boardData.board_letters,
                  boardWords: boardData.board_words,
                  wordsByLength: wordsByLength,
                  gameRoundId: `timeless_${timelessBoardId}_${Date.now()}`,
                }}
                hasBoardBeenShown={true}
                previousBoard={null}
                scoreState={{
                  currentScore: displayScore,
                  totalScore: totalPossibleScoreRef.current,
                }}
                onWordSubmit={handleWordSubmit}
                wordsFound={wordsFound}
                boardWords={boardData.board_words}
                colorsOffOverride={colorsOff}
                onExactMatch={handleExactMatch}
              />
            </div>

            <div className="word-lists-section">
              <WordLists
                wordsByLength={wordsByLength}
                wordsFound={wordsFound}
                gameStatus="playing"
                boojum={bonusLetters.boojum}
                snark={bonusLetters.snark}
              />
            </div>
          </div>

          {timeRemaining <= 0 && (
            <div className="timer-expired-message">
              Time has expired. You can no longer submit your score.
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Helper function to extract bonus letters
function getBonusLetters(boojum: number[][] | undefined, boardLetters: string[][]): { boojum?: string; snark?: string } {
  if (!boojum || !boardLetters) return {};
  
  let boojumLetter: string | undefined;
  let snarkLetter: string | undefined;
  
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const bonusValue = boojum[row]?.[col] || 0;
      const letter = boardLetters[row]?.[col];
      
      if (bonusValue === 1 && !snarkLetter && letter) {
        snarkLetter = letter;
      } else if (bonusValue === 2 && !boojumLetter && letter) {
        boojumLetter = letter;
      }
    }
  }
  
  return { boojum: boojumLetter, snark: snarkLetter };
}
