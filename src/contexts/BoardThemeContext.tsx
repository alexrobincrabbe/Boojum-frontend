import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface BoardThemeContextType {
  darkMode: boolean; // false = light mode, true = dark mode
  colorsOff: boolean; // false = show colors, true = show grey only
  toggleDarkMode: () => void;
  toggleColors: () => void;
}

const BoardThemeContext = createContext<BoardThemeContextType | undefined>(undefined);

export const useBoardTheme = () => {
  const context = useContext(BoardThemeContext);
  if (!context) {
    throw new Error('useBoardTheme must be used within a BoardThemeProvider');
  }
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

  return (
    <BoardThemeContext.Provider
      value={{
        darkMode,
        colorsOff,
        toggleDarkMode,
        toggleColors,
      }}
    >
      {children}
    </BoardThemeContext.Provider>
  );
};

