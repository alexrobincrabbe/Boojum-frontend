import { useState, useCallback, useEffect, useRef } from 'react';
import { playSound } from '../utils/sounds';
import { useBoardTheme } from '../contexts/BoardThemeContext';

interface UseKeyboardInputParams {
  gameStatus: 'waiting' | 'playing' | 'finished' | undefined;
  board: string[][] | null | undefined;
  boardWords?: string[];
  wordsFound?: Set<string>;
  onWordSubmit?: (word: string) => void;
  onTracePathUpdate?: (tracePath: boolean[]) => void;
  onTileColorsUpdate?: (exactMatch: boolean, partialMatch: boolean, alreadyFound: boolean) => void;
  onRecordKeyboardWord?: (word: string, tracePath: boolean[]) => void;
  colorsOffOverride?: boolean; // Override global colorsOff setting (for timeless boards)
  onExactMatch?: (word: string) => void; // Callback when letters turn green (exact match found)
}

export function useKeyboardInput({
  gameStatus,
  board,
  boardWords,
  wordsFound,
  onWordSubmit,
  onTracePathUpdate,
  onTileColorsUpdate,
  onRecordKeyboardWord,
  colorsOffOverride,
  onExactMatch,
}: UseKeyboardInputParams) {
  const { darkMode, colorsOff: colorsOffFromContext } = useBoardTheme();
  // Use override if provided, otherwise use context value
  const colorsOff = colorsOffOverride !== undefined ? colorsOffOverride : colorsOffFromContext;
  const [currentWord, setCurrentWord] = useState('');
  const [tracePath, setTracePath] = useState<boolean[]>(Array(16).fill(false));
  const currentWordRef = useRef('');
  const boardRef = useRef(board);
  const lastExactMatchRef = useRef<string>(''); // Track last exact match word, matching swipe implementation

  // Keep refs in sync
  useEffect(() => {
    currentWordRef.current = currentWord;
  }, [currentWord]);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Check if player is chatting (input field is focused)
  const checkIfPlayerIsChatting = useCallback((): boolean => {
    const activeElement = document.activeElement;
    if (!activeElement) return false;
    
    const tagName = activeElement.tagName.toLowerCase();
    const isInput = tagName === 'input' || tagName === 'textarea';
    if (!isInput) return false;
    
    // Check if it's a chat input by ID
    const id = activeElement.id || '';
    if (id.includes('chat') || id.includes('message')) {
      return true;
    }
    
    // Check if input is within a chat section (game room chat or lobby chat)
    const chatSection = activeElement.closest('.chat-section, .sidebar-chat');
    if (chatSection) {
      return true;
    }
    
    // Check if input has a chat-related class
    const className = activeElement.className || '';
    if (className.includes('chat') || className.includes('message')) {
      return true;
    }
    
    return false;
  }, []);

  // Check if word matches exactly (against available words only)
  const checkMatch = useCallback((word: string, availableWords: string[]): boolean => {
    if (!word || !availableWords || availableWords.length === 0) return false;
    return availableWords.includes(word);
  }, []);

  // Check if word is a partial match (starts with any available word, case-sensitive)
  const checkPartialMatch = useCallback((word: string, availableWords: string[]): boolean => {
    if (!word || !availableWords || availableWords.length === 0) return false;
    return availableWords.some(w => w.startsWith(word));
  }, []);

  // Check if word is already found
  const checkAlreadyFound = useCallback((word: string): boolean => {
    if (!word || !wordsFound) return false;
    return wordsFound.has(word.toLowerCase());
  }, [wordsFound]);

  // Update tile colors based on match status
  const updateTileColors = useCallback((word: string, tracePathArray: boolean[]) => {
    // Filter out found words from available words - only check against words not yet found
    // This matches the logic in useBoardSwipe.ts exactly
    const availableWords = boardWords ? boardWords.filter(
      (w) => !wordsFound?.has(w.toLowerCase()) && !wordsFound?.has(w.toUpperCase())
    ) : [];
    
    const exactMatch = checkMatch(word, availableWords);
    const partialMatch = checkPartialMatch(word, availableWords);

    // Call onExactMatch when letters turn green - matching swipe implementation exactly
    if (exactMatch && onExactMatch && word && word !== lastExactMatchRef.current) {
      const upper = word.toUpperCase();
      if (!wordsFound?.has(upper) && !wordsFound?.has(upper.toLowerCase())) {
        lastExactMatchRef.current = word;
        onExactMatch(word);
      }
    }

    // Reset lastExactMatchRef if exactMatch becomes false for the current word
    if (!exactMatch && lastExactMatchRef.current === word) {
      lastExactMatchRef.current = '';
    }

    // Apply tile colors directly to DOM elements
    if (board && board.length > 0) {
      const letterContainers = document.getElementsByClassName('letter');
      for (let i = 0; i < letterContainers.length; i++) {
        const letterEl = letterContainers[i] as HTMLElement;
        // Clear existing tile color classes
        letterEl.classList.remove('tile-no-match-dark', 'tile-match-dark', 'tile-partial-match-dark',
          'tile-no-match-light', 'tile-match-light', 'tile-partial-match-light',
          'tile-no-match-grey-dark', 'tile-no-match-grey-light', 'tile-match-grey-light');
        
        // Apply color if in trace path
        if (tracePathArray[i]) {
          let tileClass: string;
          const modeSuffix = darkMode ? 'dark' : 'light';
          
          // Match the exact logic from useBoardSwipe.ts
          if (colorsOff) {
            // Grey mode - green for exact match, grey for no match
            tileClass = exactMatch ? `tile-match-${modeSuffix}` : `tile-no-match-grey-${modeSuffix}`;
          } else {
            // Color mode - green for exact match, yellow for partial, pink for no match
            if (exactMatch) {
              tileClass = `tile-match-${modeSuffix}`;
            } else if (partialMatch) {
              tileClass = `tile-partial-match-${modeSuffix}`;
            } else {
              tileClass = `tile-no-match-${modeSuffix}`;
            }
          }
          letterEl.classList.add(tileClass);
        }
      }
    }

    if (onTileColorsUpdate) {
      const alreadyFound = checkAlreadyFound(word);
      onTileColorsUpdate(exactMatch, partialMatch, alreadyFound);
    }
  }, [board, boardWords, wordsFound, checkMatch, checkPartialMatch, checkAlreadyFound, onTileColorsUpdate, colorsOff, darkMode, onExactMatch]);

  // Re-apply tile colors when colorsOff changes (e.g., when clue is activated/deactivated)
  useEffect(() => {
    if (currentWord && tracePath.some(v => v)) {
      // Re-apply colors with the new colorsOff value
      updateTileColors(currentWord, tracePath);
    }
  }, [colorsOff, darkMode, currentWord, tracePath, updateTileColors]);

  // Search board recursively to find valid paths
  const searchBoard = useCallback((word: string) => {
    if (!board || !word) {
      const emptyTracePath = Array(16).fill(false);
      setTracePath(emptyTracePath);
      updateTileColors('', emptyTracePath);
      if (onTracePathUpdate) {
        onTracePathUpdate(emptyTracePath);
      }
      return;
    }

    const rows = 4;
    const columns = 4;
    if (word.length > rows * columns) {
      const emptyTracePath = Array(16).fill(false);
      setTracePath(emptyTracePath);
      updateTileColors('', emptyTracePath);
      if (onTracePathUpdate) {
        onTracePathUpdate(emptyTracePath);
      }
      return;
    }

    const visited: boolean[][] = Array.from(Array(4), () => new Array(4).fill(false));
    const newTracePath: boolean[] = Array(16).fill(false);

    const searchBoardRecursive = (
      lastRow: number,
      lastCol: number,
      searchString: string,
      word: string,
      localVisited: boolean[][]
    ) => {
      localVisited[lastRow][lastCol] = true;
      const letter = board[lastRow][lastCol]?.toUpperCase() || '';
      searchString = searchString + letter;

      if (checkStringMatch(searchString, word)) {
        newTracePath[lastCol + lastRow * columns] = true;
      }

      const adjacentRows = [lastRow - 1, lastRow, lastRow + 1];
      const adjacentCols = [lastCol - 1, lastCol, lastCol + 1];

      for (const nextRow of adjacentRows) {
        if (nextRow < 0 || nextRow >= rows) continue;
        for (const nextCol of adjacentCols) {
          if (nextCol < 0 || nextCol >= columns) continue;
          const stringMatch = checkStringMatch(searchString, word);
          if (!localVisited[nextRow][nextCol] && stringMatch) {
            // Create a copy of visited for this branch
            const branchVisited = localVisited.map(row => [...row]);
            searchBoardRecursive(nextRow, nextCol, searchString, word, branchVisited);
          }
        }
      }
    };

    const checkStringMatch = (searchString: string, word: string): boolean => {
      return searchString === word.substring(0, searchString.length);
    };

    // Start search from each position
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const localVisited = visited.map(row => [...row]);
        searchBoardRecursive(row, column, '', word, localVisited);
      }
    }

    setTracePath(newTracePath);
    if (onTracePathUpdate) {
      onTracePathUpdate(newTracePath);
    }
    
    // Record keyboard word event
    if (onRecordKeyboardWord && word) {
      onRecordKeyboardWord(word, newTracePath);
    }
    
    // Update tile colors after tracePath is set
    updateTileColors(word, newTracePath);
  }, [board, onTracePathUpdate, updateTileColors, onRecordKeyboardWord]);

  // Add letter to word
  const addLetter = useCallback((key: string) => {
    setCurrentWord((prev) => {
      if (prev.length >= 17) return prev;
      
      let newWord: string;
      if (key.toUpperCase() === 'Q') {
        newWord = prev + 'QU';
      } else {
        newWord = prev + key.toUpperCase();
      }
      
      // Search board (which will update colors)
      setTimeout(() => {
        searchBoard(newWord);
      }, 0);
      
      return newWord;
    });
  }, [searchBoard]);

  // Delete last letter
  const deleteLetter = useCallback(() => {
    setCurrentWord((prev) => {
      if (prev.length === 0) {
        // Clear everything if word is empty
        const emptyTracePath = Array(16).fill(false);
        setTracePath(emptyTracePath);
        updateTileColors('', emptyTracePath);
        if (onTracePathUpdate) {
          onTracePathUpdate(emptyTracePath);
        }
        // Record clear event
        if (onRecordKeyboardWord) {
          onRecordKeyboardWord('', emptyTracePath);
        }
        return prev;
      }
      
      // Handle QU -> Q removal
      let newWord: string;
      if (prev.endsWith('QU')) {
        newWord = prev.slice(0, -2);
      } else {
        newWord = prev.slice(0, -1);
      }
      
      // If word is now empty, clear everything
      if (newWord.length === 0) {
        const emptyTracePath = Array(16).fill(false);
        setTracePath(emptyTracePath);
        updateTileColors('', emptyTracePath);
        if (onTracePathUpdate) {
          onTracePathUpdate(emptyTracePath);
        }
        // Record clear event
        if (onRecordKeyboardWord) {
          onRecordKeyboardWord('', emptyTracePath);
        }
      } else {
        // Search board (which will update colors and record)
        setTimeout(() => {
          searchBoard(newWord);
        }, 0);
      }
      
      return newWord;
    });
  }, [searchBoard, updateTileColors, onTracePathUpdate, onRecordKeyboardWord]);

  // Clear word
  const clearWord = useCallback(() => {
    setCurrentWord('');
    const emptyTracePath = Array(16).fill(false);
    setTracePath(emptyTracePath);
    
    // Reset lastExactMatchRef when word is cleared - matching swipe implementation
    lastExactMatchRef.current = '';
    
    // Clear tile colors
    if (board && board.length > 0) {
      const letterContainers = document.getElementsByClassName('letter');
      for (let i = 0; i < letterContainers.length; i++) {
        const letterEl = letterContainers[i] as HTMLElement;
        letterEl.classList.remove('tile-no-match-dark', 'tile-match-dark', 'tile-partial-match-dark',
          'tile-no-match-light', 'tile-match-light', 'tile-partial-match-light',
          'tile-no-match-grey-dark', 'tile-no-match-grey-light', 'tile-match-grey-light');
      }
    }
    
    if (onTracePathUpdate) {
      onTracePathUpdate(emptyTracePath);
    }
    
    // Record clear event
    if (onRecordKeyboardWord) {
      onRecordKeyboardWord('', emptyTracePath);
    }
  }, [onTracePathUpdate, board, onRecordKeyboardWord]);

  // Handle keyboard input
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const gameInProgress = gameStatus === 'playing';
    const playerIsChatting = checkIfPlayerIsChatting();
    const backspace = event.key === 'Backspace' && currentWordRef.current.length > 0;
    const letterKey = event.key.length === 1 && /[a-zA-Z]/.test(event.key);
    const enterKey = event.key === 'Enter';

    if (gameInProgress && !playerIsChatting) {
      switch (true) {
        case backspace:
          event.preventDefault();
          deleteLetter();
          playSound('tick');
          break;
        case letterKey:
          event.preventDefault();
          addLetter(event.key);
          playSound('tick');
          break;
        case enterKey:
          event.preventDefault();
          const word = currentWordRef.current;
          if (word && onWordSubmit) {
            onWordSubmit(word);
          }
          clearWord();
          break;
      }
    }
  }, [gameStatus, checkIfPlayerIsChatting, addLetter, deleteLetter, clearWord, onWordSubmit]);

  // Set up keyboard event listener
  useEffect(() => {
    if (gameStatus === 'playing') {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [gameStatus, handleKeyDown]);

  // Clear word when game status changes
  useEffect(() => {
    if (gameStatus !== 'playing') {
      clearWord();
    }
  }, [gameStatus, clearWord]);

  return {
    currentWord,
    tracePath,
    clearWord,
  };
}

