import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Calendar, Infinity, RefreshCw } from 'lucide-react';
import './ConvertSpecialBoardsPage.css';

type Board = string[][];
type BoojumBoard = number[][]; // 0 = normal, 1 = snark, 2 = boojum
type BoardType = 'daily' | 'timeless' | null;

interface BoardMetadata {
  title: string;
  date: string;
}

interface AvailableBoard {
  id: number;
  letters: Board;
  words: string[];
  number_of_words: number;
  create_date: string | null;
}

const ConvertSpecialBoardsPage = () => {
  const { user } = useAuth();
  const [availableBoards, setAvailableBoards] = useState<AvailableBoard[]>([]);
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<number>>(new Set());
  const [boardTypes, setBoardTypes] = useState<{ [key: number]: BoardType }>({});
  const [boojumBoards, setBoojumBoards] = useState<{ [key: number]: BoojumBoard }>({});
  const [boardMetadata, setBoardMetadata] = useState<{ [key: number]: BoardMetadata }>({});
  const [activeMarkingMode, setActiveMarkingMode] = useState<{ [key: number]: 'snark' | 'boojum' | null }>({});
  const [dateErrors, setDateErrors] = useState<{ [key: number]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  function createEmptyBoojumBoard(): BoojumBoard {
    return [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
  }

  useEffect(() => {
    loadAvailableBoards();
  }, []);

  useEffect(() => {
    // Load default dates when boards are selected
    const loadDefaultDates = async () => {
      try {
        await adminAPI.getDefaultBoardDates();
        const newMetadata = { ...boardMetadata };
        const newTypes = { ...boardTypes };
        
        for (const boardId of selectedBoardIds) {
          if (!newMetadata[boardId]) {
            newMetadata[boardId] = { title: '', date: '' };
          }
          if (!newTypes[boardId]) {
            newTypes[boardId] = null;
          }
        }
        
        setBoardMetadata(newMetadata);
      } catch (error) {
        console.error('Error loading default dates:', error);
      }
    };
    
    if (selectedBoardIds.size > 0) {
      loadDefaultDates();
    }
  }, [selectedBoardIds]);

  const loadAvailableBoards = async () => {
    setIsLoading(true);
    try {
      const data = await adminAPI.getAvailableSpecialBoards();
      setAvailableBoards(data.boards || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load available boards');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBoardToggle = (boardId: number) => {
    const newSelected = new Set(selectedBoardIds);
    if (newSelected.has(boardId)) {
      newSelected.delete(boardId);
      // Clean up state for deselected board
      const newTypes = { ...boardTypes };
      const newBoojum = { ...boojumBoards };
      const newMetadata = { ...boardMetadata };
      const newMarkingMode = { ...activeMarkingMode };
      const newDateErrors = { ...dateErrors };
      delete newTypes[boardId];
      delete newBoojum[boardId];
      delete newMetadata[boardId];
      delete newMarkingMode[boardId];
      delete newDateErrors[boardId];
      setBoardTypes(newTypes);
      setBoojumBoards(newBoojum);
      setBoardMetadata(newMetadata);
      setActiveMarkingMode(newMarkingMode);
      setDateErrors(newDateErrors);
    } else {
      newSelected.add(boardId);
      // Initialize boojum board
      const newBoojum = { ...boojumBoards };
      if (!newBoojum[boardId]) {
        newBoojum[boardId] = createEmptyBoojumBoard();
      }
      setBoojumBoards(newBoojum);
    }
    setSelectedBoardIds(newSelected);
  };

  const getNextDate = (type: 'daily' | 'timeless', baseDate: string, currentMetadata: { [key: number]: BoardMetadata }, currentTypes: { [key: number]: BoardType }, excludeBoardId: number): string => {
    // Base date from database is already the next date (last date + 1 day)
    let latestDate = new Date(baseDate);
    
    // Find the highest date among boards of the same type in current session
    // Exclude the current board (excludeBoardId) from the calculation
    for (const [id, metadata] of Object.entries(currentMetadata)) {
      const boardId = parseInt(id);
      // Skip the current board and only consider boards of the exact same type
      if (boardId !== excludeBoardId && currentTypes[boardId] === type && metadata?.date) {
        const date = new Date(metadata.date);
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

  const handleBoardTypeChange = async (boardId: number, type: BoardType) => {
    const newTypes = { ...boardTypes };
    const previousType = newTypes[boardId];
    newTypes[boardId] = type;
    setBoardTypes(newTypes);

    // Initialize boojum board if switching to daily/timeless
    if (type === 'daily' || type === 'timeless') {
      const newBoojum = { ...boojumBoards };
      if (!newBoojum[boardId]) {
        newBoojum[boardId] = createEmptyBoojumBoard();
      }
      setBoojumBoards(newBoojum);

      const newMetadata = { ...boardMetadata };
      if (!newMetadata[boardId]) {
        newMetadata[boardId] = { title: '', date: '' };
      }
      
      // Only update date if switching from a different type or if date is not set
      const shouldUpdateDate = previousType !== type || !newMetadata[boardId].date;

      if (shouldUpdateDate) {
        // Load default date and title
        try {
          const data = await adminAPI.getDefaultBoardDates();
          
          // Calculate next date considering both database and current session
          // Exclude current board from calculation
          let nextDate: string;
          let boardNumber: number;
          
          if (type === 'daily') {
            // Only look at other daily boards (excluding current) for date calculation
            nextDate = getNextDate('daily', data.next_daily_date || '', newMetadata, newTypes, boardId);
            // Count only other daily boards in the current session (excluding current)
            const dailyCount = Object.entries(newTypes).filter(([id, t]) => t === 'daily' && parseInt(id) !== boardId).length;
            boardNumber = (data.next_daily_number || 1) + dailyCount;
            newMetadata[boardId].date = nextDate;
            newMetadata[boardId].title = `Daily Board #${boardNumber}`;
          } else if (type === 'timeless') {
            // Only look at other timeless boards (excluding current) for date calculation
            nextDate = getNextDate('timeless', data.next_timeless_date || '', newMetadata, newTypes, boardId);
            // Count only other timeless boards in the current session (excluding current)
            const timelessCount = Object.entries(newTypes).filter(([id, t]) => t === 'timeless' && parseInt(id) !== boardId).length;
            boardNumber = (data.next_timeless_number || 1) + timelessCount;
            newMetadata[boardId].date = nextDate;
            newMetadata[boardId].title = `Timeless Board #${boardNumber}`;
          }
          
          setBoardMetadata(newMetadata);
        } catch (error) {
          console.error('Error loading default dates:', error);
        }
      }
    }
  };

  const handleTitleChange = (boardId: number, title: string) => {
    const newMetadata = { ...boardMetadata };
    if (!newMetadata[boardId]) {
      newMetadata[boardId] = { title: '', date: '' };
    }
    newMetadata[boardId].title = title;
    setBoardMetadata(newMetadata);
  };

  const handleDateChange = async (boardId: number, date: string) => {
    const newMetadata = { ...boardMetadata };
    if (!newMetadata[boardId]) {
      newMetadata[boardId] = { title: '', date: '' };
    }
    newMetadata[boardId].date = date;
    setBoardMetadata(newMetadata);

    const boardType = boardTypes[boardId];
    if (date && (boardType === 'daily' || boardType === 'timeless')) {
      try {
        const response = await adminAPI.checkBoardDate(date, boardType);
        if (!response.available) {
          const newDateErrors = { ...dateErrors };
          newDateErrors[boardId] = response.message || 'A board already exists for this date';
          setDateErrors(newDateErrors);
        } else {
          const newDateErrors = { ...dateErrors };
          delete newDateErrors[boardId];
          setDateErrors(newDateErrors);
        }
      } catch (error: any) {
        const newDateErrors = { ...dateErrors };
        newDateErrors[boardId] = error.response?.data?.error || 'Error checking date';
        setDateErrors(newDateErrors);
      }
    }
  };

  const handleMarkLetter = (boardId: number, rowIndex: number, colIndex: number) => {
    const markingMode = activeMarkingMode[boardId];
    if (!markingMode) {
      toast.error('Please select Snark or Boojum mode first');
      return;
    }

    const board = availableBoards.find(b => b.id === boardId);
    if (!board) return;

    const letter = board.letters[rowIndex][colIndex];
    
    if (!letter || letter.trim() === '') {
      toast.error('Cannot mark empty cell');
      return;
    }

    // Check if this letter appears elsewhere on the board
    const letterPositions: [number, number][] = [];
    
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board.letters[r][c] === letter) {
          letterPositions.push([r, c]);
        }
      }
    }

    // If letter appears more than once, show error
    if (letterPositions.length > 1) {
      toast.error(`${letter} appears ${letterPositions.length} times on the board. Each letter can only appear once to be marked.`);
      return;
    }

    const boojumBoard = { ...boojumBoards[boardId] };
    const markValue = markingMode === 'snark' ? 1 : 2;

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

    const newBoojumBoards = { ...boojumBoards };
    newBoojumBoards[boardId] = boojumBoard;
    setBoojumBoards(newBoojumBoards);
    toast.success(`Marked "${letter}" as ${markingMode === 'snark' ? 'Snark' : 'Boojum'}`);
  };

  const handleSubmit = async () => {
    if (!user?.is_superuser) {
      toast.error('Only superusers can convert boards');
      return;
    }

    if (selectedBoardIds.size === 0) {
      toast.error('Please select at least one board');
      return;
    }

    // Validate selected boards
    for (const boardId of selectedBoardIds) {
      const boardType = boardTypes[boardId];
      if (!boardType || (boardType !== 'daily' && boardType !== 'timeless')) {
        toast.error(`Board ID ${boardId} must be set as Daily Board or Timeless Board`);
        return;
      }

      if (boardType === 'daily' || boardType === 'timeless') {
        const metadata = boardMetadata[boardId];
        if (!metadata || !metadata.title || !metadata.date) {
          toast.error(`Board ID ${boardId} (${boardType}) requires a title and date`);
          return;
        }
        if (dateErrors[boardId]) {
          toast.error(`Board ID ${boardId} has an invalid date: ${dateErrors[boardId]}`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      // Separate boards by type
      const dailyBoards: { board: Board; boojum: BoojumBoard; title: string; date: string; boardId: number }[] = [];
      const timelessBoards: { board: Board; boojum: BoojumBoard; title: string; date: string; boardId: number }[] = [];

      for (const boardId of selectedBoardIds) {
        const board = availableBoards.find(b => b.id === boardId);
        if (!board) continue;

        const boardType = boardTypes[boardId];
        const metadata = boardMetadata[boardId];
        const boojum = boojumBoards[boardId] || createEmptyBoojumBoard();

        if (boardType === 'daily') {
          dailyBoards.push({
            board: board.letters,
            boojum,
            title: metadata.title,
            date: metadata.date,
            boardId,
          });
        } else if (boardType === 'timeless') {
          timelessBoards.push({
            board: board.letters,
            boojum,
            title: metadata.title,
            date: metadata.date,
            boardId,
          });
        }
      }

      // Create daily boards
      if (dailyBoards.length > 0) {
        await adminAPI.createDailyBoards(dailyBoards.map(({ boardId, ...rest }) => rest));
      }

      // Create timeless boards
      if (timelessBoards.length > 0) {
        await adminAPI.createTimelessBoards(timelessBoards.map(({ boardId, ...rest }) => rest));
      }

      toast.success(`Successfully converted ${selectedBoardIds.size} board(s)!`);
      
      // Reload available boards
      await loadAvailableBoards();
      
      // Clear selections
      setSelectedBoardIds(new Set());
      setBoardTypes({});
      setBoojumBoards({});
      setBoardMetadata({});
      setActiveMarkingMode({});
      setDateErrors({});
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to convert boards');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user?.is_superuser) {
    return (
      <div className="convert-special-boards-page">
        <div className="page-container">
          <h1>Convert Special Boards</h1>
          <p>You must be a superuser to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="convert-special-boards-page">
      <div className="page-container">
        <h1>Convert Special Boards to Daily/Timeless</h1>
        <p className="page-description">
          Select existing special boards and convert them to Daily or Timeless boards.
        </p>

        <div className="actions-container">
          <button
            className="refresh-btn"
            onClick={loadAvailableBoards}
            disabled={isLoading}
          >
            <RefreshCw size={16} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {isLoading ? (
          <div className="loading-message">Loading available boards...</div>
        ) : availableBoards.length === 0 ? (
          <div className="no-boards-message">
            <p>No available special boards found.</p>
            <p>All special boards are already assigned to Daily or Timeless boards.</p>
          </div>
        ) : (
          <>
            <div className="boards-list">
              {availableBoards.map((board) => {
                const isSelected = selectedBoardIds.has(board.id);
                const boardType = boardTypes[board.id] || null;
                const boojumBoard = boojumBoards[board.id];
                const metadata = boardMetadata[board.id];
                const showMarkingBoard = isSelected && (boardType === 'daily' || boardType === 'timeless') && boojumBoard;
                const markingMode = activeMarkingMode[board.id];

                return (
                  <div key={board.id} className={`board-card ${isSelected ? 'selected' : ''}`}>
                    <div className="board-card-header">
                      <div className="board-info">
                        <h3>Board #{board.id}</h3>
                        {board.words && board.words.length > 0 && (
                          <p className="longest-word">
                            Longest word: <strong>{board.words.reduce((longest, word) => 
                              word.length > longest.length ? word : longest, '')}</strong>
                          </p>
                        )}
                        <p>{board.number_of_words} words</p>
                        {board.create_date && (
                          <p className="create-date">
                            Created: {new Date(board.create_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <label className="select-board-checkbox">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleBoardToggle(board.id)}
                        />
                        <span>Select</span>
                      </label>
                    </div>

                    {isSelected && (
                      <div className="board-card-content">
                        <div className="board-display-section">
                          <h4>Board</h4>
                          <div className="board-grid">
                            {board.letters.map((row, rowIndex) => (
                              <div key={rowIndex} className="board-row">
                                {row.map((letter, colIndex) => (
                                  <div
                                    key={colIndex}
                                    className="board-cell-display"
                                  >
                                    {letter === 'QU' ? 'Qu' : letter}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="board-type-selector">
                          <label>Create as:</label>
                          <div className="board-type-buttons">
                            <button
                              className={`type-btn ${boardType === 'daily' ? 'active' : ''}`}
                              onClick={() => handleBoardTypeChange(board.id, boardType === 'daily' ? null : 'daily')}
                            >
                              <Calendar size={16} />
                              Daily Board
                            </button>
                            <button
                              className={`type-btn ${boardType === 'timeless' ? 'active' : ''}`}
                              onClick={() => handleBoardTypeChange(board.id, boardType === 'timeless' ? null : 'timeless')}
                            >
                              <Infinity size={16} />
                              Timeless Board
                            </button>
                          </div>
                        </div>

                        {(boardType === 'daily' || boardType === 'timeless') && (
                          <>
                            <div className="board-metadata">
                              <div className="metadata-field">
                                <label>Title</label>
                                <input
                                  type="text"
                                  className="metadata-input"
                                  value={metadata?.title || ''}
                                  onChange={(e) => handleTitleChange(board.id, e.target.value)}
                                  placeholder="Enter title"
                                />
                              </div>
                              <div className="metadata-field">
                                <label>Date</label>
                                <input
                                  type="date"
                                  className={`metadata-input ${dateErrors[board.id] ? 'error' : ''}`}
                                  value={metadata?.date || ''}
                                  onChange={(e) => handleDateChange(board.id, e.target.value)}
                                />
                                {dateErrors[board.id] && (
                                  <div className="error-message">{dateErrors[board.id]}</div>
                                )}
                              </div>
                            </div>

                            {showMarkingBoard && (
                              <div className="marking-board-section">
                                <h4>Mark Boojum/Snark</h4>
                                <div className="marking-controls">
                                  <button
                                    className={`mark-btn snark-btn ${markingMode === 'snark' ? 'active' : ''}`}
                                    onClick={() => {
                                      const newMode = { ...activeMarkingMode };
                                      newMode[board.id] = markingMode === 'snark' ? null : 'snark';
                                      setActiveMarkingMode(newMode);
                                    }}
                                  >
                                    Snark
                                  </button>
                                  <button
                                    className={`mark-btn boojum-btn ${markingMode === 'boojum' ? 'active' : ''}`}
                                    onClick={() => {
                                      const newMode = { ...activeMarkingMode };
                                      newMode[board.id] = markingMode === 'boojum' ? null : 'boojum';
                                      setActiveMarkingMode(newMode);
                                    }}
                                  >
                                    Boojum
                                  </button>
                                </div>
                                <div className="marking-board">
                                  {board.letters.map((row, rowIndex) => (
                                    <div key={rowIndex} className="board-row">
                                      {row.map((letter, colIndex) => {
                                        const markValue = boojumBoard[rowIndex][colIndex];
                                        const isSnark = markValue === 1;
                                        const isBoojum = markValue === 2;
                                        
                                        return (
                                          <div
                                            key={colIndex}
                                            className={`marking-cell ${isSnark ? 'snark' : ''} ${isBoojum ? 'boojum' : ''}`}
                                            onClick={() => handleMarkLetter(board.id, rowIndex, colIndex)}
                                            title={letter || 'Empty'}
                                          >
                                            {letter === 'QU' ? 'Qu' : (letter || '')}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                                <p className="marking-hint">
                                  Click Snark or Boojum, then click a letter on the board to mark it.
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedBoardIds.size > 0 && (
              <div className="submit-section">
                <button
                  className="submit-btn"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Converting...' : `Convert ${selectedBoardIds.size} Board(s)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ConvertSpecialBoardsPage;

