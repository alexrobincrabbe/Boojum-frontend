import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { lobbyAPI } from '../../services/api';
import { toast } from 'react-toastify';
import './TimelessBoardPage.css';

interface ArchiveBoard {
  id: number;
  title: string;
  date: string;
  type: 'normal' | 'bonus';
  level: number;
  played: boolean;
  total_points: number;
  number_of_words: number;
}

const LEVELS = [
  { value: 4, name: 'Curious' },
  { value: 7, name: 'Curiouser' },
  { value: 10, name: 'Rabbit Hole' },
];

export default function TimelessBoardsArchivePage() {
  const [boards, setBoards] = useState<ArchiveBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const currentLevel = parseInt(searchParams.get('level') || '10', 10);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const fetchingRef = useRef(false);

  useEffect(() => {
    // Prevent duplicate requests (React StrictMode in dev causes double renders)
    if (fetchingRef.current) return;
    
    const fetchBoards = async () => {
      if (!isAuthenticated || !user?.is_premium) {
        toast.error('Premium subscription required to access archives');
        navigate('/dashboard');
        return;
      }

      fetchingRef.current = true;
      try {
        setLoading(true);
        const data = await lobbyAPI.getTimelessBoardsArchive(currentLevel, page, 20);
        setBoards(data.boards || []);
        setTotalPages(data.total_pages || 1);
        setHasNext(data.has_next || false);
        setHasPrevious(data.has_previous || false);
      } catch (error: any) {
        console.error('Error fetching timeless boards archive:', error);
        if (error.response?.status === 403) {
          toast.error('Premium subscription required to access archives');
          navigate('/dashboard');
        } else {
          toast.error('Failed to load archive');
        }
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    fetchBoards();
  }, [page, currentLevel, isAuthenticated, user, navigate]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleBoardClick = (boardId: number) => {
    navigate(`/timeless-boards/archive/${boardId}/${currentLevel}`);
  };

  if (loading) {
    return (
      <div className="timeless-board-page">
        <div className="loading-state">Loading archive...</div>
      </div>
    );
  }

  const handleLevelChange = (level: number) => {
    setSearchParams({ level: level.toString(), page: '1' });
    setPage(1);
  };

  return (
    <div className="timeless-board-page">
      <div className="timeless-board-content">
        <h1 className="timeless-board-title">Timeless Board Archive</h1>
        
        {/* Level selector */}
        <div className="level-selector">
          <div className="level-selector-title">CHOOSE YOUR LEVEL</div>
          <div className="level-buttons">
            {LEVELS.map((level) => (
              <button
                key={level.value}
                className={`level-button level-${level.value} ${currentLevel === level.value ? 'active' : ''}`}
                onClick={() => handleLevelChange(level.value)}
                disabled={loading}
              >
                {level.name}
              </button>
            ))}
          </div>
        </div>

        <div className="archive-boards-list">
          {boards.map((board) => (
            <div
              key={board.id}
              className="archive-board-item"
              onClick={() => handleBoardClick(board.id)}
            >
              <div className="archive-board-header">
                <h2 className="archive-board-title">{board.title}</h2>
                <span className="archive-board-date">{formatDate(board.date)}</span>
              </div>
              <div className="archive-board-info">
                <div className="archive-board-stat">
                  <span className="stat-label">Total Points:</span>
                  <span className="stat-value">{board.total_points}</span>
                </div>
                <div className="archive-board-stat">
                  <span className="stat-label">Words:</span>
                  <span className="stat-value">{board.number_of_words}</span>
                </div>
                <div className="archive-board-stat">
                  <span className="stat-label">Status:</span>
                  <span className={`stat-value ${board.played ? 'played' : 'not-played'}`}>
                    {board.played ? 'Played' : 'Not Played'}
                  </span>
                </div>
                {board.type === 'bonus' && (
                  <span className="board-type-badge bonus">Bonus Letters</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="archive-pagination">
          <button
            className="pagination-btn pagination-prev"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={!hasPrevious || loading}
          >
            Previous
          </button>
          
          {/* Page jump shortcuts (every 5th page) */}
          <div className="pagination-jump-shortcuts">
            {Array.from({ length: Math.ceil(totalPages / 5) }, (_, i) => {
              const jumpPage = i * 5 + 1;
              if (jumpPage > totalPages) return null;
              return (
                <button
                  key={jumpPage}
                  className={`pagination-jump-btn ${page === jumpPage ? 'active' : ''}`}
                  onClick={() => setPage(jumpPage)}
                  disabled={loading}
                >
                  {jumpPage}
                </button>
              );
            })}
          </div>
          
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          
          <button
            className="pagination-btn pagination-next"
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext || loading}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

