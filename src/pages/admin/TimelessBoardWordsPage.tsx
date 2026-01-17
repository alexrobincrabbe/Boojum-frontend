import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Edit, Save, X, ChevronDown, ChevronUp } from 'lucide-react';
import './TimelessBoardWordsPage.css';

interface TimelessBoard {
  id: number;
  title: string;
  date: string;
  type: string;
  board_id: number | null;
}

interface WordsData {
  '1': string[];
  '5': string[];
  '10': string[];
}

interface BoardWordsResponse {
  board_id: number;
  board_title: string;
  board_date: string;
  words: WordsData;
}

const TimelessBoardWordsPage = () => {
  const { user } = useAuth();
  const [boards, setBoards] = useState<TimelessBoard[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedBoardId, setExpandedBoardId] = useState<number | null>(null);
  const [editingBoardId, setEditingBoardId] = useState<number | null>(null);
  const [wordsData, setWordsData] = useState<WordsData | null>(null);
  const [originalWordsData, setOriginalWordsData] = useState<WordsData | null>(null);
  const [loadingWords, setLoadingWords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggedWord, setDraggedWord] = useState<{ word: string; sourceFreq: string } | null>(null);
  const [touchDragState, setTouchDragState] = useState<{
    word: string;
    sourceFreq: string;
    previewElement: HTMLElement | null;
  } | null>(null);

  useEffect(() => {
    if (!user?.is_superuser) {
      return;
    }
    loadBoards();
  }, [user, currentPage]);

  const loadBoards = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.listTimelessBoards(currentPage);
      setBoards(response.boards);
      setTotalPages(response.total_pages);
    } catch (error: any) {
      console.error('Error loading boards:', error);
      toast.error('Failed to load timeless boards');
    } finally {
      setLoading(false);
    }
  };

  const handleBoardClick = async (boardId: number) => {
    if (expandedBoardId === boardId) {
      setExpandedBoardId(null);
      setWordsData(null);
      setEditingBoardId(null);
    } else {
      setExpandedBoardId(boardId);
      setEditingBoardId(null);
      await loadWords(boardId);
    }
  };

  const loadWords = async (boardId: number) => {
    try {
      setLoadingWords(true);
      const response: BoardWordsResponse = await adminAPI.getTimelessBoardWords(boardId);
      setWordsData(response.words);
      setOriginalWordsData(JSON.parse(JSON.stringify(response.words))); // Deep copy
    } catch (error: any) {
      console.error('Error loading words:', error);
      toast.error('Failed to load words');
    } finally {
      setLoadingWords(false);
    }
  };

  const handleEdit = () => {
    if (expandedBoardId) {
      setEditingBoardId(expandedBoardId);
    }
  };

  const handleCancel = () => {
    if (originalWordsData) {
      setWordsData(JSON.parse(JSON.stringify(originalWordsData))); // Reset to original
    }
    setEditingBoardId(null);
    setDraggedWord(null);
  };

  const handleSubmit = async () => {
    if (!editingBoardId || !wordsData) {
      return;
    }

    try {
      setSaving(true);
      await adminAPI.updateTimelessBoardWordFrequencies(editingBoardId, wordsData);
      setOriginalWordsData(JSON.parse(JSON.stringify(wordsData))); // Update original
      setEditingBoardId(null);
      setDraggedWord(null);
      toast.success('Word frequencies updated successfully');
    } catch (error: any) {
      console.error('Error updating words:', error);
      toast.error(error.response?.data?.error || 'Failed to update word frequencies');
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, word: string, sourceFreq: string) => {
    if (!editingBoardId) return;
    setDraggedWord({ word, sourceFreq });
    e.dataTransfer.effectAllowed = 'move';
    
    // Create a custom drag preview element
    const dragPreview = document.createElement('div');
    dragPreview.textContent = word;
    dragPreview.style.padding = '0.5rem 1rem';
    dragPreview.style.background = 'rgba(59, 130, 246, 0.95)';
    dragPreview.style.border = '2px solid #60a5fa';
    dragPreview.style.borderRadius = '6px';
    dragPreview.style.color = '#ffffff';
    dragPreview.style.fontSize = '0.95rem';
    dragPreview.style.fontWeight = '600';
    dragPreview.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    dragPreview.style.position = 'absolute';
    dragPreview.style.top = '-1000px';
    dragPreview.style.left = '-1000px';
    dragPreview.style.pointerEvents = 'none';
    dragPreview.style.zIndex = '10000';
    document.body.appendChild(dragPreview);
    
    // Calculate center offset for better drag preview positioning
    const offsetX = dragPreview.offsetWidth / 2;
    const offsetY = dragPreview.offsetHeight / 2;
    
    // Set the drag image (browser takes a snapshot, so we can remove it immediately)
    e.dataTransfer.setDragImage(dragPreview, offsetX, offsetY);
    
    // Remove the preview element after browser captures it
    requestAnimationFrame(() => {
      if (document.body.contains(dragPreview)) {
        document.body.removeChild(dragPreview);
      }
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetFreq: string) => {
    e.preventDefault();
    if (!draggedWord || !wordsData || !editingBoardId) return;

    const { word, sourceFreq } = draggedWord;
    
    // Don't do anything if dropping in the same column
    if (sourceFreq === targetFreq) {
      setDraggedWord(null);
      return;
    }

    // Remove word from source frequency
    const newWordsData = { ...wordsData };
    newWordsData[sourceFreq as keyof WordsData] = newWordsData[sourceFreq as keyof WordsData].filter(w => w !== word);
    
    // Add word to target frequency (sorted)
    newWordsData[targetFreq as keyof WordsData] = [...newWordsData[targetFreq as keyof WordsData], word].sort();
    
    setWordsData(newWordsData);
    setDraggedWord(null);
    
    // Show toast confirmation
    toast.success(`"${word}" moved from Frequency ${sourceFreq} to Frequency ${targetFreq}`);
  };

  const handleDragEnd = () => {
    setDraggedWord(null);
  };

  // Effect to handle document-level touch events for dragging
  useEffect(() => {
    if (!touchDragState) return;

    const handleTouchMoveDoc = (e: TouchEvent) => {
      if (!touchDragState?.previewElement) return;
      
      const touch = e.touches[0];
      if (!touch) return;
      
      const preview = touchDragState.previewElement;
      preview.style.left = `${touch.clientX}px`;
      preview.style.top = `${touch.clientY}px`;
      
      e.preventDefault();
    };

    const handleTouchEndDoc = (e: TouchEvent) => {
      if (!touchDragState || !wordsData || !editingBoardId) {
        if (touchDragState?.previewElement && document.body.contains(touchDragState.previewElement)) {
          document.body.removeChild(touchDragState.previewElement);
        }
        setTouchDragState(null);
        return;
      }
      
      const touch = e.changedTouches[0];
      if (!touch) {
        if (touchDragState.previewElement && document.body.contains(touchDragState.previewElement)) {
          document.body.removeChild(touchDragState.previewElement);
        }
        setTouchDragState(null);
        return;
      }
      
      const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Find the closest word column
      let targetFreq: string | null = null;
      let currentElement: Element | null = elementBelow;
      
      while (currentElement) {
        if (currentElement.classList.contains('word-column')) {
          const freqMatch = currentElement.querySelector('.column-header h3')?.textContent?.match(/Frequency (\d+)/);
          if (freqMatch) {
            targetFreq = freqMatch[1];
            break;
          }
        }
        currentElement = currentElement.parentElement;
      }
      
      // Clean up preview
      if (touchDragState.previewElement && document.body.contains(touchDragState.previewElement)) {
        document.body.removeChild(touchDragState.previewElement);
      }
      
      // Handle drop if we found a valid target
      if (targetFreq) {
        const { word, sourceFreq } = touchDragState;
        
        if (sourceFreq !== targetFreq) {
          const newWordsData = { ...wordsData };
          newWordsData[sourceFreq as keyof WordsData] = newWordsData[sourceFreq as keyof WordsData].filter(w => w !== word);
          newWordsData[targetFreq as keyof WordsData] = [...newWordsData[targetFreq as keyof WordsData], word].sort();
          setWordsData(newWordsData);
          
          // Show toast confirmation
          toast.success(`"${word}" moved from Frequency ${sourceFreq} to Frequency ${targetFreq}`);
        }
      }
      
      setTouchDragState(null);
    };

    document.addEventListener('touchmove', handleTouchMoveDoc, { passive: false });
    document.addEventListener('touchend', handleTouchEndDoc, { passive: false });

    return () => {
      document.removeEventListener('touchmove', handleTouchMoveDoc);
      document.removeEventListener('touchend', handleTouchEndDoc);
    };
  }, [touchDragState, wordsData, editingBoardId]);

  const handleTouchStart = (e: React.TouchEvent, word: string, sourceFreq: string) => {
    if (!editingBoardId) return;
    
    const touch = e.touches[0];
    
    // Create a preview element that follows the touch
    const preview = document.createElement('div');
    preview.textContent = word;
    preview.className = 'touch-drag-preview';
    preview.style.position = 'fixed';
    preview.style.left = `${touch.clientX}px`;
    preview.style.top = `${touch.clientY}px`;
    preview.style.transform = 'translate(-50%, -50%)';
    preview.style.pointerEvents = 'none';
    preview.style.zIndex = '10000';
    document.body.appendChild(preview);
    
    setTouchDragState({
      word,
      sourceFreq,
      previewElement: preview,
    });
    
    // Prevent default to avoid scrolling
    e.preventDefault();
  };

  if (!user?.is_superuser) {
    return (
      <div className="timeless-board-words-page">
        <div className="page-container">
          <h1>Timeless Board Words</h1>
          <p>You must be a superuser to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="timeless-board-words-page">
      <div className="page-container">
        <h1>Timeless Board Word Lists</h1>
        <p className="page-description">Manage word frequencies for timeless boards. Click on a board to view and edit its words.</p>

        {loading ? (
          <div className="loading">Loading boards...</div>
        ) : (
          <>
            <div className="boards-list">
              {boards.map((board) => (
                <div key={board.id} className="board-item">
                  <div
                    className="board-header"
                    onClick={() => handleBoardClick(board.id)}
                  >
                    <div className="board-header-left">
                      <span className="board-title">{board.title}</span>
                      <span className="board-date">{board.date}</span>
                    </div>
                    <div className="board-header-right">
                      {expandedBoardId === board.id ? (
                        <ChevronUp size={20} />
                      ) : (
                        <ChevronDown size={20} />
                      )}
                    </div>
                  </div>

                  {expandedBoardId === board.id && (
                    <div className="board-words-container">
                      {loadingWords ? (
                        <div className="loading">Loading words...</div>
                      ) : wordsData ? (
                        <>
                          <div className="words-actions">
                            {editingBoardId === board.id ? (
                              <>
                                <button
                                  className="btn btn-save"
                                  onClick={handleSubmit}
                                  disabled={saving}
                                >
                                  <Save size={16} />
                                  {saving ? 'Saving...' : 'Submit'}
                                </button>
                                <button
                                  className="btn btn-cancel"
                                  onClick={handleCancel}
                                  disabled={saving}
                                >
                                  <X size={16} />
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                className="btn btn-edit"
                                onClick={handleEdit}
                              >
                                <Edit size={16} />
                                Edit
                              </button>
                            )}
                          </div>

                          <div className="words-columns">
                            {(['1', '5', '10'] as const).map((freq) => (
                              <div
                                key={freq}
                                className={`word-column ${editingBoardId === board.id ? 'editable' : ''}`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => editingBoardId === board.id && handleDrop(e, freq)}
                              >
                                <div className="column-header">
                                  <h3>Frequency {freq}</h3>
                                  <span className="word-count">
                                    {wordsData[freq].length} words
                                  </span>
                                </div>
                                <div className="word-list">
                                  {wordsData[freq].map((word) => (
                                    <div
                                      key={word}
                                      className={`word-item ${editingBoardId === board.id ? 'draggable' : ''}`}
                                      draggable={editingBoardId === board.id}
                                      onDragStart={(e) => handleDragStart(e, word, freq)}
                                      onDragEnd={handleDragEnd}
                                      onTouchStart={(e) => editingBoardId === board.id && handleTouchStart(e, word, freq)}
                                    >
                                      {word}
                                    </div>
                                  ))}
                                  {wordsData[freq].length === 0 && (
                                    <div className="empty-column">No words</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="error">Failed to load words</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="page-info">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TimelessBoardWordsPage;

