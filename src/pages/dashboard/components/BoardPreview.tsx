import { useEffect, useRef } from 'react';
import { useBoardTheme } from '../../../contexts/BoardThemeContext';
import './BoardPreview.css';

// Fixed board letters for preview
const PREVIEW_BOARD = [
  ['A', 'B', 'C', 'D'],
  ['E', 'F', 'G', 'H'],
  ['I', 'J', 'K', 'L'],
  ['M', 'N', 'O', 'P'],
];

export function BoardPreview() {
  const { darkMode, colorsOff, boardFont } = useBoardTheme();
  const boardRef = useRef<HTMLDivElement>(null);

  // Apply theme classes to preview board
  useEffect(() => {
    if (boardRef.current) {
      if (darkMode) {
        boardRef.current.classList.remove('board-light');
        boardRef.current.classList.add('board-dark');
      } else {
        boardRef.current.classList.remove('board-dark');
        boardRef.current.classList.add('board-light');
      }

      // Update letter classes and tile colors
      const letters = boardRef.current.getElementsByClassName('letter');
      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i] as HTMLElement;
        const rowIndex = Math.floor(i / 4);
        
        // Update dark/light mode
        if (darkMode) {
          letter.classList.remove('light-mode');
          letter.classList.add('dark-mode');
        } else {
          letter.classList.remove('dark-mode');
          letter.classList.add('light-mode');
        }

        // Remove all tile color classes first
        letter.classList.remove(
          'tile-no-match-dark', 'tile-match-dark', 'tile-partial-match-dark',
          'tile-no-match-light', 'tile-match-light', 'tile-partial-match-light',
          'tile-no-match-grey-dark', 'tile-no-match-grey-light', 'tile-match-grey-light'
        );

        // Apply tile colors based on row
        const modeSuffix = darkMode ? 'dark' : 'light';
        
        if (rowIndex === 1) {
          // Row 2: Invalid word swipe - pink (or grey if colorsOff)
          if (colorsOff) {
            letter.classList.add(`tile-no-match-grey-${modeSuffix}`);
          } else {
            letter.classList.add(`tile-no-match-${modeSuffix}`);
          }
        } else if (rowIndex === 2) {
          // Row 3: Valid path being swiped - yellow (or grey if colorsOff)
          if (colorsOff) {
            letter.classList.add(`tile-no-match-grey-${modeSuffix}`);
          } else {
            letter.classList.add(`tile-partial-match-${modeSuffix}`);
          }
        } else if (rowIndex === 3) {
          // Row 4: Green highlight - valid word found
          letter.classList.add(`tile-match-${modeSuffix}`);
        }
        // Row 1 (rowIndex === 0): No highlight
      }
    }
  }, [darkMode, colorsOff]);

  // Apply font to preview board
  useEffect(() => {
    if (boardRef.current) {
      const letters = boardRef.current.getElementsByClassName('letter');
      const fontFamily = boardFont === 'default' 
        ? 'inherit' 
        : `"${boardFont}", sans-serif`;
      
      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i] as HTMLElement;
        letter.style.fontFamily = fontFamily;
      }
    }
  }, [boardFont]);

  return (
    <div className="board-preview-container">
      <h4>Board Preview</h4>
      <div className="board-preview-wrapper">
        <div
          ref={boardRef}
          className="board-preview board-dark"
        >
          {PREVIEW_BOARD.map((row, rowIndex) =>
            row.map((letter, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="letter dark-mode"
                data-x={rowIndex}
                data-y={colIndex}
                data-index={rowIndex * 4 + colIndex}
                data-letter={letter}
              >
                <div className="letValue">{letter}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

