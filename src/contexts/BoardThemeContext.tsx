import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface BoardThemeContextType {
  darkMode: boolean; // false = light mode, true = dark mode
  colorsOff: boolean; // false = show colors, true = show grey only
  boardFont: string; // Font family for board letters
  toggleDarkMode: () => void;
  toggleColors: () => void;
  setBoardFont: (font: string) => void;
}

// Create a default context value with sensible defaults
const defaultContextValue: BoardThemeContextType = {
  darkMode: true, // Default to dark mode
  colorsOff: false,
  boardFont: 'default',
  toggleDarkMode: () => {
    if (import.meta.env.DEV) {
      console.warn('BoardThemeProvider not available - toggleDarkMode called');
    }
  },
  toggleColors: () => {
    if (import.meta.env.DEV) {
      console.warn('BoardThemeProvider not available - toggleColors called');
    }
  },
  setBoardFont: () => {
    if (import.meta.env.DEV) {
      console.warn('BoardThemeProvider not available - setBoardFont called');
    }
  },
};

const BoardThemeContext = createContext<BoardThemeContextType>(defaultContextValue);

export const useBoardTheme = () => {
  const context = useContext(BoardThemeContext);
  // In development, check if we're using default values (which shouldn't happen if provider is set up correctly)
  // Note: We can't reliably detect if we're using default vs provider value, so we'll just return the context
  return context;
};

interface BoardThemeProviderProps {
  children: ReactNode;
}

export const BoardThemeProvider = ({ children }: BoardThemeProviderProps) => {
  // Initialize from localStorage
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const stored = localStorage.getItem('theme');
    return stored !== 'light'; // Default to dark mode (true) if not 'light'
  });

  const [colorsOff, setColorsOff] = useState<boolean>(() => {
    const stored = localStorage.getItem('colorsOff');
    return stored === 'true';
  });

  const [boardFont, setBoardFontState] = useState<string>(() => {
    const stored = localStorage.getItem('boardFont');
    return stored || 'default'; // Default to site font
  });

  // Apply theme to board when it changes or on mount
  useEffect(() => {
    const applyTheme = () => {
      const boardElement = document.getElementById('board');
      const chatWindow = document.getElementById('chat-window');
      const wordLists = document.getElementById('word-lists');
      
      if (boardElement) {
        if (darkMode) {
          // Dark mode
          boardElement.classList.remove('board-light');
          boardElement.classList.add('board-dark');
          if (chatWindow) {
            chatWindow.classList.remove('no-border');
          }
          if (wordLists) {
            wordLists.classList.remove('no-border');
          }
        } else {
          // Light mode
          boardElement.classList.remove('board-dark');
          boardElement.classList.add('board-light');
          if (chatWindow) {
            chatWindow.classList.add('no-border');
          }
          if (wordLists) {
            wordLists.classList.add('no-border');
          }
        }

        // Update letter classes
        const letters = boardElement.getElementsByClassName('letter');
        for (let i = 0; i < letters.length; i++) {
          const letter = letters[i];
          if (darkMode) {
            letter.classList.remove('light-mode');
            letter.classList.add('dark-mode');
          } else {
            letter.classList.remove('dark-mode');
            letter.classList.add('light-mode');
          }
        }
      }
    };

    // Apply immediately
    applyTheme();

    // Also apply when DOM updates (for dynamically added boards)
    const observer = new MutationObserver(() => {
      applyTheme();
    });

    // Observe the document body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [darkMode]);

  // Apply font to board when it changes
  useEffect(() => {
    const applyFont = () => {
      // Apply to all board types: board, daily-board, timeless-board
      const boardIds = ['board', 'daily-board', 'timeless-board'];
      const fontFamily = boardFont === 'default' 
        ? 'inherit' 
        : `"${boardFont}", sans-serif`;
      
      boardIds.forEach(boardId => {
        const boardElement = document.getElementById(boardId);
        if (boardElement) {
          const letters = boardElement.getElementsByClassName('letter');
          for (let i = 0; i < letters.length; i++) {
            const letter = letters[i] as HTMLElement;
            letter.style.fontFamily = fontFamily;
          }
        }
      });
    };

    applyFont();

    // Also apply when DOM updates (for dynamically added boards)
    const observer = new MutationObserver(() => {
      applyFont();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [boardFont]);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('theme', newDarkMode ? 'dark' : 'light');
  };

  const toggleColors = () => {
    const newColorsOff = !colorsOff;
    setColorsOff(newColorsOff);
    localStorage.setItem('colorsOff', newColorsOff.toString());
  };

  const setBoardFont = (font: string) => {
    setBoardFontState(font);
    localStorage.setItem('boardFont', font);
  };

  return (
    <BoardThemeContext.Provider
      value={{
        darkMode,
        colorsOff,
        boardFont,
        toggleDarkMode,
        toggleColors,
        setBoardFont,
      }}
    >
      {children}
    </BoardThemeContext.Provider>
  );
};

