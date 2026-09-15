import React, { useState, useEffect, useRef, useMemo, type JSX } from 'react';
import { minigamesAPI } from '../../../services/api';
import {
  isBoojumbleSolved,
  isBoojumbleWordsSolved,
  markBoojumbleSolved,
  notifyDailyChallengesUpdated,
} from '../../../utils/dailyChallengeStatus';
import { playSound } from '../../../utils/sounds';
import { usePageOnboarding } from '../../../hooks/usePageOnboarding';
import { showPointsToasts } from '../../../utils/pointsToasts';
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
  const reportedSolveIds = useRef<Set<number>>(new Set());
  const boardRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const dragInitialized = useRef<{ [key: number]: boolean }>({});

  const reportBoojumbleSolved = (puzzleId: number, level: number) => {
    if (!puzzleId || reportedSolveIds.current.has(puzzleId)) {
      return;
    }
    reportedSolveIds.current.add(puzzleId);
    minigamesAPI.completeBoojumble(puzzleId, level)
      .then((data) => showPointsToasts(data?.points))
      .catch((error) => {
        reportedSolveIds.current.delete(puzzleId);
        console.error(error);
      });
  };

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

  // Sync solved flags for boards already completed (e.g. before solved-key existed)
  useEffect(() => {
    if (boojumbles.length === 0) return;
    let anyNewlyMarked = false;
    boojumbles.forEach((boojumble) => {
      if (isBoojumbleSolved(boojumble)) {
        markBoojumbleSolved(boojumble.id);
        reportBoojumbleSolved(boojumble.id, boojumble.N);
        anyNewlyMarked = true;
      }
    });
    if (anyNewlyMarked) {
      notifyDailyChallengesUpdated();
    }
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
    let activePointerId: number | null = null;
    const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window;
    
    // Define handler functions - these must be defined before cleanup
    const getClientXY = (event: MouseEvent | TouchEvent | PointerEvent) => {
      if ('pointerId' in event) {
        return {
          clientX: event.clientX,
          clientY: event.clientY,
          pageX: event.pageX,
          pageY: event.pageY,
        };
      }
      if ('touches' in event) {
        const touch =
          (activePointerId != null &&
            Array.from(event.touches).find((t) => t.identifier === activePointerId)) ||
          event.touches[0] ||
          event.changedTouches[0];
        if (!touch) {
          return { clientX: 0, clientY: 0, pageX: 0, pageY: 0 };
        }
        return {
          clientX: touch.clientX,
          clientY: touch.clientY,
          pageX: touch.pageX,
          pageY: touch.pageY,
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

    const clearDragStyles = (el: HTMLElement) => {
      el.classList.remove('dragging');
      el.style.position = '';
      el.style.zIndex = '';
      el.style.left = '';
      el.style.top = '';
      el.style.width = '';
      el.style.height = '';
      el.style.minWidth = '';
      el.style.minHeight = '';
      el.style.maxWidth = '';
      el.style.maxHeight = '';
    };

    const removeDragListeners = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('mousemove', onPointerMove as any);
      document.removeEventListener('mouseup', onPointerUp as any);
      document.removeEventListener('touchmove', onPointerMove as any);
      document.removeEventListener('touchend', onPointerUp);
      document.removeEventListener('touchcancel', onPointerUp);
    };

    /** Return a mid-drag tile to the board so multi-touch cannot orphan letters on <body>. */
    const restoreDraggedToPlaceholder = () => {
      if (!draggedElement) return;
      if (placeholderElement?.parentNode) {
        placeholderElement.replaceWith(draggedElement);
      } else if (currentBoard && !currentBoard.contains(draggedElement)) {
        currentBoard.appendChild(draggedElement);
      }
      clearDragStyles(draggedElement);
      if (placeholderElement?.parentNode) {
        placeholderElement.remove();
      }
      if (overlapTarget) {
        overlapTarget.querySelector('.letter-child')?.classList.remove('highlight');
      }
      draggedElement = placeholderElement = overlapTarget = null;
      activePointerId = null;
    };

    const moveAt = (pageX: number, pageY: number) => {
      if (!draggedElement) return;
      draggedElement.style.left = `${pageX - startX}px`;
      draggedElement.style.top = `${pageY - startY}px`;
    };

    const onPointerDown = (event: MouseEvent | TouchEvent | PointerEvent) => {
      // One tile at a time: a second finger must not lift another letter off the board.
      if (draggedElement) return;

      // Ignore non-primary mouse buttons; allow touch/pen through Pointer Events.
      if ('button' in event) {
        const pointerType = 'pointerType' in event ? event.pointerType : 'mouse';
        if (pointerType === 'mouse' && event.button !== 0) return;
      }

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

      if ('pointerId' in event) {
        activePointerId = event.pointerId;
        try {
          letterElement.setPointerCapture(event.pointerId);
        } catch {
          // Capture is optional; document listeners still track the drag.
        }
      } else if ('changedTouches' in event && event.changedTouches[0]) {
        activePointerId = event.changedTouches[0].identifier;
      } else {
        activePointerId = -1;
      }
      
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

      if (supportsPointerEvents) {
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);
      } else {
        document.addEventListener('mousemove', onPointerMove as any);
        document.addEventListener('mouseup', onPointerUp as any);
        document.addEventListener('touchmove', onPointerMove as any, { passive: false });
        document.addEventListener('touchend', onPointerUp);
        document.addEventListener('touchcancel', onPointerUp);
      }
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
      const solved = isBoojumbleWordsSolved(rowWords, rows, cols, selectedLevel);

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

    const onPointerMove = (event: MouseEvent | TouchEvent | PointerEvent) => {
      if (!draggedElement) return;
      if ('pointerId' in event && activePointerId != null && event.pointerId !== activePointerId) {
        return;
      }
      if ('changedTouches' in event && activePointerId != null && activePointerId >= 0) {
        const touch =
          Array.from(event.touches).find((t) => t.identifier === activePointerId) ||
          Array.from(event.changedTouches).find((t) => t.identifier === activePointerId);
        if (!touch) return;
      }
      const { pageX, pageY } = getClientXY(event);
      event.preventDefault();
      moveAt(pageX, pageY);
      checkOverlap();
    };

    const onPointerUp = (event: MouseEvent | TouchEvent | PointerEvent) => {
      if (!draggedElement) return;

      if ('pointerId' in event && activePointerId != null && event.pointerId !== activePointerId) {
        return;
      }
      if ('changedTouches' in event && activePointerId != null && activePointerId >= 0) {
        const ended = Array.from(event.changedTouches).some(
          (t) => t.identifier === activePointerId
        );
        if (!ended) return;
      }

      removeDragListeners();

      if (!placeholderElement || !currentBoard) {
        restoreDraggedToPlaceholder();
        return;
      }

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
      clearDragStyles(draggedElement);
      
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
      activePointerId = null;
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
      
      // Prefer Pointer Events alone — registering touchstart + pointerdown double-fires on many devices.
      if (supportsPointerEvents) {
        currentBoard.addEventListener('pointerdown', onPointerDown);
      } else {
        currentBoard.addEventListener('mousedown', onPointerDown as any);
        currentBoard.addEventListener('touchstart', onPointerDown as any, { passive: false });
      }
      
      // Apply highlighting classes on page load
      highlightRowsAndColumns();
    };
    
    // Start checking for letters and initializing
    checkAndInit();

    return () => {
      dragInitialized.current[selectedLevel] = false;
      // Put any in-flight letter back on the board before tearing listeners down.
      restoreDraggedToPlaceholder();
      removeDragListeners();
      try {
        if (currentBoard) {
          currentBoard.removeEventListener('pointerdown', onPointerDown);
          currentBoard.removeEventListener('mousedown', onPointerDown as any);
          currentBoard.removeEventListener('touchstart', onPointerDown as any);
        }
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
    notifyDailyChallengesUpdated();
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
    
    const solved = isBoojumbleWordsSolved(rowWords, rows, cols, N);

    if (solved) {
      markBoojumbleSolved(currentBoojumble.id);
      reportBoojumbleSolved(currentBoojumble.id, N);
      notifyDailyChallengesUpdated();
    }
  };

  // Track if component is ready for onboarding (needed for auto-start)
  const [isReady, setIsReady] = useState(false);
  
  // Check when component is ready (letters initialized and DOM element exists)
  useEffect(() => {
    if (boojumbles.length > 0 && selectedLevel) {
      const boardKey = Number(selectedLevel);
      const boardLetters = letters[boardKey];
      const hasLetters = boardLetters && Array.isArray(boardLetters) && boardLetters.length > 0;
      const hasElement = document.querySelector('#boojumbles') !== null;
      
      if (hasLetters && hasElement) {
        setIsReady(true);
      } else {
        setIsReady(false);
      }
    }
  }, [letters, boojumbles.length, selectedLevel]);

  // Onboarding steps for Boojumble
  const boojumbleSteps = useMemo(() => {
    const steps: Array<{
      target: string;
      content: React.ReactNode;
      placement: 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end' | 'center' | 'auto';
      disableScrolling: boolean;
    }> = [
      {
        target: '#boojumbles',
        content: (
          <div>
            <p>
                Welcome to Boojumble! 
                Click letters and drag them to rearrange the grid. 
                Your goal is to form valid words in all rows and columns, from top to bottom and left to right. 
                Letters turn green when they're in the correct position.
                 When letters turn yellow, you’ve found a correct word, in the wrong row. 
                 Try moving it to different rows, until it turns green.
            </p>
            <video 
              key="boojumble-video"
              width="100%" 
              controls 
              preload="auto"
              style={{ marginTop: '10px', borderRadius: '8px', maxWidth: '500px' }}
            >
              <source src="/videos/boojumble.mov" type="video/quicktime" />
              <source src="/videos/boojumble.mov" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        ),
        placement: 'center',
        disableScrolling: false,
      },
    ];

    // Add steps for each board size if available
    const boardSizes = boojumbles.map(b => b.N).sort();
    
    boardSizes.forEach((size) => {
      let sizeName = '';
      let description = '';
      
      if (size === 3) {
        sizeName = 'Pocket Boojumble';
        description = 'Pocket Boojumble is a 3x3 grid - the smallest and quickest puzzle! A perfect little challenge.';
      } else if (size === 4) {
        sizeName = 'Humble Boojumble';
        description = 'Humble Boojumble is a 4x4 grid - a medium difficulty puzzle that offers a good balance of challenge and fun.';
      } else if (size === 5) {
        sizeName = 'Jumbo Boojumble';
        description = 'Jumbo Boojumble is a 5x5 grid - the largest and most challenging puzzle! Test your word finding skills.';
      }
      
      if (sizeName && description) {
        steps.push({
          target: `[data-onboarding="boojumble-button-${size}"]`,
          content: description,
          placement: 'top',
          disableScrolling: false,
        });
      }
    });

    return steps;
  }, [boojumbles]);

  // Auto-start onboarding when boojumbles are loaded, steps are ready, and component is ready
  const autoStart = boojumbles.length > 0 && boojumbleSteps.length > 0 && isReady;

  const { JoyrideComponent } = usePageOnboarding({
    steps: boojumbleSteps,
    pageKey: 'boojumble',
    autoStart,
  });

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
              data-onboarding={selectedLevel === boojumble.N ? "boojumble-board" : undefined}
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
          data-onboarding="boojumble-button-3"
          onClick={() => setSelectedLevel(3)}
        >
          Pocket Boojumble
        </button>
        <button
          className={`boojumble-button ${selectedLevel === 4 ? 'boojumble-button-active' : ''}`}
          id="hm-bj"
          data-onboarding="boojumble-button-4"
          onClick={() => setSelectedLevel(4)}
        >
          Humble Boojumble
        </button>
        <button
          className={`boojumble-button ${selectedLevel === 5 ? 'boojumble-button-active' : ''}`}
          id="jm-bj"
          data-onboarding="boojumble-button-5"
          onClick={() => setSelectedLevel(5)}
        >
          Jumbo Boojumble
        </button>
      </div>
      {JoyrideComponent}
    </div>
  );
};

export default Boojumble;
