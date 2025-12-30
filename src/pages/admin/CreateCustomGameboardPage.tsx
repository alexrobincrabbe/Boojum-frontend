import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Plus, X, CheckCircle, AlertCircle, Calendar, Infinity } from 'lucide-react';
import './CreateCustomGameboardPage.css';

type Board = string[][];
type BoojumBoard = number[][]; // 0 = normal, 1 = snark, 2 = boojum
type BoardType = 'gameboard' | 'daily' | 'timeless' | null;

interface BoardMetadata {
  title: string;
  date: string;
}

const CreateCustomGameboardPage = () => {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([createEmptyBoard()]);
  const [boardTypes, setBoardTypes] = useState<BoardType[]>(['gameboard']);
  const [boojumBoards, setBoojumBoards] = useState<BoojumBoard[]>([]);
  const [boardMetadata, setBoardMetadata] = useState<BoardMetadata[]>([]);
  const [activeMarkingMode, setActiveMarkingMode] = useState<'snark' | 'boojum' | null>(null);
  const [dateErrors, setDateErrors] = useState<{ [key: number]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [createdBoardIds, setCreatedBoardIds] = useState<number[]>([]);
  const [checkProgress, setCheckProgress] = useState<{
    stage: 'idle' | 'checking' | 'fetching' | 'updating' | 'complete';
    message: string;
    progress: number; // 0-100
  }>({
    stage: 'idle',
    message: '',
    progress: 0,
  });
  const [checkResults, setCheckResults] = useState<{
    total_words: number;
    found_words: string[];
    missing_words: string[];
    found_count: number;
    missing_count: number;
    definitions_created?: number;
    definitions_updated?: number;
    definitions_failed?: number;
    created_words?: string[];
    updated_words?: string[];
    failed_words?: string[];
  } | null>(null);

  function createEmptyBoard(): Board {
    return [
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', ''],
      ['', '', '', ''],
    ];
  }

  function createEmptyBoojumBoard(): BoojumBoard {
    return [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
  }

  useEffect(() => {
    // Load default dates when component mounts
    const loadDefaultDates = async () => {
      try {
        await adminAPI.getDefaultBoardDates();
        // Initialize metadata for existing boards
        const defaultMetadata: BoardMetadata[] = boards.map(() => ({
          title: '',
          date: '',
        }));
        setBoardMetadata(defaultMetadata);
      } catch (error) {
        console.error('Error loading default dates:', error);
      }
    };
    loadDefaultDates();
  }, []); // Only run once on mount

  const handleAddBoard = () => {
    setBoards([...boards, createEmptyBoard()]);
    setBoardTypes([...boardTypes, 'gameboard']);
    setBoardMetadata([...boardMetadata, { title: '', date: '' }]);
  };

  const getNextDate = (type: 'daily' | 'timeless', baseDate: string, currentMetadata: BoardMetadata[], currentTypes: BoardType[], excludeIndex: number): string => {
    // Base date from database is already the next date (last date + 1 day)
    let latestDate = new Date(baseDate);
    
    // Find the highest date among boards of the SAME TYPE ONLY in current session
    // Exclude the current board (excludeIndex) from the calculation
    // Daily and timeless boards count separately
    for (let i = 0; i < currentMetadata.length; i++) {
      // Skip the current board and only consider boards of the exact same type (daily or timeless)
      if (i !== excludeIndex && currentTypes[i] === type && currentMetadata[i]?.date) {
        const date = new Date(currentMetadata[i].date);
        if (date >= latestDate) {
          // If there's a board with this date or later, add one day to it
          latestDate = new Date(date);
          latestDate.setDate(latestDate.getDate() + 1);
        }
      }
    }
    
    // Return the date (baseDate if no other boards, or latestDate + 1 if other boards exist)
    return latestDate.toISOString().split('T')[0];
  };

  const handleBoardTypeChange = async (boardIndex: number, type: BoardType) => {
    const newTypes = [...boardTypes];
    const previousType = newTypes[boardIndex];
    newTypes[boardIndex] = type;
    setBoardTypes(newTypes);

    // Initialize boojum board if switching to daily/timeless
    if (type === 'daily' || type === 'timeless') {
      const newBoojumBoards = [...boojumBoards];
      if (!newBoojumBoards[boardIndex]) {
        newBoojumBoards[boardIndex] = createEmptyBoojumBoard();
      }
      setBoojumBoards(newBoojumBoards);

      // Only update date if switching from a different type or if date is not set
      const currentMetadata = [...boardMetadata];
      if (!currentMetadata[boardIndex]) {
        currentMetadata[boardIndex] = { title: '', date: '' };
      }
      
      const shouldUpdateDate = previousType !== type || !currentMetadata[boardIndex].date;

      if (shouldUpdateDate) {
        // Load default date and title
        try {
          const data = await adminAPI.getDefaultBoardDates();
          
          // Calculate next date considering both database and current session
          // IMPORTANT: Daily and timeless boards count separately
          // Exclude current board from calculation
          let nextDate: string;
          let boardNumber: number;
          
          if (type === 'daily') {
            // Only look at other daily boards (excluding current) for date calculation
            nextDate = getNextDate('daily', data.next_daily_date, currentMetadata, newTypes, boardIndex);
            // Count only other daily boards in the current session (excluding current)
            const dailyCount = newTypes.filter((t, i) => t === 'daily' && i !== boardIndex).length;
            boardNumber = data.next_daily_number + dailyCount;
            currentMetadata[boardIndex].date = nextDate;
            currentMetadata[boardIndex].title = `Everyday Board No. ${boardNumber}`;
          } else if (type === 'timeless') {
            // Only look at other timeless boards (excluding current) for date calculation
            nextDate = getNextDate('timeless', data.next_timeless_date, currentMetadata, newTypes, boardIndex);
            // Count only other timeless boards in the current session (excluding current)
            const timelessCount = newTypes.filter((t, i) => t === 'timeless' && i !== boardIndex).length;
            boardNumber = data.next_timeless_number + timelessCount;
            currentMetadata[boardIndex].date = nextDate;
            currentMetadata[boardIndex].title = `Timeless Board No. ${boardNumber}`;
          }
          
          setBoardMetadata(currentMetadata);
          
          // Clear any date errors when switching types
          const newDateErrors = { ...dateErrors };
          delete newDateErrors[boardIndex];
          setDateErrors(newDateErrors);
        } catch (error) {
          console.error('Error loading default dates:', error);
        }
      }
    } else {
      // Clear metadata when switching back to gameboard
      const newMetadata = [...boardMetadata];
      if (newMetadata[boardIndex]) {
        newMetadata[boardIndex] = { title: '', date: '' };
      }
      setBoardMetadata(newMetadata);
      
      // Clear date errors
      const newDateErrors = { ...dateErrors };
      delete newDateErrors[boardIndex];
      setDateErrors(newDateErrors);
    }
  };

  const handleTitleChange = (boardIndex: number, title: string) => {
    const newMetadata = [...boardMetadata];
    if (!newMetadata[boardIndex]) {
      newMetadata[boardIndex] = { title: '', date: '' };
    }
    newMetadata[boardIndex].title = title;
    setBoardMetadata(newMetadata);
  };

  const handleDateChange = async (boardIndex: number, date: string, boardType: BoardType) => {
    const newMetadata = [...boardMetadata];
    if (!newMetadata[boardIndex]) {
      newMetadata[boardIndex] = { title: '', date: '' };
    }
    newMetadata[boardIndex].date = date;
    setBoardMetadata(newMetadata);

    // Validate date if it's a daily or timeless board
    if (date && (boardType === 'daily' || boardType === 'timeless')) {
      try {
        const response = await adminAPI.checkBoardDate(date, boardType);
        if (!response.available) {
          const newDateErrors = { ...dateErrors };
          newDateErrors[boardIndex] = response.message || 'A board already exists for this date';
          setDateErrors(newDateErrors);
        } else {
          const newDateErrors = { ...dateErrors };
          delete newDateErrors[boardIndex];
          setDateErrors(newDateErrors);
        }
      } catch (error: any) {
        const newDateErrors = { ...dateErrors };
        newDateErrors[boardIndex] = error.response?.data?.error || 'Error checking date';
        setDateErrors(newDateErrors);
      }
    }
  };

  const handleMarkLetter = (boardIndex: number, rowIndex: number, colIndex: number) => {
    if (!activeMarkingMode) {
      toast.error('Please select Snark or Boojum mode first');
      return;
    }

    const board = boards[boardIndex];
    const letter = board[rowIndex][colIndex];
    
    if (!letter || letter.trim() === '') {
      toast.error('Cannot mark empty cell');
      return;
    }

    // Check if this letter appears elsewhere on the board
    const letterPositions: [number, number][] = [];
    
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] === letter) {
          letterPositions.push([r, c]);
        }
      }
    }

    // If letter appears more than once, show error
    if (letterPositions.length > 1) {
      toast.error(`${letter} appears ${letterPositions.length} times on the board. Each letter can only appear once to be marked.`);
      return;
    }

    const newBoojumBoards = [...boojumBoards];
    const boojumBoard = newBoojumBoards[boardIndex];
    const markValue = activeMarkingMode === 'snark' ? 1 : 2;

    // Clear all previous marks of the same type (only one boojum, only one snark)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (boojumBoard[r][c] === markValue) {
          boojumBoard[r][c] = 0;
        }
      }
    }

    // Mark the selected letter
    boojumBoard[rowIndex][colIndex] = markValue;

    newBoojumBoards[boardIndex] = boojumBoard;
    setBoojumBoards(newBoojumBoards);
    toast.success(`Marked "${letter}" as ${activeMarkingMode === 'snark' ? 'Snark' : 'Boojum'}`);
  };

  const handleRemoveBoard = (index: number) => {
    if (boards.length > 1) {
      setBoards(boards.filter((_, i) => i !== index));
      setBoardTypes(boardTypes.filter((_, i) => i !== index));
      setBoojumBoards(boojumBoards.filter((_, i) => i !== index));
      setBoardMetadata(boardMetadata.filter((_, i) => i !== index));
      const newDateErrors = { ...dateErrors };
      delete newDateErrors[index];
      setDateErrors(newDateErrors);
    }
  };

  const handleLetterChange = (
    boardIndex: number,
    rowIndex: number,
    colIndex: number,
    value: string
  ) => {
    const newBoards = [...boards];
    const letter = value.toUpperCase().trim();
    
    // Handle Q - always store as QU in a single cell
    if (letter === 'Q') {
      newBoards[boardIndex][rowIndex][colIndex] = 'QU';
      
      // Auto-advance to next cell after typing Q (which becomes QU)
      setTimeout(() => {
        let nextRow = rowIndex;
        let nextCol = colIndex + 1;
        
        // Move to next row if at end of current row
        if (nextCol >= 4) {
          nextCol = 0;
          nextRow = rowIndex + 1;
        }
        
        // Move to next board if at end of current board
        if (nextRow >= 4) {
          // Don't auto-advance to next board, just stay at last cell
          return;
        }
        
        const nextInput = document.querySelector(
          `input[data-board="${boardIndex}"][data-row="${nextRow}"][data-col="${nextCol}"]`
        ) as HTMLInputElement;
        nextInput?.focus();
        nextInput?.select();
      }, 10);
    } else if (letter.length === 1 && letter.match(/[A-Z]/)) {
      newBoards[boardIndex][rowIndex][colIndex] = letter;
      
      // Auto-advance to next cell after typing a letter
      setTimeout(() => {
        let nextRow = rowIndex;
        let nextCol = colIndex + 1;
        
        // Move to next row if at end of current row
        if (nextCol >= 4) {
          nextCol = 0;
          nextRow = rowIndex + 1;
        }
        
        // Move to next board if at end of current board
        if (nextRow >= 4) {
          // Don't auto-advance to next board, just stay at last cell
          return;
        }
        
        const nextInput = document.querySelector(
          `input[data-board="${boardIndex}"][data-row="${nextRow}"][data-col="${nextCol}"]`
        ) as HTMLInputElement;
        nextInput?.focus();
        nextInput?.select();
      }, 10);
    } else if (value === '') {
      newBoards[boardIndex][rowIndex][colIndex] = '';
    }
    
    setBoards(newBoards);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    boardIndex: number,
    rowIndex: number,
    colIndex: number
  ) => {
    const currentValue = e.currentTarget.value;
    
    if (e.key === 'Backspace') {
      if (currentValue === '') {
        // Move to previous cell and clear it
        e.preventDefault();
        let prevRow = rowIndex;
        let prevCol = colIndex - 1;
        
        // Move to previous row if at start of current row
        if (prevCol < 0) {
          prevCol = 3;
          prevRow = rowIndex - 1;
        }
        
        // Don't go before first cell
        if (prevRow >= 0 && prevCol >= 0) {
          const prevInput = document.querySelector(
            `input[data-board="${boardIndex}"][data-row="${prevRow}"][data-col="${prevCol}"]`
          ) as HTMLInputElement;
          if (prevInput) {
            prevInput.focus();
            prevInput.select();
            // Clear the previous cell
            const newBoards = [...boards];
            newBoards[boardIndex][prevRow][prevCol] = '';
            setBoards(newBoards);
          }
        }
      }
      // If there's a value, let Backspace work normally to delete it
    } else if (e.key === 'ArrowRight' && colIndex < 3) {
      e.preventDefault();
      const nextInput = document.querySelector(
        `input[data-board="${boardIndex}"][data-row="${rowIndex}"][data-col="${colIndex + 1}"]`
      ) as HTMLInputElement;
      nextInput?.focus();
      nextInput?.select();
    } else if (e.key === 'ArrowLeft' && colIndex > 0) {
      e.preventDefault();
      const prevInput = document.querySelector(
        `input[data-board="${boardIndex}"][data-row="${rowIndex}"][data-col="${colIndex - 1}"]`
      ) as HTMLInputElement;
      prevInput?.focus();
      prevInput?.select();
    } else if (e.key === 'ArrowDown' && rowIndex < 3) {
      e.preventDefault();
      const nextInput = document.querySelector(
        `input[data-board="${boardIndex}"][data-row="${rowIndex + 1}"][data-col="${colIndex}"]`
      ) as HTMLInputElement;
      nextInput?.focus();
      nextInput?.select();
    } else if (e.key === 'ArrowUp' && rowIndex > 0) {
      e.preventDefault();
      const prevInput = document.querySelector(
        `input[data-board="${boardIndex}"][data-row="${rowIndex - 1}"][data-col="${colIndex}"]`
      ) as HTMLInputElement;
      prevInput?.focus();
      prevInput?.select();
    } else if (e.key.length === 1 && e.key.match(/[A-Za-z]/)) {
      // If typing a letter and the current cell already has a value, replace it and move forward
      if (currentValue && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 1) {
        // Cell has value and is selected, will be replaced by onChange
        // The onChange handler will handle moving to next cell
      }
    }
  };

  const validateBoards = (): boolean => {
    for (let boardIndex = 0; boardIndex < boards.length; boardIndex++) {
      const board = boards[boardIndex];
      for (let rowIndex = 0; rowIndex < 4; rowIndex++) {
        for (let colIndex = 0; colIndex < 4; colIndex++) {
          const letter = board[rowIndex][colIndex];
          if (!letter || letter.trim() === '') {
            toast.error(`Board ${boardIndex + 1}, row ${rowIndex + 1}, column ${colIndex + 1} is empty`);
            return false;
          }
          
          // Validate letter (must be A-Z or QU)
          if (letter !== 'QU' && (!letter.match(/^[A-Z]$/))) {
            toast.error(`Board ${boardIndex + 1}, row ${rowIndex + 1}, column ${colIndex + 1}: Invalid letter "${letter}"`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!user?.is_superuser) {
      toast.error('Only superusers can create custom gameboards');
      return;
    }

    if (!validateBoards()) {
      return;
    }

    // Validate daily/timeless boards have boojum data
    for (let i = 0; i < boards.length; i++) {
      if (boardTypes[i] === 'daily' || boardTypes[i] === 'timeless') {
        if (!boojumBoards[i]) {
          toast.error(`Board ${i + 1} is set as ${boardTypes[i]} but boojum data is missing`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      // Validate daily/timeless boards have required fields
      for (let i = 0; i < boards.length; i++) {
        if (boardTypes[i] === 'daily' || boardTypes[i] === 'timeless') {
          const metadata = boardMetadata[i];
          if (!metadata || !metadata.title || !metadata.date) {
            toast.error(`Board ${i + 1} (${boardTypes[i]}) requires a title and date`);
            return;
          }
          if (dateErrors[i]) {
            toast.error(`Board ${i + 1} has an invalid date: ${dateErrors[i]}`);
            return;
          }
        }
      }

      // Separate boards by type
      const gameboardBoards: Board[] = [];
      const dailyBoards: { board: Board; boojum: BoojumBoard; title: string; date: string }[] = [];
      const timelessBoards: { board: Board; boojum: BoojumBoard; title: string; date: string }[] = [];

      for (let i = 0; i < boards.length; i++) {
        if (boardTypes[i] === 'daily') {
          dailyBoards.push({ 
            board: boards[i], 
            boojum: boojumBoards[i],
            title: boardMetadata[i]?.title || '',
            date: boardMetadata[i]?.date || '',
          });
        } else if (boardTypes[i] === 'timeless') {
          timelessBoards.push({ 
            board: boards[i], 
            boojum: boojumBoards[i],
            title: boardMetadata[i]?.title || '',
            date: boardMetadata[i]?.date || '',
          });
        } else {
          gameboardBoards.push(boards[i]);
        }
      }

      // Create gameboards first
      let allBoardIds: number[] = [];
      if (gameboardBoards.length > 0) {
        const response = await adminAPI.createCustomGameboards(gameboardBoards);
        allBoardIds = response.boards.map((b: any) => b.id);
      }

      // Create daily boards
      if (dailyBoards.length > 0) {
        const dailyResponse = await adminAPI.createDailyBoards(dailyBoards);
        // Use gameboard_id for checking definitions (not the daily board id)
        allBoardIds = [...allBoardIds, ...dailyResponse.boards.map((b: any) => b.gameboard_id || b.id)];
      }

      // Create timeless boards
      if (timelessBoards.length > 0) {
        const timelessResponse = await adminAPI.createTimelessBoards(timelessBoards);
        // Use gameboard_id for checking definitions (not the timeless board id)
        allBoardIds = [...allBoardIds, ...timelessResponse.boards.map((b: any) => b.gameboard_id || b.id)];
      }

      setCreatedBoardIds(allBoardIds);
      toast.success(`Successfully created ${allBoardIds.length} board(s)!`);
      
      // Automatically check and fetch missing definitions
      if (allBoardIds.length > 0) {
        await handleCheckDefinitions(allBoardIds, true); // true = fetch definitions
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create boards');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckDefinitions = async (boardIds?: number[], fetchDefinitions: boolean = false) => {
    const idsToCheck = boardIds || createdBoardIds;
    if (idsToCheck.length === 0) {
      toast.error('No boards to check. Please create boards first.');
      return;
    }

    setIsChecking(true);
    setCheckProgress({
      stage: 'checking',
      message: 'Checking for missing definitions...',
      progress: 10,
    });
    
    try {
      // First, check for missing definitions
      setCheckProgress({
        stage: 'checking',
        message: 'Checking for missing definitions...',
        progress: 20,
      });
      
      const response = await adminAPI.checkCustomBoardDefinitions(idsToCheck, fetchDefinitions);
      
      if (fetchDefinitions && response.missing_count > 0) {
        // Estimate progress: checking (20%), fetching (60%), updating (20%)
        setCheckProgress({
          stage: 'fetching',
          message: `Fetching definitions from OpenAI for ${response.missing_count} words...`,
          progress: 30,
        });
      }
      
      setCheckResults(response);
      
      if (fetchDefinitions) {
        // Show results of definition fetching
        const created = response.definitions_created || 0;
        const updated = response.definitions_updated || 0;
        const failed = response.definitions_failed || 0;
        
        setCheckProgress({
          stage: 'complete',
          message: 'Definition check complete!',
          progress: 100,
        });
        
        if (created > 0 || updated > 0) {
          toast.success(`Successfully ${created > 0 ? `created ${created} new` : ''}${created > 0 && updated > 0 ? ' and ' : ''}${updated > 0 ? `updated ${updated} existing` : ''} definition(s)${failed > 0 ? `. ${failed} failed.` : '.'}`);
        } else if (failed > 0) {
          toast.warning(`Failed to fetch definitions for ${failed} word(s)`);
        } else {
          toast.info('No definitions needed to be fetched.');
        }
      } else {
        // Just checking, not fetching
        setCheckProgress({
          stage: 'complete',
          message: 'Definition check complete!',
          progress: 100,
        });
        
        if (response.missing_count > 0) {
          toast.warning(`Found ${response.missing_count} words with missing definitions`);
        } else {
          toast.success('All words have definitions!');
        }
      }
    } catch (error: any) {
      setCheckProgress({
        stage: 'idle',
        message: '',
        progress: 0,
      });
      toast.error(error.response?.data?.error || 'Failed to check definitions');
    } finally {
      setIsChecking(false);
      // Clear progress after a delay
      setTimeout(() => {
        setCheckProgress({
          stage: 'idle',
          message: '',
          progress: 0,
        });
      }, 3000);
    }
  };

  if (!user?.is_superuser) {
    return (
      <div className="create-custom-gameboard-page">
        <div className="page-container">
          <h1>Create Custom Gameboard</h1>
          <p>You must be a superuser to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="create-custom-gameboard-page">
      <div className="page-container">
        <h1>Create Custom Gameboard</h1>
        <p className="page-description">
          Create custom gameboards that will be marked as special. Word lists will be automatically generated.
        </p>

        <div className="boards-container">
          {boards.map((board, boardIndex) => {
            const boardType = boardTypes[boardIndex] || 'gameboard';
            const boojumBoard = boojumBoards[boardIndex];
            const showMarkingBoard = boardType === 'daily' || boardType === 'timeless';

            return (
              <div key={boardIndex} className="board-wrapper">
                <div className="board-header">
                  <h2>Board {boardIndex + 1}</h2>
                  {boards.length > 1 && (
                    <button
                      className="remove-board-btn"
                      onClick={() => handleRemoveBoard(boardIndex)}
                      aria-label="Remove board"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>

                <div className="board-type-selector">
                  <label>Create as:</label>
                  <div className="board-type-buttons">
                    <button
                      className={`type-btn ${boardType === 'gameboard' ? 'active' : ''}`}
                      onClick={() => handleBoardTypeChange(boardIndex, 'gameboard')}
                    >
                      Gameboard
                    </button>
                    <button
                      className={`type-btn ${boardType === 'daily' ? 'active' : ''}`}
                      onClick={() => handleBoardTypeChange(boardIndex, 'daily')}
                    >
                      <Calendar size={16} />
                      Daily Board
                    </button>
                    <button
                      className={`type-btn ${boardType === 'timeless' ? 'active' : ''}`}
                      onClick={() => handleBoardTypeChange(boardIndex, 'timeless')}
                    >
                      <Infinity size={16} />
                      Timeless Board
                    </button>
                  </div>
                </div>

                {(boardType === 'daily' || boardType === 'timeless') && (
                  <div className="board-metadata">
                    <div className="metadata-field">
                      <label htmlFor={`title-${boardIndex}`}>Title:</label>
                      <input
                        id={`title-${boardIndex}`}
                        type="text"
                        className="metadata-input"
                        value={boardMetadata[boardIndex]?.title || ''}
                        onChange={(e) => handleTitleChange(boardIndex, e.target.value)}
                        placeholder={`${boardType === 'daily' ? 'Everyday' : 'Timeless'} Board No. X`}
                      />
                    </div>
                    <div className="metadata-field">
                      <label htmlFor={`date-${boardIndex}`}>Date:</label>
                      <input
                        id={`date-${boardIndex}`}
                        type="date"
                        className={`metadata-input ${dateErrors[boardIndex] ? 'error' : ''}`}
                        value={boardMetadata[boardIndex]?.date || ''}
                        onChange={(e) => handleDateChange(boardIndex, e.target.value, boardType)}
                      />
                      {dateErrors[boardIndex] && (
                        <span className="error-message">{dateErrors[boardIndex]}</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="boards-layout">
                  <div className="input-board-section">
                    <h3>Input Board</h3>
                    <div className="board-grid">
                      {board.map((row, rowIndex) => (
                        <div key={rowIndex} className="board-row">
                          {row.map((letter, colIndex) => (
                            <input
                              key={colIndex}
                              type="text"
                              className="board-cell"
                              value={letter === 'QU' ? 'Qu' : letter}
                              onChange={(e) =>
                                handleLetterChange(boardIndex, rowIndex, colIndex, e.target.value)
                              }
                              onKeyDown={(e) =>
                                handleKeyDown(e, boardIndex, rowIndex, colIndex)
                              }
                              onFocus={(e) => e.target.select()}
                              maxLength={letter === 'QU' ? 2 : 1}
                              data-board={boardIndex}
                              data-row={rowIndex}
                              data-col={colIndex}
                              placeholder=""
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  {showMarkingBoard && boojumBoard && (
                    <div className="marking-board-section">
                      <h3>Mark Boojum/Snark</h3>
                      <div className="marking-controls">
                        <button
                          className={`mark-btn snark-btn ${activeMarkingMode === 'snark' ? 'active' : ''}`}
                          onClick={() => setActiveMarkingMode(activeMarkingMode === 'snark' ? null : 'snark')}
                        >
                          Snark
                        </button>
                        <button
                          className={`mark-btn boojum-btn ${activeMarkingMode === 'boojum' ? 'active' : ''}`}
                          onClick={() => setActiveMarkingMode(activeMarkingMode === 'boojum' ? null : 'boojum')}
                        >
                          Boojum
                        </button>
                      </div>
                      <div className="board-grid marking-board">
                        {board.map((row, rowIndex) => (
                          <div key={rowIndex} className="board-row">
                            {row.map((letter, colIndex) => {
                              const markValue = boojumBoard[rowIndex][colIndex];
                              const isSnark = markValue === 1;
                              const isBoojum = markValue === 2;
                              
                              return (
                                <div
                                  key={colIndex}
                                  className={`marking-cell ${isSnark ? 'snark' : ''} ${isBoojum ? 'boojum' : ''}`}
                                  onClick={() => handleMarkLetter(boardIndex, rowIndex, colIndex)}
                                  title={letter || 'Empty'}
                                >
                                  {letter === 'QU' ? 'Qu' : (letter || '')}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      {activeMarkingMode && (
                        <p className="marking-hint">
                          Click letters on the board to mark them as {activeMarkingMode === 'snark' ? 'Snark' : 'Boojum'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="actions-container">
          <button
            className="add-board-btn"
            onClick={handleAddBoard}
            aria-label="Add another board"
          >
            <Plus size={20} />
            Add Board
          </button>

          <div className="submit-actions">
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Gameboards'}
            </button>

          </div>
        </div>

        {(isChecking || checkProgress.stage !== 'idle') && (
          <div className="progress-container">
            <div className="progress-bar-wrapper">
              <div className="progress-bar">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${checkProgress.progress}%` }}
                />
              </div>
              <p className="progress-message">{checkProgress.message}</p>
            </div>
          </div>
        )}

        {checkResults && (
          <div className="check-results">
            <h3>Definition Check Results</h3>
            <div className="results-summary">
              <div className="result-item">
                <span className="result-label">Total Words:</span>
                <span className="result-value">{checkResults.total_words}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Found:</span>
                <span className="result-value success">
                  <CheckCircle size={16} />
                  {checkResults.found_count}
                </span>
              </div>
              {checkResults.definitions_created !== undefined && (
                <div className="result-item">
                  <span className="result-label">Created:</span>
                  <span className="result-value success">
                    <CheckCircle size={16} />
                    {checkResults.definitions_created}
                  </span>
                </div>
              )}
              {checkResults.definitions_updated !== undefined && (
                <div className="result-item">
                  <span className="result-label">Updated:</span>
                  <span className="result-value success">
                    <CheckCircle size={16} />
                    {checkResults.definitions_updated}
                  </span>
                </div>
              )}
              {checkResults.definitions_failed !== undefined && checkResults.definitions_failed > 0 && (
                <div className="result-item">
                  <span className="result-label">Failed:</span>
                  <span className="result-value warning">
                    <AlertCircle size={16} />
                    {checkResults.definitions_failed}
                  </span>
                </div>
              )}
              {checkResults.missing_count > 0 && checkResults.definitions_created === undefined && (
                <div className="result-item">
                  <span className="result-label">Missing:</span>
                  <span className="result-value warning">
                    <AlertCircle size={16} />
                    {checkResults.missing_count}
                  </span>
                </div>
              )}
            </div>

            {checkResults.created_words && checkResults.created_words.length > 0 && (
              <div className="created-words">
                <h4>New Definitions Created:</h4>
                <div className="words-list">
                  {checkResults.created_words.map((word, idx) => (
                    <span key={idx} className="word-tag success">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {checkResults.updated_words && checkResults.updated_words.length > 0 && (
              <div className="updated-words">
                <h4>Definitions Updated:</h4>
                <div className="words-list">
                  {checkResults.updated_words.map((word, idx) => (
                    <span key={idx} className="word-tag info">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {checkResults.failed_words && checkResults.failed_words.length > 0 && (
              <div className="failed-words">
                <h4>Failed to Fetch:</h4>
                <div className="words-list">
                  {checkResults.failed_words.map((word, idx) => (
                    <span key={idx} className="word-tag error">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {checkResults.missing_words.length > 0 && 
             !checkResults.created_words && 
             !checkResults.updated_words && (
              <div className="missing-words">
                <h4>Missing Words:</h4>
                <div className="words-list">
                  {checkResults.missing_words.map((word, idx) => (
                    <span key={idx} className="word-tag">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateCustomGameboardPage;

