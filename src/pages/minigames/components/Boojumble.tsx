import React, { useState, useEffect, useRef, type JSX } from 'react';
import { minigamesAPI } from '../../../services/api';
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
  const [trackWordsFound, setTrackWordsFound] = useState<string[]>([]);
  const boardRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const dragInitialized = useRef<{ [key: number]: boolean }>({});
  const hasLoadedSavedState = useRef(false);

  // Initialize letters for all boojumbles
  useEffect(() => {
    if (boojumbles.length === 0) return;
    
    setLetters(prev => {
      const newLetters: { [key: number]: string[][] } = { ...prev };
      let hasChanges = false;
      
      boojumbles.forEach(boojumble => {
        // Always reinitialize if we have scrambled data, even if letters already exist
        if (boojumble.scrambled) {
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

  // Load saved state from localStorage - but only once after letters are initialized
  useEffect(() => {
    // Only load from localStorage once, after letters are initialized
    if (boojumbles.length === 0 || Object.keys(letters).length === 0 || hasLoadedSavedState.current) return;
    
    // Use the board's date for the selected level
    const currentBoojumble = boojumbles.find(b => b.N === selectedLevel);
    const boardDate = currentBoojumble?.date || new Date().toISOString().split('T')[0];
    const storedWordsFound = localStorage.getItem(`minigames-words-${boardDate}`);
    
    if (storedWordsFound) {
      try {
        setTrackWordsFound(JSON.parse(storedWordsFound));
      } catch (e) {
        console.error('Failed to parse stored words found:', e);
      }
    }
    
    // Load saved letters only if they exist and have content
    const storedLetters = localStorage.getItem(`minigames-${boardDate}`);
    if (storedLetters) {
      try {
        const savedLetters = JSON.parse(storedLetters);
        // Only apply saved state if it matches a board size and has actual letters
        const lettersToUpdate: { [key: number]: string[][] } = {};
        Object.keys(letters).forEach(NStr => {
          const N = Number(NStr);
          if (Array.isArray(savedLetters) && savedLetters.length === N * N) {
            // Check if saved letters have actual content (not all empty)
            const hasLetters = savedLetters.some((l: string) => l && l.trim() !== '');
            if (hasLetters) {
              const savedGrid: string[][] = [];
              for (let i = 0; i < N; i++) {
                savedGrid.push([]);
                for (let j = 0; j < N; j++) {
                  const idx = i * N + j;
                  savedGrid[i].push(savedLetters[idx] || '');
                }
              }
              lettersToUpdate[N] = savedGrid;
            }
          }
        });
        
        if (Object.keys(lettersToUpdate).length > 0) {
          setLetters(prev => ({ ...prev, ...lettersToUpdate }));
        }
      } catch (e) {
        console.error('Failed to parse stored letters:', e);
      }
    }
    
    hasLoadedSavedState.current = true;
  }, [boojumbles.length]); // Only depend on boojumbles.length, not letters

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
      const letterElement = target.closest('.letter') as HTMLElement;
      if (!letterElement || !currentBoard.contains(letterElement)) return;
      
      event.preventDefault();
      
      draggedElement = letterElement;
      const rect = letterElement.getBoundingClientRect();
      // Calculate offset from the element's top-left corner to the click point
      startX = clientX - rect.left;
      startY = clientY - rect.top;
      width = rect.width;
      height = rect.height;

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

      currentBoard.querySelectorAll('.letter').forEach((item) => {
        if (item === draggedElement) return;
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
        overlapTarget.querySelector('.letter-child')?.classList.remove('highlight');
      }
      if (bestMatch) {
        bestMatch.querySelector('.letter-child')?.classList.add('highlight');
      }
      overlapTarget = bestMatch;
    };

    const highlightRowsAndColumns = () => {
      if (!currentBoard) return;
      
      const currentBoojumble = boojumbles.find(b => b.N === selectedLevel);
      if (!currentBoojumble || !currentBoojumble.rows || !currentBoojumble.cols) return;

      // Read current grid words from DOM
      const letterTiles = Array.from(currentBoard.querySelectorAll('.letter'));
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
          letterChild.classList.remove('match-present', 'match-correct');
        }
      });

      // Track which tiles should be green (correct position) vs yellow (valid word, wrong position)
      const correctTiles = new Set<HTMLElement>();
      const presentTiles = new Set<HTMLElement>();

      // Check rows against solution rows: green if word is in correct row position
      rowWords.forEach((word, rowIndex) => {
        const matchIndex = rows.indexOf(word);
        if (matchIndex !== -1 && matchIndex === rowIndex) {
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
        }
      });

      // Check rows against solution columns: green if row word matches a column solution at the same index
      // (e.g., if word should be in first column, it's green if it's in first row)
      rowWords.forEach((word, rowIndex) => {
        const matchIndex = cols.indexOf(word);
        if (matchIndex !== -1 && matchIndex === rowIndex) {
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
        } else if (matchIndex !== -1) {
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
        if (matchIndex !== -1 && matchIndex === colIndex) {
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
        }
      });

      // Check columns against solution rows: green if column word matches a row solution at the same index
      // (e.g., if word should be in first row, it's green if it's in first column)
      colWords.forEach((word, colIndex) => {
        const matchIndex = rows.indexOf(word);
        if (matchIndex !== -1 && matchIndex === colIndex) {
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
        } else if (matchIndex !== -1) {
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
        const placeholderNextSibling = placeholderElement.nextSibling;
        // First, insert dragged element before overlapTarget
        currentBoard.insertBefore(draggedElement, overlapTarget);
        // Then, insert overlapTarget where placeholder is (which is where dragged element originally was)
        currentBoard.insertBefore(overlapTarget, placeholderNextSibling);
      } else {
        // Snap back: put dragged element back where placeholder is
        placeholderElement.replaceWith(draggedElement);
      }

      // Remove placeholder
      if (placeholderElement.parentNode) {
        placeholderElement.remove();
      }

      // Cleanup styles
      draggedElement.style.position = '';
      draggedElement.style.zIndex = '';
      draggedElement.style.left = '';
      draggedElement.style.top = '';
      draggedElement.style.width = '';
      draggedElement.style.height = '';
      
      if (overlapTarget) {
        overlapTarget.querySelector('.letter-child')?.classList.remove('highlight');
      }

      // Check and highlight words after swap
      highlightRowsAndColumns();
      
      // Save game state after each swap
      const letterElements = Array.from(currentBoard.querySelectorAll('.letter .letValue'));
      const flatLetters: string[] = [];
      letterElements.forEach(el => {
        const text = el.textContent?.trim() || '';
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
      }

      draggedElement = placeholderElement = overlapTarget = null;
    };

    // Wait for letter elements to be in the DOM (they might not be ready yet)
    const checkAndInit = () => {
      const hasLetters = currentBoard.querySelectorAll('.letter').length > 0;
      if (!hasLetters) {
        // Retry after a short delay
        setTimeout(checkAndInit, 50);
        return;
      }
      
      // Mark as initialized before adding listeners
      dragInitialized.current[selectedLevel] = true;
      
      currentBoard.addEventListener('pointerdown', onPointerDown);
      currentBoard.addEventListener('touchstart', onPointerDown as any, { passive: false });
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
    // Use the board's date, not the current date, since there's a new board every day
    const currentBoojumble = boojumbles.find(b => b.N === N);
    const boardDate = currentBoojumble?.date || new Date().toISOString().split('T')[0];
    
    const flatLetters: string[] = [];
    lettersToStore.forEach(row => {
      if (Array.isArray(row)) {
        row.forEach(letter => flatLetters.push(letter));
      }
    });
    localStorage.setItem(`minigames-${boardDate}`, JSON.stringify(flatLetters));
    localStorage.setItem(`minigames-words-${boardDate}`, JSON.stringify(trackWordsFound));
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
                          <div key={`pos-${rowIdx}-${colIdx}`} className="letter" data-row={rowIdx} data-col={colIdx}>
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
