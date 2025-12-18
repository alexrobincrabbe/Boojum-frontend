import { useRef, useState, useCallback, useEffect } from 'react';
import { playSound } from '../utils/sounds';
import { useBoardTheme } from '../contexts/BoardThemeContext';

interface LetterElement {
  element: HTMLDivElement;
  x: number;
  y: number;
  letter: string;
  index: number;
}

interface SwipeState {
  selectedLetters: LetterElement[];
  lastX: number | null;
  lastY: number | null;
  isMouseDown: boolean;
  tracePath: boolean[];
  tracePathIndexes: Array<[number, number]>;
}

export function useBoardSwipe(
  boardRef: React.RefObject<HTMLDivElement | null>,
  gameStatus: 'waiting' | 'playing' | 'finished' | undefined,
  onWordSubmit?: (word: string) => void,
  boardWords?: string[],
  wordsFound?: Set<string>,
  colorsOffOverride?: boolean, // Override global colorsOff setting (for timeless boards)
  onExactMatch?: (word: string) => void // Callback when a word turns green (exact match found)
) {
  const { darkMode, colorsOff: globalColorsOff } = useBoardTheme();
  // Use override if provided, otherwise use global setting
  const colorsOff = colorsOffOverride !== undefined ? colorsOffOverride : globalColorsOff;
  const [swipeState, setSwipeState] = useState<SwipeState>({
    selectedLetters: [],
    lastX: null,
    lastY: null,
    isMouseDown: false,
    tracePath: Array(16).fill(false),
    tracePathIndexes: [],
  });
  // Track the last letter index that played a sound to prevent duplicate sounds
  const lastSoundIndexRef = useRef<number | null>(null);
  // Ref to track current swipe state for synchronous access
  const swipeStateRef = useRef<SwipeState>({
    selectedLetters: [],
    lastX: null,
    lastY: null,
    isMouseDown: false,
    tracePath: Array(16).fill(false),
    tracePathIndexes: [],
  });
  
  // Keep ref in sync with state
  useEffect(() => {
    swipeStateRef.current = swipeState;
  }, [swipeState]);

  const [currentWord, setCurrentWord] = useState('');
  const svgContainerRef = useRef<SVGSVGElement | null>(null);
  const isMouseDownRef = useRef(false);
  const lastPointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const processedLettersInMoveRef = useRef<Set<number>>(new Set());

  // Get letter container from element
  const getContainerDiv = useCallback((element: Element | null): LetterElement | null => {
    if (!element) return null;
    
    if (element.classList.contains('letter')) {
      const x = parseInt(element.getAttribute('data-x') || '0');
      const y = parseInt(element.getAttribute('data-y') || '0');
      const letter = element.getAttribute('data-letter') || '';
      const index = parseInt(element.getAttribute('data-index') || '0');
      return { element: element as HTMLDivElement, x, y, letter, index };
    } else if (element.parentElement?.classList.contains('letter')) {
      const parent = element.parentElement;
      const x = parseInt(parent.getAttribute('data-x') || '0');
      const y = parseInt(parent.getAttribute('data-y') || '0');
      const letter = parent.getAttribute('data-letter') || '';
      const index = parseInt(parent.getAttribute('data-index') || '0');
      return { element: parent as HTMLDivElement, x, y, letter, index };
    }
    return null;
  }, []);

  // Sample points along a path and check for letters at each point
  // This ensures no letters are missed during fast swipes
  const samplePathForLetters = useCallback((startX: number, startY: number, endX: number, endY: number, callback: (letter: LetterElement | null) => void) => {
    if (!boardRef.current) return;
    
    // Calculate distance to determine number of samples
    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Reset processed letters set for this move
    processedLettersInMoveRef.current.clear();
    
    // Optimization: Skip sampling if movement is very small (less than 5px)
    // Just check the end position directly
    if (distance < 5) {
      const element = document.elementFromPoint(endX, endY);
      const letter = getContainerDiv(element);
      if (letter) {
        processedLettersInMoveRef.current.add(letter.index);
        callback(letter);
      }
      return;
    }
    
    // Sample every 12 pixels to catch all letters (letters are typically 40-60px)
    const stepSize = 12;
    const steps = Math.max(1, Math.ceil(distance / stepSize));
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = startX + dx * t;
      const y = startY + dy * t;
      
      const element = document.elementFromPoint(x, y);
      const letter = getContainerDiv(element);
      
      // Only process each letter once per move event to avoid duplicates
      if (letter && !processedLettersInMoveRef.current.has(letter.index)) {
        processedLettersInMoveRef.current.add(letter.index);
        callback(letter);
      }
    }
  }, [boardRef, getContainerDiv]);

  // Check if letter is adjacent to last selected letter
  const isAdjacent = useCallback((x: number, y: number, lastX: number | null, lastY: number | null): boolean => {
    if (lastX === null || lastY === null) return true; // First letter
    return (
      y >= lastY - 1 &&
      y <= lastY + 1 &&
      x >= lastX - 1 &&
      x <= lastX + 1
    );
  }, []);

  // Check if letter is already selected
  const alreadySelected = useCallback((letter: LetterElement, selectedLetters: LetterElement[]): boolean => {
    return selectedLetters.some(l => l.element === letter.element);
  }, []);

  // Check if letter is currently selected (last letter)
  const currentlySelected = useCallback((x: number, y: number, lastX: number | null, lastY: number | null): boolean => {
    return x === lastX && y === lastY;
  }, []);

  // Check if letter is a previous letter (allowing backtracking)
  const isPreviousLetter = useCallback((letter: LetterElement, selectedLetters: LetterElement[]): boolean => {
    return selectedLetters.length > 1 && 
           selectedLetters.slice(0, -1).some(l => l.element === letter.element);
  }, []);

  // Draw line between two letters
  const drawLine = useCallback((letter1: LetterElement, letter2: LetterElement) => {
    if (!svgContainerRef.current) return;

    // Get bounding rectangles of the letter elements
    const rect1 = letter1.element.getBoundingClientRect();
    const rect2 = letter2.element.getBoundingClientRect();
    
    // Get SVG container's bounding rectangle to calculate relative positions
    const svgRect = svgContainerRef.current.getBoundingClientRect();
    
    // Calculate center points relative to the SVG container
    const x1 = rect1.left + rect1.width / 2 - svgRect.left;
    const y1 = rect1.top + rect1.height / 2 - svgRect.top;
    const x2 = rect2.left + rect2.width / 2 - svgRect.left;
    const y2 = rect2.top + rect2.height / 2 - svgRect.top;

    // Create SVG line element
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1.toString());
    line.setAttribute('y1', y1.toString());
    line.setAttribute('x2', x2.toString());
    line.setAttribute('y2', y2.toString());
    line.setAttribute('stroke', 'white');
    line.setAttribute('stroke-width', '15');
    line.setAttribute('stroke-opacity', '0.3');
    line.setAttribute('stroke-linecap', 'round');
    svgContainerRef.current.appendChild(line);
  }, []);

  // Clear all lines
  const clearLines = useCallback(() => {
    if (svgContainerRef.current) {
      svgContainerRef.current.innerHTML = '';
    }
  }, []);

  // Remove last line
  const removeLine = useCallback(() => {
    if (svgContainerRef.current && svgContainerRef.current.lastElementChild) {
      svgContainerRef.current.removeChild(svgContainerRef.current.lastElementChild);
    }
  }, []);

  // Check if word is an exact match (case-sensitive, matching original)
  const checkMatch = useCallback((word: string, wordsOnBoard: string[]): boolean => {
    return wordsOnBoard.includes(word);
  }, []);

  // Check if word is a partial match (starts with any word on board, case-sensitive)
  const checkPartialMatch = useCallback((word: string, wordsOnBoard: string[]): boolean => {
    return wordsOnBoard.some((listedWord) => listedWord.startsWith(word));
  }, []);

  // Clear all tile colors first (like clearBoard in original)
  const clearTileColors = useCallback(() => {
    if (!boardRef.current) return;
    const letterContainers = boardRef.current.getElementsByClassName('letter');
    for (let i = 0; i < letterContainers.length; i++) {
      const letterEl = letterContainers[i] as HTMLElement;
      // Remove all tile color classes
      letterEl.classList.remove('tile-no-match-dark', 'tile-match-dark', 'tile-partial-match-dark',
        'tile-no-match-light', 'tile-match-light', 'tile-partial-match-light',
        'tile-no-match-grey-dark', 'tile-no-match-grey-light', 'tile-match-grey-light');
    }
  }, [boardRef]);

  // Track last exact match to avoid duplicate callbacks
  const lastExactMatchRef = useRef<string>('');
  
  // Update tile colors based on match status - called synchronously to prevent blinking
  const updateTileColors = useCallback((tracePath: boolean[], word: string, wordsOnBoard: string[], foundWords: Set<string>) => {
    if (!boardRef.current || !wordsOnBoard || wordsOnBoard.length === 0) return;
    
    // Cache letter containers to avoid repeated DOM queries
    const letterContainers = boardRef.current.getElementsByClassName('letter');
    const letterElements: HTMLElement[] = [];
    for (let i = 0; i < letterContainers.length; i++) {
      letterElements.push(letterContainers[i] as HTMLElement);
    }
    
    // Clear all tile colors first (like clearBoard in original) - optimized to use cached elements
    const tileClassesToRemove = [
      'tile-no-match-dark', 'tile-match-dark', 'tile-partial-match-dark',
      'tile-no-match-light', 'tile-match-light', 'tile-partial-match-light',
      'tile-no-match-grey-dark', 'tile-no-match-grey-light', 'tile-match-grey-light'
    ];
    for (const letterEl of letterElements) {
      letterEl.classList.remove(...tileClassesToRemove);
    }
    
    // Filter out found words from available words - only check against words not yet found
    // Check both uppercase and lowercase since foundWords may contain uppercase
    const availableWords = wordsOnBoard.filter(w => 
      !foundWords.has(w.toLowerCase()) && !foundWords.has(w.toUpperCase())
    );
    
    
    const exactMatch = checkMatch(word, availableWords);
    const partialMatch = checkPartialMatch(word, availableWords);
    
    // Call onExactMatch callback when word turns green (exact match found)
    // Only call if it's a new exact match (not already found and different from last)
    if (exactMatch && onExactMatch && word && word !== lastExactMatchRef.current) {
      const upperWord = word.toUpperCase();
      if (!foundWords.has(upperWord) && !foundWords.has(upperWord.toLowerCase())) {
        lastExactMatchRef.current = word;
        onExactMatch(word);
      }
    }
    
    // Reset last exact match if word is no longer an exact match
    if (!exactMatch && lastExactMatchRef.current === word) {
      lastExactMatchRef.current = '';
    }
    
    // Determine tile class based on theme and colors setting
    let tileClass: string;
    const modeSuffix = darkMode ? 'dark' : 'light';
    
    // If the current word is already found
     if (colorsOff) {
      // Grey mode - only show grey for no-match and partial-match, green for exact match
      if (exactMatch) {
        tileClass = `tile-match-${modeSuffix}`; // Green still shown
      } else if (partialMatch) {
        tileClass = `tile-no-match-grey-${modeSuffix}`;
      } else {
        tileClass = `tile-no-match-grey-${modeSuffix}`;
      }
    } else {
      // Color mode - show pink/yellow/green
      if (exactMatch) {
        tileClass = `tile-match-${modeSuffix}`;
      } else if (partialMatch) {
        tileClass = `tile-partial-match-${modeSuffix}`;
      } else {
        tileClass = `tile-no-match-${modeSuffix}`;
      }
    }
    
    // Apply colors only to tiles in tracePath - using cached elements
    for (let i = 0; i < letterElements.length && i < tracePath.length; i++) {
      if (tracePath[i]) {
        letterElements[i].classList.add(tileClass);
      }
    }
  }, [boardRef, checkMatch, checkPartialMatch, darkMode, colorsOff, wordsFound, onExactMatch]);

  // Handle letter touch/click
  const handleLetterTouch = useCallback((letter: LetterElement | null) => {
    if (!letter || gameStatus !== 'playing') return;

    const { x, y } = letter;

    // Use functional state update to always work with latest state
    setSwipeState(prev => {
      const { selectedLetters, lastX, lastY } = prev;
      
      // Check if letter is already selected or is the current last letter
      if (alreadySelected(letter, selectedLetters) || currentlySelected(x, y, lastX, lastY)) {
        // If it's a previous letter (not the last one), allow backtracking
        if (isPreviousLetter(letter, selectedLetters)) {
          // Backtrack: remove letters up to and including this one
          const matchIndex = selectedLetters.findIndex(l => l.element === letter.element);
          if (matchIndex === -1) return prev;

          const lettersToRemove = selectedLetters.length - 1 - matchIndex;
          const newSelected = selectedLetters.slice(0, matchIndex + 1);
          const newTracePath = Array(16).fill(false);
          const newTracePathIndexes = prev.tracePathIndexes.slice(0, matchIndex + 1);
          
          for (const [tx, ty] of newTracePathIndexes) {
            // Calculate index: y + x * 4 (matching original formula)
            const index = ty + tx * 4;
            newTracePath[index] = true;
          }

          // Remove lines for backtracked letters
          for (let i = 0; i < lettersToRemove; i++) {
            removeLine();
          }

          // Redraw lines for remaining letters
          clearLines();
          for (let i = 1; i < newSelected.length; i++) {
            drawLine(newSelected[i - 1], newSelected[i]);
          }

          const word = newSelected.length > 0 ? newSelected.map(l => l.letter).join('') : '';
          
          // Play tick sound when letters are removed (backtracking)
          if (lettersToRemove > 0 && lastSoundIndexRef.current !== letter.index) {
            playSound('tick');
            lastSoundIndexRef.current = letter.index;
          }
          
          // Update tile colors immediately with the new tracePath
          const currentWordsFound = wordsFound || new Set<string>();
          if (boardWords && boardWords.length > 0 && word) {
            updateTileColors(newTracePath, word, boardWords, currentWordsFound);
          }
          
          const newLastX = newSelected.length > 0 ? newSelected[newSelected.length - 1].x : null;
          const newLastY = newSelected.length > 0 ? newSelected[newSelected.length - 1].y : null;
          
          setCurrentWord(word);
          const newState = {
            ...prev,
            selectedLetters: newSelected,
            lastX: newLastX,
            lastY: newLastY,
            tracePath: newTracePath,
            tracePathIndexes: newTracePathIndexes,
          };
          swipeStateRef.current = newState;
          return newState;
        }
        // Letter is already selected or is current - don't add it again
        swipeStateRef.current = prev;
        return prev;
      }
      
      // Letter is not selected - check if it's adjacent (or first letter)
      if (lastX === null || isAdjacent(x, y, lastX, lastY)) {
        // Add letter to word
        const newSelected = [...selectedLetters, letter];
        const newTracePath = [...prev.tracePath];
        // Calculate index using y + x * 4 to match original formula (consistent with backtracking)
        const index = y + x * 4;
        newTracePath[index] = true;
        const newTracePathIndexes = [...prev.tracePathIndexes, [x, y] as [number, number]];

        // Draw line if we have at least 2 letters
        if (newSelected.length > 1) {
          drawLine(newSelected[newSelected.length - 2], newSelected[newSelected.length - 1]);
        }

        // Update word
        const word = newSelected.map(l => l.letter).join('');
        
        // Play tick sound only once per letter when it's added
        if (lastSoundIndexRef.current !== letter.index) {
          playSound('tick');
          lastSoundIndexRef.current = letter.index;
        }
        
        // Update tile colors immediately with the new tracePath
        // This ensures the first letter highlights right away
        const currentWordsFound = wordsFound || new Set<string>();
        if (boardWords && boardWords.length > 0) {
          updateTileColors(newTracePath, word, boardWords, currentWordsFound);
        }
        
        setCurrentWord(word);
        const newState = {
          ...prev,
          selectedLetters: newSelected,
          lastX: x,
          lastY: y,
          tracePath: newTracePath,
          tracePathIndexes: newTracePathIndexes,
        };
        swipeStateRef.current = newState;
        return newState;
      }
      
      // Letter is not adjacent - ignore it
      swipeStateRef.current = prev;
      return prev;
    });
  }, [gameStatus, alreadySelected, currentlySelected, isAdjacent, isPreviousLetter, drawLine, removeLine, clearLines, boardWords, updateTileColors, wordsFound]);

  // Ref to prevent duplicate word submissions
  const isFinalizingRef = useRef(false);
  
  // Finalize word selection
  const finalizeWordSelection = useCallback(() => {
    // Prevent duplicate calls
    if (isFinalizingRef.current) return;
    isFinalizingRef.current = true;
    
    // Clear tile colors immediately
    if (boardRef.current) {
      const letterContainers = boardRef.current.getElementsByClassName('letter');
      for (let i = 0; i < letterContainers.length; i++) {
        const letterEl = letterContainers[i] as HTMLElement;
        letterEl.classList.remove('tile-no-match-dark', 'tile-match-dark', 'tile-partial-match-dark',
          'tile-no-match-light', 'tile-match-light', 'tile-partial-match-light',
          'tile-no-match-grey-dark', 'tile-no-match-grey-light', 'tile-match-grey-light');
      }
    }
    
    // Capture word from current state BEFORE clearing it
    // Use the ref to get the current state synchronously
    const currentState = swipeStateRef.current;
    const word = currentState.selectedLetters.map(l => l.letter).join('');
    const wordToSubmit = currentState.selectedLetters.length > 0 && word ? word : null;
    
    // Clear the state
    const clearedState = {
      selectedLetters: [],
      lastX: null,
      lastY: null,
      isMouseDown: false,
      tracePath: Array(16).fill(false),
      tracePathIndexes: [],
    };
    swipeStateRef.current = clearedState;
    setSwipeState(clearedState);
    
    // Submit word using the captured value
    if (wordToSubmit && onWordSubmit) {
      onWordSubmit(wordToSubmit);
    }
    
    setCurrentWord('');
    clearLines();
    // Reset sound tracking when word is finalized
    lastSoundIndexRef.current = null;
    // Reset exact match tracking when word is finalized
    lastExactMatchRef.current = '';
    // Reset pointer position tracking
    lastPointerPositionRef.current = null;
    processedLettersInMoveRef.current.clear();
    
    // Reset finalizing flag after a short delay to allow state to settle
    setTimeout(() => {
      isFinalizingRef.current = false;
    }, 100);
  }, [onWordSubmit, clearLines, boardRef]);

  // Handle pointer position with path sampling for fast swipes
  const handlePointerPosition = useCallback((clientX: number, clientY: number) => {
    const currentPos = { x: clientX, y: clientY };
    
    // If we have a last position, sample the path between them
    if (lastPointerPositionRef.current) {
      samplePathForLetters(
        lastPointerPositionRef.current.x,
        lastPointerPositionRef.current.y,
        currentPos.x,
        currentPos.y,
        (letter) => {
          if (letter) {
            handleLetterTouch(letter);
          }
        }
      );
    } else {
      // First position - just check current position
      const element = document.elementFromPoint(clientX, clientY);
      const letter = getContainerDiv(element);
      if (letter) {
        handleLetterTouch(letter);
      }
    }
    
    // Update last position
    lastPointerPositionRef.current = currentPos;
  }, [samplePathForLetters, getContainerDiv, handleLetterTouch]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (gameStatus !== 'playing') return;
    e.preventDefault();
    isMouseDownRef.current = true;
    // Reset last position for new swipe
    lastPointerPositionRef.current = { x: e.clientX, y: e.clientY };
    processedLettersInMoveRef.current.clear();
    
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const letter = getContainerDiv(element);
    if (letter) {
      setSwipeState(prev => {
        const newState = { ...prev, isMouseDown: true };
        swipeStateRef.current = newState;
        return newState;
      });
      handleLetterTouch(letter);
    }
  }, [gameStatus, getContainerDiv, handleLetterTouch]);

  // Touch event handlers
  // Note: These are called from direct DOM listeners in GameBoard.tsx with { passive: false }
  // The preventDefault/stopPropagation calls here are safe because they're called from non-passive listeners
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameStatus !== 'playing') return;
    // preventDefault/stopPropagation already called in direct listener, but keep for safety
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (err) {
      // Ignore errors if event is already handled
    }
    const touch = e.touches[0];
    // Reset last position for new swipe
    lastPointerPositionRef.current = { x: touch.clientX, y: touch.clientY };
    processedLettersInMoveRef.current.clear();
    
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const letter = getContainerDiv(element);
    if (letter) {
      handleLetterTouch(letter);
    }
  }, [gameStatus, getContainerDiv, handleLetterTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (gameStatus !== 'playing') return;
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (err) {
      // Ignore errors if event is already handled
    }
    const touch = e.touches[0];
    handlePointerPosition(touch.clientX, touch.clientY);
  }, [gameStatus, handlePointerPosition]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    try {
      e.preventDefault();
      e.stopPropagation();
    } catch (err) {
      // Ignore errors if event is already handled
    }
    // Reset last position
    lastPointerPositionRef.current = null;
    processedLettersInMoveRef.current.clear();
    finalizeWordSelection();
  }, [finalizeWordSelection]);


  // Update SVG container size and attach document-level mouse events
  useEffect(() => {
    if (svgContainerRef.current && boardRef.current) {
      const updateSize = () => {
        if (svgContainerRef.current && boardRef.current) {
          const rect = boardRef.current.getBoundingClientRect();
          svgContainerRef.current.style.width = `${rect.width}px`;
          svgContainerRef.current.style.height = `${rect.height}px`;
        }
      };
      updateSize();
      window.addEventListener('resize', updateSize);

      // Attach document-level mouse events for proper drag handling
      // This matches the original implementation where mouseup is on document
      const handleDocumentMouseMove = (e: MouseEvent) => {
        if (isMouseDownRef.current && gameStatus === 'playing') {
          e.preventDefault();
          handlePointerPosition(e.clientX, e.clientY);
        }
      };
      const handleDocumentMouseUp = (e: MouseEvent) => {
        if (isMouseDownRef.current) {
          e.preventDefault();
          isMouseDownRef.current = false;
          // Reset last position
          lastPointerPositionRef.current = null;
          processedLettersInMoveRef.current.clear();
          setSwipeState(prev => {
        const newState = { ...prev, isMouseDown: false };
        swipeStateRef.current = newState;
        return newState;
      });
          finalizeWordSelection();
        }
      };

      document.addEventListener('mousemove', handleDocumentMouseMove);
      document.addEventListener('mouseup', handleDocumentMouseUp);

      return () => {
        window.removeEventListener('resize', updateSize);
        document.removeEventListener('mousemove', handleDocumentMouseMove);
        document.removeEventListener('mouseup', handleDocumentMouseUp);
      };
    }
  }, [boardRef, gameStatus, getContainerDiv, handleLetterTouch, finalizeWordSelection, handlePointerPosition]);

  return {
    swipeState,
    currentWord,
    svgContainerRef,
    handleMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleLetterTouch, // Export for direct use in touch handlers
    finalizeWordSelection,
  };
}

