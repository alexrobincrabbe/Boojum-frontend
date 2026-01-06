import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Plus, X, CheckCircle, AlertCircle } from 'lucide-react';
import './CreateCustomGameboardPage.css';

type Board = string[][];
type BoojumBoard = number[][]; // 0 = normal, 1 = snark, 2 = boojum
type BoardType = 'gameboard' | null;


const CreateCustomGameboardPage = () => {
  const { user } = useAuth();
  const [boardSize, setBoardSize] = useState<number>(4);
  const [boards, setBoards] = useState<Board[]>([[]]);
  const [boardTypes, setBoardTypes] = useState<BoardType[]>(['gameboard']);
  const [boojumBoards, setBoojumBoards] = useState<BoojumBoard[]>([]);
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

  function createEmptyBoard(size: number = boardSize): Board {
    return Array(size).fill(null).map(() => Array(size).fill(''));
  }

  function createEmptyBoojumBoard(size: number = boardSize): BoojumBoard {
    return Array(size).fill(null).map(() => Array(size).fill(0));
  }

  useEffect(() => {
    // Initialize boards with correct size
    if (boards.length === 0 || (boards[0] && boards[0].length !== boardSize)) {
      setBoards([createEmptyBoard(boardSize)]);
    }
  }, [boardSize]);


  const handleAddBoard = () => {
    setBoards([...boards, createEmptyBoard(boardSize)]);
    setBoardTypes([...boardTypes, 'gameboard']);
  };

  const handleBoardSizeChange = (newSize: number) => {
    setBoardSize(newSize);
    // Resize all existing boards
    const resizedBoards = boards.map(board => {
      const resized: Board = [];
      for (let r = 0; r < newSize; r++) {
        const row: string[] = [];
        for (let c = 0; c < newSize; c++) {
          row.push(board[r]?.[c] || '');
        }
        resized.push(row);
      }
      return resized;
    });
    setBoards(resizedBoards);
    
    // Resize boojum boards
    const resizedBoojumBoards = boojumBoards.map(boojumBoard => {
      if (!boojumBoard) return createEmptyBoojumBoard(newSize);
      const resized: BoojumBoard = [];
      for (let r = 0; r < newSize; r++) {
        const row: number[] = [];
        for (let c = 0; c < newSize; c++) {
          row.push(boojumBoard[r]?.[c] || 0);
        }
        resized.push(row);
      }
      return resized;
    });
    setBoojumBoards(resizedBoojumBoards);
  };

  const handleRemoveBoard = (index: number) => {
    if (boards.length > 1) {
      setBoards(boards.filter((_, i) => i !== index));
      setBoardTypes(boardTypes.filter((_, i) => i !== index));
      setBoojumBoards(boojumBoards.filter((_, i) => i !== index));
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
        if (nextCol >= boardSize) {
          nextCol = 0;
          nextRow = rowIndex + 1;
        }
        
        // Move to next board if at end of current board
        if (nextRow >= boardSize) {
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
        if (nextCol >= boardSize) {
          nextCol = 0;
          nextRow = rowIndex + 1;
        }
        
        // Move to next board if at end of current board
        if (nextRow >= boardSize) {
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
          prevCol = boardSize - 1;
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
    } else if (e.key === 'ArrowRight' && colIndex < boardSize - 1) {
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
    } else if (e.key === 'ArrowDown' && rowIndex < boardSize - 1) {
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
      for (let rowIndex = 0; rowIndex < boardSize; rowIndex++) {
        for (let colIndex = 0; colIndex < boardSize; colIndex++) {
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

      // No validation needed for daily/timeless boards (removed from this page)

    setIsSubmitting(true);
    try {
      // Create gameboards only (daily/timeless creation moved to convert boards page)
      const response = await adminAPI.createCustomGameboards(boards, boardSize);
      const allBoardIds = response.boards.map((b: any) => b.id);

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

        <div className="board-size-selector" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
          <label htmlFor="board-size" style={{ marginRight: '10px', fontWeight: 'bold', color: '#333' }}>Board Size:</label>
          <select
            id="board-size"
            value={boardSize}
            onChange={(e) => handleBoardSizeChange(parseInt(e.target.value))}
            style={{ padding: '5px 10px', fontSize: '14px', borderRadius: '4px', backgroundColor: '#fff', color: '#333', border: '1px solid #ccc' }}
          >
            <option value="4">4x4 (Standard)</option>
            <option value="5">5x5 (Big Board)</option>
          </select>
        </div>

        <div className="boards-container">
          {boards.map((board, boardIndex) => {
            // Board type is always 'gameboard' now (daily/timeless removed)
            // const boardType = boardTypes[boardIndex] || 'gameboard';
            // const boojumBoard = boojumBoards[boardIndex];
            // const showMarkingBoard = false; // No longer needed - marking only for daily/timeless

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
                    {/* Board type selection removed - only gameboards are created on this page */}
                    {/* Daily and timeless boards are created via the convert boards page */}
                  </div>
                </div>

                {/* Metadata fields removed - only for daily/timeless boards which are created via convert boards page */}

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

                  {/* Marking board section removed - boojum/snark marking is only for daily/timeless boards */}
                  {/* Daily and timeless boards are created via the convert boards page */}
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

