import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { GameBoard } from '../game-room/components/GameBoard';
import { WordCounters } from '../game-room/components/WordCounters';
import { WordLists } from '../game-room/components/WordLists';
import { calculateWordScore } from '../game-room/utils/scoreCalculation';
import { lobbyAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { playBloop, playSound } from '../../utils/sounds';
import { triggerBoardAnimation, triggerWordCounterAnimation } from '../game-room/utils/borderAnimation';

// Helper function to show "Perfect!" message
const showPerfect = (elementId: string) => {
  // Try to find the board element (could be #board, #daily-board, or #timeless-board)
  const element = document.getElementById(elementId) || 
                  document.getElementById('board') || 
                  document.getElementById('daily-board') || 
                  document.getElementById('timeless-board');
  if (!element) {
    console.warn('[showPerfect] Board element not found');
    return;
  }
  
  const rect = element.getBoundingClientRect();
  const perfect = document.createElement('div');
  perfect.className = 'perfect-text';
  perfect.textContent = 'Perfect!';
  perfect.classList.add('yellow');
  Object.assign(perfect.style, {
    position: 'absolute',
    top: `${window.scrollY + rect.top}px`,
    left: `${window.scrollX + rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '200%',
    fontWeight: 'bold',
    textShadow: '0 0 10px rgba(255, 255, 255, 0.7)',
    opacity: '1',
    transition: 'opacity 3s ease-out',
    zIndex: '9998',
    pointerEvents: 'none',
  });
  document.body.appendChild(perfect);
  
  // Fade out after 2 seconds
  setTimeout(() => {
    perfect.style.opacity = '0';
    perfect.addEventListener('transitionend', () => perfect.remove(), { once: true });
  }, 2000);
};

// Helper function to add looping arrows around submit button
  const addLoopingArrows = (selector: string, delay: number = 1000) => {
  const el = document.querySelector(selector);
  if (!el) {
    console.warn('[addLoopingArrows] Button element not found with selector:', selector);
    return;
  }

  // Clean up any existing arrows first
  const existingArrows = document.querySelectorAll('.animated-arrow');
  existingArrows.forEach(arrow => arrow.remove());

  const rect = el.getBoundingClientRect();

  console.log('[addLoopingArrows] Found button, creating arrows:', {
    selector,
    rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
  });

  setTimeout(() => {
    ['left', 'right'].forEach((side) => {
      const a = document.createElement('div');
      a.classList.add('animated-arrow', `arrow-${side}`);
      // ← for right label, → for left label (pointing toward center)
      a.textContent = side === 'left' ? '🡺' : '🡸';

      // Vertical centering
      const top = window.scrollY + rect.top + rect.height / 2;
      a.style.top = `${top}px`;

      // Horizontal position: further out by arrowOffset
      let left: number;
      if (side === 'left') {
        left = window.scrollX + rect.left - 34;
      } else {
        left = window.scrollX + rect.right;
      }
      a.style.left = `${left}px`;

      // Set additional required styles
      a.style.position = 'absolute';
      a.style.zIndex = '10000';
      a.style.color = '#f5ce45';
      a.style.textShadow = '0 0 10px rgba(245, 206, 69, 0.8)';

      console.log(`[addLoopingArrows] Creating ${side} arrow at:`, { top, left });
      document.body.appendChild(a);
    });
  }, delay);
};

// Helper function to create shatter effect
const shatter = (elementId: string, rows: number = 10, cols: number = 10) => {
  // Try to find the board element (could be #board, #daily-board, or #timeless-board)
  const element = document.getElementById(elementId) || 
                  document.getElementById('board') || 
                  document.getElementById('daily-board') || 
                  document.getElementById('timeless-board');
  if (!element) {
    console.warn('[shatter] Board element not found');
    return;
  }
  
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  element.style.visibility = 'hidden';
  
  const maxDist = Math.hypot(rect.width, rect.height);
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Create the shard
      const shard = document.createElement('div');
      shard.className = 'shard';
      shard.style.width = `${rect.width / cols}px`;
      shard.style.height = `${rect.height / rows}px`;
      shard.style.top = `${window.scrollY + rect.top + r * (rect.height / rows)}px`;
      shard.style.left = `${window.scrollX + rect.left + c * (rect.width / cols)}px`;
      shard.style.position = 'absolute';
      shard.style.overflow = 'hidden';
      shard.style.transition = 'transform 3s ease-out, opacity 3s ease-out';
      shard.style.pointerEvents = 'none';
      shard.style.opacity = '0';
      
      // Inner piece that shows the right slice
      const inner = document.createElement('div');
      inner.style.position = 'absolute';
      inner.style.width = `${rect.width}px`;
      inner.style.height = `${rect.height}px`;
      inner.style.top = `${-r * (rect.height / rows)}px`;
      inner.style.left = `${-c * (rect.width / cols)}px`;
      
      if (style.backgroundImage !== 'none') {
        inner.style.backgroundImage = style.backgroundImage;
        inner.style.backgroundSize = style.backgroundSize;
        inner.style.backgroundRepeat = style.backgroundRepeat;
        inner.style.backgroundPosition = style.backgroundPosition;
      } else {
        inner.style.backgroundColor = style.backgroundColor;
      }
      inner.innerHTML = element.innerHTML;
      
      shard.appendChild(inner);
      document.body.appendChild(shard);
      
      // Pick a random direction and rotation
      const angle = Math.random() * Math.PI * 2;
      const distance = maxDist * (0.7 + Math.random() * 0.3);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const rot = (Math.random() - 0.5) * 90;
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        shard.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
        shard.style.opacity = '1';
      });
      
      // Cleanup
      shard.addEventListener('transitionend', () => shard.remove(), { once: true });
    }
  }
};
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
  const { user } = useAuth();

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
        // Note: wordCounts are level-specific, so we don't save them globally
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

  // Helper function to animate letters - matches original animateLetterClone from tracks-swipe.js
  const animateLetters = useCallback((letterElements: Element[], targetElement: HTMLElement) => {
    letterElements.forEach((letterEl, index) => {
      // Get the actual letter container (has data-x, data-y attributes)
      const letterContainer = letterEl as HTMLElement;
      const letterDiv = letterContainer.querySelector('.letValue') as HTMLElement;
      if (!letterDiv) {
        console.log(`[animateLetters] Letter ${index}: No letterDiv found`);
        return;
      }
      
      const delay = index * 10; // Stagger the animations (matches original delayBetween = 10)
      
      setTimeout(() => {
        // Get bounding rectangles - matches original implementation
        const letterRect = letterDiv.getBoundingClientRect();
        const targetRect = targetElement.getBoundingClientRect();
        
        if (!letterRect || !targetRect) {
          console.log(`[animateLetters] Letter ${index}: Missing rects`, { letterRect, targetRect });
          return;
        }
        
        // Get scroll offsets - matches original
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        
        // Log scroll and rect info
        console.log(`[animateLetters] Letter ${index} - Before calculation:`, {
          letterText: letterDiv.textContent?.trim(),
          letterRect: {
            left: letterRect.left,
            top: letterRect.top,
            right: letterRect.right,
            bottom: letterRect.bottom,
            width: letterRect.width,
            height: letterRect.height
          },
          targetRect: {
            left: targetRect.left,
            top: targetRect.top,
            right: targetRect.right,
            bottom: targetRect.bottom,
            width: targetRect.width,
            height: targetRect.height
          },
          scroll: { scrollX, scrollY },
          viewport: { width: window.innerWidth, height: window.innerHeight }
        });
        
        // Calculate absolute positions including scroll - matches original
        const letterX = letterRect.left + scrollX;
        const letterY = letterRect.top + scrollY;
        const targetX = targetRect.left + scrollX;
        const targetY = targetRect.top + scrollY;
        
        // Calculate delta - matches original (dy has -30 offset)
        const dx = targetX - letterX;
        const dy = targetY - letterY - 30;
        
        // Get font sizes and calculate scale factor - matches original
        const letterFontSize = parseFloat(getComputedStyle(letterDiv).fontSize);
        const targetFontSize = parseFloat(getComputedStyle(targetElement).fontSize);
        const scaleFactor = targetFontSize / letterFontSize;
        
        console.log(`[animateLetters] Letter ${index} - Calculated positions:`, {
          letterX,
          letterY,
          targetX,
          targetY,
          dx,
          dy,
          letterFontSize,
          targetFontSize,
          scaleFactor,
          letterContainerRect: letterContainer.getBoundingClientRect(),
          letterDivRect: letterRect
        });
        
        // Clone the letter element - matches original
        // Create a fresh span element instead of cloning to avoid inherited styles
        const clone = document.createElement('span');
        clone.textContent = letterDiv.textContent;
        
        // Reset all layout properties to prevent expansion - the clone should be inline size
        clone.style.position = 'absolute';
        clone.style.left = `${letterX}px`;
        clone.style.top = `${letterY}px`;
        clone.style.fontSize = `${letterFontSize}px`;
        clone.style.zIndex = '9999';
        clone.style.pointerEvents = 'none';
        clone.style.opacity = '0';
        clone.style.width = 'auto';
        clone.style.height = 'auto';
        clone.style.minWidth = 'auto';
        clone.style.minHeight = 'auto';
        clone.style.maxWidth = 'none';
        clone.style.maxHeight = 'none';
        clone.style.display = 'inline-block';
        clone.style.boxSizing = 'content-box';
        clone.style.margin = '0';
        clone.style.padding = '0';
        clone.style.border = 'none';
        clone.style.lineHeight = '1';
        clone.style.verticalAlign = 'baseline';
        clone.style.whiteSpace = 'nowrap';
        
        // Copy font family and weight from original
        const computedStyle = getComputedStyle(letterDiv);
        clone.style.fontFamily = computedStyle.fontFamily;
        clone.style.fontWeight = computedStyle.fontWeight;
        clone.style.color = computedStyle.color;
        
        // Set the CSS custom property for transform - matches original
        clone.style.setProperty(
          '--move-transform',
          `translate(${dx}px, ${dy}px) scale(${scaleFactor})`
        );
        
        clone.classList.add('letter-animate');
        document.body.appendChild(clone);
        
        // Log after appending to DOM
        const cloneRect = clone.getBoundingClientRect();
        console.log(`[animateLetters] Letter ${index} - After appending clone:`, {
          cloneStyle: {
            position: clone.style.position,
            left: clone.style.left,
            top: clone.style.top,
            fontSize: clone.style.fontSize,
            opacity: clone.style.opacity
          },
          cloneRect: {
            left: cloneRect.left,
            top: cloneRect.top,
            width: cloneRect.width,
            height: cloneRect.height
          },
          expectedPosition: { letterX, letterY },
          actualPosition: { left: cloneRect.left, top: cloneRect.top },
          difference: {
            x: cloneRect.left - letterRect.left,
            y: cloneRect.top - letterRect.top
          }
        });
        
        // Force reflow and start animation - matches original
        setTimeout(() => {
          void clone.offsetWidth; // Force reflow
          clone.classList.add('start');
          
          // Log after starting animation
          const cloneRectAfter = clone.getBoundingClientRect();
          console.log(`[animateLetters] Letter ${index} - After starting animation:`, {
            cloneRect: {
              left: cloneRectAfter.left,
              top: cloneRectAfter.top,
              width: cloneRectAfter.width,
              height: cloneRectAfter.height
            },
            hasStartClass: clone.classList.contains('start')
          });
        }, delay);
        
        // Remove after animation - matches original
        clone.addEventListener('animationend', () => {
          console.log(`[animateLetters] Letter ${index} - Animation ended`);
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
    
    // Play twinkle (pop) sound and trigger board animation if word is 8+ letters
    if (upperWord.length >= 8) {
      playSound("pop");
      triggerBoardAnimation();
    }
    
    // Add word and get updated set
    const updatedWordsFound = new Set([...wordsFound, upperWord]);
    setWordsFound(updatedWordsFound);
    
    // Update word counts
    const wordLength = upperWord.length;
    const lengthKey = wordLength >= 9 ? '9' : String(wordLength);
    setWordCounts(prev => {
      if (lengthKey in wordCountMax) {
        const newCount = (prev[lengthKey] || 0) + 1;
        const max = wordCountMax[lengthKey] || 0;
        const percentage = max > 0 ? newCount / max : 0;

        // Play twinkle (pop) sound and trigger word counter animation based on word count conditions:
        // 1. Word length < 8 AND count >= 50%: Play pop and animate
        // 2. Count == 100%: Play pop and animate (regardless of word length)
        if (upperWord.length < 8 && percentage >= 0.5) {
          // Condition: Half or more words found for words < 8
          playSound("pop");
          triggerWordCounterAnimation(lengthKey, percentage === 1);
        } else if (percentage === 1) {
          // Condition: All words of this length found (100%) - play pop and animate regardless of length
          playSound("pop");
          triggerWordCounterAnimation(lengthKey, true);
        }

        return { ...prev, [lengthKey]: newCount };
      }
      return prev;
    });
    
    // Update total score
    totalScoreRef.current += wordScore;
    const newTotalScore = totalScoreRef.current;
    setDisplayScore(newTotalScore); // Update display score immediately when new word found
    
    // Update best word
    if (wordScore > bestWordRef.current.score) {
      bestWordRef.current = { word: upperWord, score: wordScore };
    }
    
    // Check if board is completed
    const isComplete = newTotalScore >= totalPossibleScoreRef.current;
    const currentLevel = level ? parseInt(level) : 0;
    const isHardestLevel = currentLevel === 10;
    
    // Show completion effects
    if (isComplete) {
      if (isHardestLevel) {
        // Shatter effect on multiple elements for hardest level - staggered timing
        const timeDelay = 300;
        
        // Shatter rotate buttons first
        setTimeout(() => {
          shatter('rotate-buttons', 3, 10);
          playSound('perfect');
        }, 0);
        
        // Shatter word counters
        setTimeout(() => {
          shatter('word-counters', 8, 2);
          playSound('perfect');
        }, timeDelay * 2);
        
        // Shatter timer bar container (points bar)
        setTimeout(() => {
          shatter('timer-bar-container', 2, 20);
          playSound('perfect');
        }, timeDelay * 4);
        
        // Shatter board last
        setTimeout(() => {
          shatter('board', 10, 10);
          playSound('perfect');
        }, timeDelay * 8);
        
        // Show perfect message and arrows after board shatters
        setTimeout(() => {
          showPerfect('board');
          playSound('perfect');
          
          // Add looping arrows around submit button for authenticated users
          // Appears slightly after perfect text (after 500ms delay)
          if (user) {
            setTimeout(() => {
              addLoopingArrows('.submit-score-button-header', 0);
            }, 500);
          }
        }, timeDelay * 10);
      } else {
        // Just show perfect message for other levels
        setTimeout(() => {
          showPerfect('board');
          playSound('perfect');
          
          // Add looping arrows around submit button for authenticated users
          // Appears slightly after perfect text (after 500ms delay)
          if (user) {
            setTimeout(() => {
              addLoopingArrows('.submit-score-button-header', 0);
            }, 500);
          }
        }, 100);
      }
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
  }, [boardData, wordsFound, wordCountMax, animateLettersToWord, timelessBoardId, saveState]);

  // Note: Backend will calculate scores for each level by filtering words appropriately

  // Submit scores for all applicable levels
  const handleSubmitScore = useCallback(async () => {
    if (!boardData || !timelessBoardId || !level || submitting || wordsFound.size === 0) {
      if (wordsFound.size === 0) {
        toast.error('Please find at least one word before submitting');
      }
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to submit your score?\n\n` +
      `Words found: ${wordsFound.size}\n` +
      `Score: ${displayScore} points\n\n` +
      `Once submitted, you cannot change your score for this board.`
    );

    if (!confirmed) {
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
  }, [boardData, timelessBoardId, level, wordsFound, navigate, submitting, displayScore]);

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
  const handleExactMatch = useCallback((_word: string) => {
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


  // Get level name and color
  const getLevelInfo = () => {
    const currentLevelNum = level ? parseInt(level) : 10;
    if (currentLevelNum === 4) return { name: 'Curious', color: 'var(--color-green)' };
    if (currentLevelNum === 7) return { name: 'Curiouser', color: 'var(--color-pink)' };
    return { name: 'Rabbit Hole', color: 'var(--color-purple)' };
  };

  const levelInfo = getLevelInfo();

  return (
    <div className="timeless-game-room">
      {/* Back button */}
      <div className="timeless-game-back-container">
        <div className="pagination-left-container">
          <button 
            className="pagination-btn" 
            onClick={() => navigate(`/timeless-boards?board=${timelessBoardId}`)}
            aria-label="Back to Timeless Boards"
          >
          </button>
          <span className="pagination-text">Back to Timeless Boards</span>
        </div>
      </div>

      <h1 className="timeless-game-level-title" style={{ color: levelInfo.color }}>
        {levelInfo.name}
      </h1>

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
