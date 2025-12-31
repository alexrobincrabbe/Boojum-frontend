import React, { useState, useEffect, useRef, type JSX } from 'react';
import { minigamesAPI } from '../../../services/api';
import { playSound } from '../../../utils/sounds';
import './Boojumble.css';

interface BoojumbleData {
  id: number;
  title: string;
  scrambled: string[][] | any;
  rows: string[];
  cols: string[];
  N: number;
  date: string;
}

interface BoojumbleProps {
  boojumbles: BoojumbleData[];
}

const Boojumble: React.FC<BoojumbleProps> = ({ boojumbles }) => {
  const [selectedLevel, setSelectedLevel] = useState<number>(3);
  const [letters, setLetters] = useState<{ [key: number]: string[][] }>({});
  const boardRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const dragInitialized = useRef<{ [key: number]: boolean }>({});

  // Initialize letters for all boojumbles
  useEffect(() => {
    if (boojumbles.length === 0) return;
    
    setLetters(prev => {
      const newLetters: { [key: number]: string[][] } = { ...prev };
      let hasChanges = false;
      
      boojumbles.forEach(boojumble => {
        // Check if saved state exists for this board first (use board id for unique identification)
        const storedLetters = localStorage.getItem(`minigames-${boojumble.id}`);
        
        // If saved state exists, use it; otherwise use scrambled data
        if (storedLetters && !newLetters[boojumble.N]) {
          try {
            const savedLetters = JSON.parse(storedLetters);
            if (Array.isArray(savedLetters) && savedLetters.length === boojumble.N * boojumble.N) {
              const savedGrid: string[][] = [];
              for (let i = 0; i < boojumble.N; i++) {
                savedGrid.push([]);
                for (let j = 0; j < boojumble.N; j++) {
                  const idx = i * boojumble.N + j;
                  savedGrid[i].push(savedLetters[idx] || '');
                }
              }
              newLetters[boojumble.N] = savedGrid;
              hasChanges = true;
            }
          } catch (e) {
            console.error('Failed to parse stored letters:', e);
          }
        }
        
        // Only use scrambled data if no saved state exists and no letters for this board
        if (!newLetters[boojumble.N] && boojumble.scrambled) {
          let scrambled = boojumble.scrambled;
       
          
          if (typeof scrambled === 'string') {
            try {
              scrambled = JSON.parse(scrambled);
            } catch (e) {
              console.error('Failed to parse scrambled:', e);
              scrambled = [];
            }
          }
          
          if (!Array.isArray(scrambled)) {
            console.warn(`Scrambled is not an array for board ${boojumble.N}:`, scrambled);
            scrambled = [];
          }
          
          const initialLetters: string[][] = [];
          for (let i = 0; i < boojumble.N; i++) {
            if (scrambled[i]) {
              if (Array.isArray(scrambled[i])) {
                // Already an array, use it
                initialLetters.push([...scrambled[i]]);
              } else if (typeof scrambled[i] === 'string') {
                // String like "EOLTE" - split into characters
                initialLetters.push(scrambled[i].split(''));
              } else {
                // Unknown type, create empty row
                initialLetters.push(new Array(boojumble.N).fill(''));
              }
            } else {
              // No data for this row, create empty row
              initialLetters.push(new Array(boojumble.N).fill(''));
            }
          }
          
        
          newLetters[boojumble.N] = initialLetters;
          hasChanges = true;
        }
      });
      
      return hasChanges ? newLetters : prev;
    });
  }, [boojumbles]);

  // Note: Words found are loaded directly from localStorage when needed in checkAndInit

  // Initialize drag and drop for the selected board (using original implementation)
  useEffect(() => {
    const currentBoard = boardRefs.current[selectedLevel];
    if (!currentBoard) return;
    
    // Don't re-initialize if already done
    if (dragInitialized.current[selectedLevel]) return;
    
    // Define all variables and functions first
    let draggedElement: HTMLElement | null = null;
    let placeholderElement: HTMLElement | null = null;
    let startX = 0;
    let startY = 0;
    let width = 0;
    let height = 0;
    let overlapTarget: HTMLElement | null = null;
    
    // Define handler functions - these must be defined before cleanup
    const getClientXY = (event: MouseEvent | TouchEvent) => {
      if ('touches' in event && event.touches.length > 0) {
        return {
          clientX: event.touches[0].clientX,
          clientY: event.touches[0].clientY,
          pageX: event.touches[0].pageX,
          pageY: event.touches[0].pageY,
        };
      }
      const e = event as MouseEvent;
      return {
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY,
      };
    };

    const moveAt = (pageX: number, pageY: number) => {
      if (!draggedElement) return;
      draggedElement.style.left = `${pageX - startX}px`;
      draggedElement.style.top = `${pageY - startY}px`;
    };

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const { clientX, clientY, pageX, pageY } = getClientXY(event);
      const target = event.target as HTMLElement;
      // Find the boojumble-letter element - could be clicked directly or on a child
      let letterElement = target.closest('.boojumble-letter') as HTMLElement;
      // If we clicked on a child element, make sure we get the parent letter element
      if (!letterElement && target.parentElement) {
        letterElement = target.parentElement.closest('.boojumble-letter') as HTMLElement;
      }
      if (!letterElement || !currentBoard.contains(letterElement)) return;
      
      event.preventDefault();
      event.stopPropagation();
      
      draggedElement = letterElement;
      // Add dragging class immediately to prevent default active styles
      letterElement.classList.add('dragging');
      
      const rect = letterElement.getBoundingClientRect();
      // Calculate offset from the element's top-left corner to the click point
      startX = clientX - rect.left;
      startY = clientY - rect.top;
      width = rect.width;
      height = rect.height;
      
      // Ensure square aspect ratio (use the larger dimension)
      const size = Math.max(width, height);
      width = size;
      height = size;

      // Insert placeholder at the same position (before the element)
      placeholderElement = document.createElement('div');
      placeholderElement.className = 'placeholder';
      placeholderElement.style.width = `${width}px`;
      placeholderElement.style.height = `${height}px`;
      currentBoard.insertBefore(placeholderElement, letterElement);

      // Lift the letter out of flow - set initial position to match current position
      letterElement.style.position = 'absolute';
      letterElement.style.width = `${width}px`;
      letterElement.style.height = `${height}px`;
      letterElement.style.minWidth = `${width}px`;
      letterElement.style.minHeight = `${height}px`;
      letterElement.style.maxWidth = `${width}px`;
      letterElement.style.maxHeight = `${height}px`;
      letterElement.style.zIndex = '1000';
      letterElement.style.left = `${rect.left + window.scrollX}px`;
      letterElement.style.top = `${rect.top + window.scrollY}px`;
      document.body.appendChild(letterElement);

      // Move to current pointer position
      moveAt(pageX, pageY);

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('touchmove', onPointerMove as any, { passive: false });
      document.addEventListener('touchend', onPointerUp);
      document.addEventListener('touchcancel', onPointerUp);
    };

    const checkOverlap = () => {
      if (!draggedElement || !currentBoard) return;
      
      let bestArea = 0;
      let bestMatch: HTMLElement | null = null;
      const rectDragged = draggedElement.getBoundingClientRect();

      currentBoard.querySelectorAll('.boojumble-letter').forEach((item) => {
        if (item === draggedElement) return;
        // Skip placeholder elements
        if ((item as HTMLElement).classList.contains('placeholder')) return;
        const rectItem = item.getBoundingClientRect();
        const overlapWidth = Math.max(
          0,
          Math.min(rectDragged.right, rectItem.right) - Math.max(rectDragged.left, rectItem.left)
        );
        const overlapHeight = Math.max(
          0,
          Math.min(rectDragged.bottom, rectItem.bottom) - Math.max(rectDragged.top, rectItem.top)
        );
        if (overlapWidth >= width / 2 && overlapHeight >= height / 2) {
          const area = overlapWidth * overlapHeight;
          if (area > bestArea) {
            bestArea = area;
            bestMatch = item as HTMLElement;
          }
        }
      });

      if (overlapTarget && overlapTarget !== bestMatch) {
        (overlapTarget as HTMLElement).querySelector('.letter-child')?.classList.remove('highlight');
      }
      if (bestMatch) {
        (bestMatch as HTMLElement).querySelector('.letter-child')?.classList.add('highlight');
      }
      overlapTarget = bestMatch;
    };

    const highlightRowsAndColumns = () => {
      if (!currentBoard) return;
      
      const currentBoojumble = boojumbles.find(b => b.N === selectedLevel);
      if (!currentBoojumble || !currentBoojumble.rows || !currentBoojumble.cols) return;

      // Read current grid words from DOM
      const letterTiles = Array.from(currentBoard.querySelectorAll('.boojumble-letter') as NodeListOf<HTMLElement>);
      const rowWords: string[] = [];
      const colWords: string[] = [];

      // Build row words
      for (let row = 0; row < selectedLevel; row++) {
        let word = '';
        for (let col = 0; col < selectedLevel; col++) {
          const idx = row * selectedLevel + col;
          const tile = letterTiles[idx] as HTMLElement;
          if (tile) {
            const letterValue = tile.querySelector('.letValue');
            word += letterValue?.textContent?.trim() || '';
          }
        }
        rowWords.push(word);
      }

      // Build column words
      for (let col = 0; col < selectedLevel; col++) {
        let word = '';
        for (let row = 0; row < selectedLevel; row++) {
          const idx = row * selectedLevel + col;
          const tile = letterTiles[idx] as HTMLElement;
          if (tile) {
            const letterValue = tile.querySelector('.letValue');
            word += letterValue?.textContent?.trim() || '';
          }
        }
        colWords.push(word);
      }

      const rows = Array.isArray(currentBoojumble.rows) ? currentBoojumble.rows : [];
      const cols = Array.isArray(currentBoojumble.cols) ? currentBoojumble.cols : [];
      
      // Clear all highlights first
      letterTiles.forEach(tile => {
        const letterChild = tile.querySelector('.letter-child');
        if (letterChild) {
          letterChild.classList.remove('match-present', 'match-correct', 'shimmer');
        }
      });
      
      // Track newly found words for shimmer effect (use board id for unique identification)
      if (!currentBoojumble) return;
      const storedWordsFoundKey = `minigames-words-${currentBoojumble.id}`;
      const previouslyFoundWordsStr = localStorage.getItem(storedWordsFoundKey);
      const previouslyFoundWords: string[] = previouslyFoundWordsStr ? JSON.parse(previouslyFoundWordsStr) : [];
      const newlyFoundWords: string[] = [];
      const tilesToShimmer = new Set<HTMLElement>();

      // Track which tiles should be green (correct position) vs yellow (valid word, wrong position)
      const correctTiles = new Set<HTMLElement>();
      const presentTiles = new Set<HTMLElement>();
      // Track tiles to shimmer with their order for staggered animation (only correct matches)
      const tilesToShimmerOrdered: Array<{ tile: HTMLElement; delay: number }> = [];

      // Check rows against solution rows: green if word is in correct row position
      rowWords.forEach((word, rowIndex) => {
        const matchIndex = rows.indexOf(word);
        if (matchIndex !== -1 && matchIndex === rowIndex && word) {
          // Check if this is a newly found word
          if (!previouslyFoundWords.includes(word)) {
            newlyFoundWords.push(word);
            // Add shimmer to all letters in this row with staggered delays
            for (let col = 0; col < selectedLevel; col++) {
              const tile = letterTiles[rowIndex * selectedLevel + col] as HTMLElement;
              if (tile) {
                const letterChild = tile.querySelector('.letter-child') as HTMLElement;
                if (letterChild) {
                  tilesToShimmer.add(letterChild);
                  tilesToShimmerOrdered.push({ tile: letterChild, delay: col * 40 }); // 40ms delay between each letter
                }
              }
            }
          }
          // Word is in the correct row position - green
          for (let col = 0; col < selectedLevel; col++) {
            const tile = letterTiles[rowIndex * selectedLevel + col] as HTMLElement;
            if (tile) {
              const letterChild = tile.querySelector('.letter-child') as HTMLElement;
              if (letterChild) {
                correctTiles.add(letterChild);
              }
            }
          }
        } else if (matchIndex !== -1 && word) {
          // Yellow/partial match - Row word matches a row solution but at different index
          for (let col = 0; col < selectedLevel; col++) {
            const tile = letterTiles[rowIndex * selectedLevel + col] as HTMLElement;
            if (tile) {
              const letterChild = tile.querySelector('.letter-child') as HTMLElement;
              if (letterChild && !correctTiles.has(letterChild)) {
                presentTiles.add(letterChild);
              }
            }
          }
        }
      });

      // Check rows against solution columns: green if row word matches a column solution at the same index
      // (e.g., if word should be in first column, it's green if it's in first row)
      rowWords.forEach((word, rowIndex) => {
        const matchIndex = cols.indexOf(word);
        if (matchIndex !== -1 && matchIndex === rowIndex && word) {
          // Check if this is a newly found word
          if (!previouslyFoundWords.includes(word)) {
            newlyFoundWords.push(word);
            // Add shimmer to all letters in this row with staggered delays
            for (let col = 0; col < selectedLevel; col++) {
              const tile = letterTiles[rowIndex * selectedLevel + col] as HTMLElement;
              if (tile) {
                const letterChild = tile.querySelector('.letter-child') as HTMLElement;
                if (letterChild) {
                  tilesToShimmer.add(letterChild);
                  tilesToShimmerOrdered.push({ tile: letterChild, delay: col * 40 }); // 40ms delay between each letter
                }
              }
            }
          }
          // Row word matches a column solution at the same index - green (correct position, swapped orientation)
          for (let col = 0; col < selectedLevel; col++) {
            const tile = letterTiles[rowIndex * selectedLevel + col] as HTMLElement;
            if (tile) {
              const letterChild = tile.querySelector('.letter-child') as HTMLElement;
              if (letterChild) {
                correctTiles.add(letterChild);
              }
            }
          }
        } else if (matchIndex !== -1 && word) {
          // Yellow/partial match - no shimmer for these, only for correct matches
          // Row word matches a column solution but at different index - yellow (valid word but wrong position)
          for (let col = 0; col < selectedLevel; col++) {
            const tile = letterTiles[rowIndex * selectedLevel + col] as HTMLElement;
            if (tile) {
              const letterChild = tile.querySelector('.letter-child') as HTMLElement;
              if (letterChild && !correctTiles.has(letterChild)) {
                presentTiles.add(letterChild);
              }
            }
          }
        }
      });

      // Check columns against solution columns: green if word is in correct column position
      colWords.forEach((word, colIndex) => {
        const matchIndex = cols.indexOf(word);
        if (matchIndex !== -1 && matchIndex === colIndex && word) {
          // Check if this is a newly found word
          if (!previouslyFoundWords.includes(word)) {
            newlyFoundWords.push(word);
            // Add shimmer to all letters in this column with staggered delays
            for (let row = 0; row < selectedLevel; row++) {
              const tile = letterTiles[row * selectedLevel + colIndex] as HTMLElement;
              if (tile) {
                const letterChild = tile.querySelector('.letter-child') as HTMLElement;
                if (letterChild) {
                  tilesToShimmer.add(letterChild);
                  tilesToShimmerOrdered.push({ tile: letterChild, delay: row * 40 }); // 40ms delay between each letter
                }
              }
            }
          }
          // Word is in the correct column position - green
          for (let row = 0; row < selectedLevel; row++) {
            const tile = letterTiles[row * selectedLevel + colIndex] as HTMLElement;
            if (tile) {
              const letterChild = tile.querySelector('.letter-child') as HTMLElement;
              if (letterChild) {
                correctTiles.add(letterChild);
              }
            }
          }
        } else if (matchIndex !== -1 && word) {
          // Yellow/partial match - Column word matches a column solution but at different index
          for (let row = 0; row < selectedLevel; row++) {
            const tile = letterTiles[row * selectedLevel + colIndex] as HTMLElement;
            if (tile) {
              const letterChild = tile.querySelector('.letter-child') as HTMLElement;
              if (letterChild && !correctTiles.has(letterChild)) {
                presentTiles.add(letterChild);
              }
            }
          }
        }
      });

      // Check columns against solution rows: green if column word matches a row solution at the same index
      // (e.g., if word should be in first row, it's green if it's in first column)
      colWords.forEach((word, colIndex) => {
        const matchIndex = rows.indexOf(word);
        if (matchIndex !== -1 && matchIndex === colIndex && word) {
          // Check if this is a newly found word
          if (!previouslyFoundWords.includes(word)) {
            newlyFoundWords.push(word);
            // Add shimmer to all letters in this column with staggered delays
            for (let row = 0; row < selectedLevel; row++) {
              const tile = letterTiles[row * selectedLevel + colIndex] as HTMLElement;
              if (tile) {
                const letterChild = tile.querySelector('.letter-child') as HTMLElement;
                if (letterChild) {
                  tilesToShimmer.add(letterChild);
                  tilesToShimmerOrdered.push({ tile: letterChild, delay: row * 40 }); // 40ms delay between each letter
                }
              }
            }
          }
          // Column word matches a row solution at the same index - green (correct position, swapped orientation)
          for (let row = 0; row < selectedLevel; row++) {
            const tile = letterTiles[row * selectedLevel + colIndex] as HTMLElement;
            if (tile) {
              const letterChild = tile.querySelector('.letter-child') as HTMLElement;
              if (letterChild) {
                correctTiles.add(letterChild);
              }
            }
          }
        } else if (matchIndex !== -1 && word) {
          // Yellow/partial match - no shimmer for these, only for correct matches
          // Column word matches a row solution but at different index - yellow (valid word but wrong position)
          for (let row = 0; row < selectedLevel; row++) {
            const tile = letterTiles[row * selectedLevel + colIndex] as HTMLElement;
            if (tile) {
              const letterChild = tile.querySelector('.letter-child') as HTMLElement;
              if (letterChild && !correctTiles.has(letterChild)) {
                presentTiles.add(letterChild);
              }
            }
          }
        }
      });

      // Apply highlights: green takes precedence
      correctTiles.forEach(tile => {
        tile.classList.add('match-correct');
      });
      presentTiles.forEach(tile => {
        // Only add yellow if not already green
        if (!correctTiles.has(tile)) {
          tile.classList.add('match-present');
        }
      });
      
      // Apply shimmer animation to newly found words (only correct matches)
      if (newlyFoundWords.length > 0 && tilesToShimmerOrdered.length > 0) {
        // Play sound effect when shimmer animation triggers
        playSound('boojumble');
        // Apply staggered animation with delays
        tilesToShimmerOrdered.forEach(({ tile, delay }) => {
          setTimeout(() => {
            tile.classList.add('shimmer');
            // Force reflow to ensure animation starts
            tile.offsetHeight;
            // Remove shimmer class after animation completes (0.12s)
            setTimeout(() => {
              tile.classList.remove('shimmer');
            }, 120);
          }, delay);
        });
        
        // Update localStorage with newly found words
        const allFoundWords = [...new Set([...previouslyFoundWords, ...newlyFoundWords])];
        localStorage.setItem(storedWordsFoundKey, JSON.stringify(allFoundWords));
      }

      // Check if solved
      const solved = rowWords.every((word, idx) => word === rows[idx]) ||
                    colWords.every((word, idx) => word === cols[idx]);

      if (solved) {
        // Reconstruct letters for saving
        const flatLetters: string[] = [];
        letterTiles.forEach(tile => {
          const text = tile.querySelector('.letValue')?.textContent?.trim() || '';
          flatLetters.push(text);
        });

        if (flatLetters.length === selectedLevel * selectedLevel) {
          const reconstructed: string[][] = [];
          for (let i = 0; i < selectedLevel; i++) {
            reconstructed.push([]);
            for (let j = 0; j < selectedLevel; j++) {
              const idx = i * selectedLevel + j;
              reconstructed[i].push(flatLetters[idx] || '');
            }
          }
          
          storeBoojumbleState(reconstructed, selectedLevel);
          checkWords(reconstructed, selectedLevel);
        }
      }
    };

    const onPointerMove = (event: MouseEvent | TouchEvent) => {
      if (!draggedElement) return;
      const { pageX, pageY } = getClientXY(event);
      event.preventDefault();
      moveAt(pageX, pageY);
      checkOverlap();
    };

    const onPointerUp = (_event: MouseEvent | TouchEvent) => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove as any);
      document.removeEventListener('touchend', onPointerUp);
      document.removeEventListener('touchcancel', onPointerUp);

      if (!draggedElement || !placeholderElement || !currentBoard) return;

      // Perform swap or snap-back
      if (overlapTarget && overlapTarget !== draggedElement && overlapTarget !== placeholderElement) {
        // Swap: put dragged element where overlapTarget is, and overlapTarget where placeholder is
        // Save references BEFORE any DOM manipulation
        const placeholderNextSibling = placeholderElement.nextSibling;
        const overlapTargetNextSibling = overlapTarget.nextSibling;
        
        // Always move overlapTarget to placeholder position first
        // Then move draggedElement to where overlapTarget was
        currentBoard.insertBefore(overlapTarget, placeholderNextSibling);
        // Now insert draggedElement where overlapTarget was (use the saved nextSibling)
        if (overlapTargetNextSibling && overlapTargetNextSibling.parentNode === currentBoard) {
          currentBoard.insertBefore(draggedElement, overlapTargetNextSibling);
        } else {
          // If nextSibling doesn't exist or was removed, append to end
          currentBoard.appendChild(draggedElement);
        }
      } else {
        // Snap back: put dragged element back where placeholder is
        placeholderElement.replaceWith(draggedElement);
      }

      // Remove placeholder
      if (placeholderElement.parentNode) {
        placeholderElement.remove();
      }

      // Cleanup styles
      draggedElement.classList.remove('dragging');
      draggedElement.style.position = '';
      draggedElement.style.zIndex = '';
      draggedElement.style.left = '';
      draggedElement.style.top = '';
      draggedElement.style.width = '';
      draggedElement.style.height = '';
      draggedElement.style.minWidth = '';
      draggedElement.style.minHeight = '';
      draggedElement.style.maxWidth = '';
      draggedElement.style.maxHeight = '';
      
      if (overlapTarget) {
        overlapTarget.querySelector('.letter-child')?.classList.remove('highlight');
      }

      // Check and highlight words after swap
      highlightRowsAndColumns();
      
      // Save game state after each swap
      // Read letters in DOM order (which reflects current positions after swaps)
      const letterTiles = Array.from(currentBoard.querySelectorAll('.boojumble-letter') as NodeListOf<HTMLElement>);
      const reconstructed: string[][] = [];
      
      // Build grid from tiles in DOM order (they're already in the correct visual order)
      for (let i = 0; i < selectedLevel; i++) {
        reconstructed.push([]);
        for (let j = 0; j < selectedLevel; j++) {
          const idx = i * selectedLevel + j;
          const tile = letterTiles[idx];
          if (tile) {
            const letterValue = tile.querySelector('.letValue');
            const text = letterValue?.textContent?.trim() || '';
            reconstructed[i].push(text);
          } else {
            reconstructed[i].push('');
          }
        }
      }

      // Only save to localStorage - don't update React state here to avoid re-rendering conflicts
      // The DOM is the source of truth during gameplay, React state is only for initial render
      storeBoojumbleState(reconstructed, selectedLevel);

      draggedElement = placeholderElement = overlapTarget = null;
    };

    // Wait for letter elements to be in the DOM (they might not be ready yet)
    const checkAndInit = () => {
      const hasLetters = currentBoard.querySelectorAll('.boojumble-letter').length > 0;
      if (!hasLetters) {
        // Retry after a short delay
        setTimeout(checkAndInit, 50);
        return;
      }
      
      // Mark as initialized before adding listeners
      dragInitialized.current[selectedLevel] = true;
      
      currentBoard.addEventListener('pointerdown', onPointerDown);
      currentBoard.addEventListener('touchstart', onPointerDown as any, { passive: false });
      
      // Apply highlighting classes on page load
      highlightRowsAndColumns();
    };
    
    // Start checking for letters and initializing
    checkAndInit();

    return () => {
      dragInitialized.current[selectedLevel] = false;
      // Cleanup: remove all event listeners
      // The functions are defined in this scope, so they should be accessible
      try {
        if (currentBoard) {
          currentBoard.removeEventListener('pointerdown', onPointerDown);
          currentBoard.removeEventListener('touchstart', onPointerDown as any);
        }
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('touchmove', onPointerMove as any);
        document.removeEventListener('touchend', onPointerUp);
        document.removeEventListener('touchcancel', onPointerUp);
      } catch (e) {
        // Silently fail if listeners weren't added yet
        console.warn('Error removing drag listeners:', e);
      }
    };
  }, [selectedLevel]); // Only depend on selectedLevel

  const storeBoojumbleState = (lettersToStore: string[][], N: number) => {
    // Use the board's id for unique identification
    const currentBoojumble = boojumbles.find(b => b.N === N);
    if (!currentBoojumble) return;
    
    const flatLetters: string[] = [];
    lettersToStore.forEach(row => {
      if (Array.isArray(row)) {
        row.forEach(letter => flatLetters.push(letter));
      }
    });
    localStorage.setItem(`minigames-${currentBoojumble.id}`, JSON.stringify(flatLetters));
    // Note: words found are saved separately in checkAndInit function when words are checked
  };

  const checkWords = (currentLetters: string[][], N: number) => {
    const currentBoojumble = boojumbles.find(b => b.N === N);
    if (!currentBoojumble || !currentBoojumble.rows || !currentBoojumble.cols) return;

    const rowWords: string[] = [];
    const colWords: string[] = [];

    for (let i = 0; i < N; i++) {
      if (currentLetters[i] && Array.isArray(currentLetters[i])) {
        rowWords.push(currentLetters[i].join(''));
      } else {
        rowWords.push('');
      }
    }

    for (let j = 0; j < N; j++) {
      let colWord = '';
      for (let i = 0; i < N; i++) {
        if (currentLetters[i] && currentLetters[i][j]) {
          colWord += currentLetters[i][j];
        }
      }
      colWords.push(colWord);
    }

    const rows = Array.isArray(currentBoojumble.rows) ? currentBoojumble.rows : [];
    const cols = Array.isArray(currentBoojumble.cols) ? currentBoojumble.cols : [];
    
    const solved = rowWords.every((word, idx) => word === rows[idx]) ||
                  colWords.every((word, idx) => word === cols[idx]);

    if (solved) {
      minigamesAPI.setBoojumbleAchievement(String(N)).catch(console.error);
    }
  };

  if (boojumbles.length === 0) {
    return <div style={{ color: 'white', padding: '20px' }}>No boojumbles available.</div>;
  }

  

  return (
    <div id="boojumbles">
      <div style={{ position: 'absolute' }} id="boojumbles-help-container" className="yellow gradient-ring">
        <button id="boojumbles-help" className="help-button">?</button>
      </div>
      {boojumbles.map((boojumble) => (
        <div
          key={boojumble.N}
          className={`boojumble ${selectedLevel !== boojumble.N ? 'hidden' : ''}`}
          id={`boojumble-${boojumble.N}`}
        >
          <h3 style={{ textAlign: 'center', marginTop: '10px', color: '#7c61f7' }}>
            {boojumble.title}
          </h3>
          <div className={`board-container board-${boojumble.N}`}>
            <div
              id={`board-${boojumble.N}`}
              className="board"
              ref={(el) => {
                boardRefs.current[boojumble.N] = el;
              }}
            >
              {(() => {
                // Ensure we use numeric key
                const boardKey = Number(boojumble.N);
                const boardLetters = letters[boardKey];
                
                if (boardLetters && Array.isArray(boardLetters) && boardLetters.length > 0) {
                  const cells: JSX.Element[] = [];
                  boardLetters.forEach((row, rowIdx) => {
                    if (row && Array.isArray(row)) {
                      row.forEach((letter, colIdx) => {
                        // Use position-based key that doesn't change when letters swap
                        // This prevents React from re-rendering and resetting positions
                        cells.push(
                          <div key={`pos-${rowIdx}-${colIdx}`} className="boojumble-letter" data-row={rowIdx} data-col={colIdx}>
                            <div className="letter-child">
                              <div className="letValue">{letter || ''}</div>
                            </div>
                          </div>
                        );
                      });
                    }
                  });
                  return cells;
                } else {
                  // Fallback: render empty grid if letters not initialized yet
                  return Array.from({ length: boojumble.N * boojumble.N }).map((_, idx) => {
                    const rowIdx = Math.floor(idx / boojumble.N);
                    const colIdx = idx % boojumble.N;
                    return (
                      <div key={`pos-${rowIdx}-${colIdx}`} className="letter" data-row={rowIdx} data-col={colIdx}>
                        <div className="letter-child">
                          <div className="letValue"></div>
                        </div>
                      </div>
                    );
                  });
                }
              })()}
            </div>
          </div>
        </div>
      ))}
      <div className="boojumble-buttons">
        <button
          className={`boojumble-button ${selectedLevel === 3 ? 'boojumble-button-active' : ''}`}
          id="pk-bj"
          onClick={() => setSelectedLevel(3)}
        >
          Pocket Boojumble
        </button>
        <button
          className={`boojumble-button ${selectedLevel === 4 ? 'boojumble-button-active' : ''}`}
          id="hm-bj"
          onClick={() => setSelectedLevel(4)}
        >
          Humble Boojumble
        </button>
        <button
          className={`boojumble-button ${selectedLevel === 5 ? 'boojumble-button-active' : ''}`}
          id="jm-bj"
          onClick={() => setSelectedLevel(5)}
        >
          Jumbo Boojumble
        </button>
      </div>
    </div>
  );
};

export default Boojumble;
