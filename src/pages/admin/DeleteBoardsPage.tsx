import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { adminAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Trash2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import './DeleteBoardsPage.css';

interface Board {
  id: number;
  type: 'gameboard' | 'daily' | 'timeless';
  title: string;
  created_date: string | null;
  date?: string | null;
  number_of_words?: number;
  board_size?: number;
  language?: string;
  is_special?: boolean;
  played?: boolean;
  board_id?: number | null;
  type_game?: string;
  longest_word?: string;
}

const DeleteBoardsPage = () => {
  const { user } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<{ [key: number]: boolean }>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [boardType, setBoardType] = useState<'all' | 'gameboard' | 'daily' | 'timeless'>('all');

  useEffect(() => {
    if (user?.is_superuser) {
      loadBoards();
    }
  }, [user, page, boardType]);

  const loadBoards = async () => {
    setIsLoading(true);
    try {
      const data = await adminAPI.listBoardsForDeletion(page, 20, boardType);
      setBoards(data.boards || []);
      setTotalPages(data.total_pages || 1);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load boards');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (board: Board) => {
    if (!window.confirm(`Are you sure you want to delete ${board.title}? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting({ ...isDeleting, [board.id]: true });
    try {
      if (board.type === 'gameboard') {
        await adminAPI.deleteGameboard(board.id);
      } else if (board.type === 'daily') {
        await adminAPI.deleteDailyBoard(board.id);
      } else if (board.type === 'timeless') {
        await adminAPI.deleteTimelessBoard(board.id);
      }
      toast.success(`${board.title} deleted successfully`);
      // Reload boards
      await loadBoards();
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to delete ${board.title}`);
    } finally {
      setIsDeleting({ ...isDeleting, [board.id]: false });
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getBoardTypeLabel = (type: string) => {
    switch (type) {
      case 'gameboard':
        return 'Gameboard';
      case 'daily':
        return 'Daily Board';
      case 'timeless':
        return 'Timeless Board';
      default:
        return type;
    }
  };

  if (!user?.is_superuser) {
    return (
      <div className="delete-boards-page">
        <div className="page-container">
          <h1>Delete Boards</h1>
          <p>You must be a superuser to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="delete-boards-page">
      <div className="page-container">
        <div className="delete-boards-header">
          <h1>Delete Boards</h1>
          <button
            className="refresh-btn"
            onClick={loadBoards}
            disabled={isLoading}
            title="Refresh boards list"
          >
            <RefreshCw size={20} className={isLoading ? 'spinning' : ''} />
          </button>
        </div>

        <div className="board-type-filter">
          <label>Filter by type:</label>
          <select
            value={boardType}
            onChange={(e) => {
              setBoardType(e.target.value as 'all' | 'gameboard' | 'daily' | 'timeless');
              setPage(1);
            }}
          >
            <option value="all">All Boards</option>
            <option value="gameboard">Gameboards</option>
            <option value="daily">Daily Boards</option>
            <option value="timeless">Timeless Boards</option>
          </select>
        </div>

        {isLoading ? (
          <div className="loading-state">Loading boards...</div>
        ) : boards.length === 0 ? (
          <div className="empty-state">No boards found.</div>
        ) : (
          <>
            <div className="boards-list">
              {boards.map((board) => (
                <div key={`${board.type}-${board.id}`} className="board-item">
                  <div className="board-info">
                    <div className="board-header-row">
                      <h3>{board.title}</h3>
                      <span className={`board-type-badge ${board.type}`}>
                        {getBoardTypeLabel(board.type)}
                      </span>
                    </div>
                    <div className="board-details">
                      <div className="detail-item">
                        <span className="detail-label">ID:</span>
                        <span className="detail-value">{board.id}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Created:</span>
                        <span className="detail-value">{formatDate(board.created_date)}</span>
                      </div>
                      {board.date && (
                        <div className="detail-item">
                          <span className="detail-label">Date:</span>
                          <span className="detail-value">{formatDate(board.date)}</span>
                        </div>
                      )}
                      {board.number_of_words !== undefined && (
                        <div className="detail-item">
                          <span className="detail-label">Words:</span>
                          <span className="detail-value">{board.number_of_words}</span>
                        </div>
                      )}
                      {board.board_size && (
                        <div className="detail-item">
                          <span className="detail-label">Size:</span>
                          <span className="detail-value">{board.board_size}x{board.board_size}</span>
                        </div>
                      )}
                      {board.language && (
                        <div className="detail-item">
                          <span className="detail-label">Language:</span>
                          <span className="detail-value">{board.language.toUpperCase()}</span>
                        </div>
                      )}
                      {board.is_special !== undefined && (
                        <div className="detail-item">
                          <span className="detail-label">Special:</span>
                          <span className="detail-value">{board.is_special ? 'Yes' : 'No'}</span>
                        </div>
                      )}
                      {board.played !== undefined && (
                        <div className="detail-item">
                          <span className="detail-label">Played:</span>
                          <span className="detail-value">{board.played ? 'Yes' : 'No'}</span>
                        </div>
                      )}
                      {board.board_id && (
                        <div className="detail-item">
                          <span className="detail-label">GameBoard ID:</span>
                          <span className="detail-value">{board.board_id}</span>
                        </div>
                      )}
                      {board.type_game && (
                        <div className="detail-item">
                          <span className="detail-label">Game Type:</span>
                          <span className="detail-value">{board.type_game}</span>
                        </div>
                      )}
                      {board.longest_word && board.longest_word !== '-' && (
                        <div className="detail-item">
                          <span className="detail-label">Longest Word:</span>
                          <span className="detail-value longest-word-value">{board.longest_word}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(board)}
                    disabled={isDeleting[board.id]}
                    title={`Delete ${board.title}`}
                  >
                    {isDeleting[board.id] ? (
                      <RefreshCw size={18} className="spinning" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                    Delete
                  </button>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={20} />
                  Previous
                </button>
                <span className="pagination-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DeleteBoardsPage;

