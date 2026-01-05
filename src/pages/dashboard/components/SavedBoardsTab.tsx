import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { lobbyAPI, dashboardAPI } from '../../../services/api';
import { Loading } from '../../../components/Loading';
import { ScoresModal } from '../../game-room/components/ScoresModal';
import { useAuth } from '../../../contexts/AuthContext';
import SavedBoardCommentModal from '../../saved-boards/SavedBoardCommentModal';

interface SavedBoard {
  id: number;
  board_letters: string[][];
  board_words: string[];
  bonus_letters: number[][];
  room_type: string;
  score: number;
  timer: number;
  one_shot: boolean;
  saved_at: string;
  shared_by?: string; // Only present for received boards
  shared_by_color?: string; // Only present for received boards
  shared_at?: string; // Only present for received boards
  board_owner_id?: number; // Only present for received boards
  comment_count?: number;
}

const SavedBoardsTab = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [ownBoards, setOwnBoards] = useState<SavedBoard[]>([]);
  const [receivedBoards, setReceivedBoards] = useState<SavedBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [remainingSaves, setRemainingSaves] = useState(10);
  const [sharingBoardId, setSharingBoardId] = useState<number | null>(null);
  const [shareUsername, setShareUsername] = useState('');
  const [shareSuggestions, setShareSuggestions] = useState<{ id: number; display_name: string }[]>([]);
  const [viewingScoresBoardId, setViewingScoresBoardId] = useState<number | null>(null);
  const [viewingCommentsBoardId, setViewingCommentsBoardId] = useState<number | null>(null);
  const [roomColorMap, setRoomColorMap] = useState<Record<string, string>>({});
  const [buddies, setBuddies] = useState<{ id: number; display_name: string }[]>([]);
  const [shareMode, setShareMode] = useState<'menu' | 'user' | null>(null);

  useEffect(() => {
    loadBoards();
    loadRoomColors();
    loadBuddies();
  }, []);

  const loadBuddies = async () => {
    try {
      const data = await dashboardAPI.getDashboardData();
      setBuddies(data.buddies?.map((b: any) => ({ id: b.id, display_name: b.display_name })) || []);
    } catch (error) {
      console.error('Error loading buddies:', error);
    }
  };

  const loadRoomColors = async () => {
    try {
      const data = await lobbyAPI.getLobbyData();
      const colorMap: Record<string, string> = {};
      if (data.rooms) {
        data.rooms.forEach((room: any) => {
          colorMap[room.room_name] = room.color || '#71bbe9'; // Default to blue if no color
        });
      }
      setRoomColorMap(colorMap);
    } catch (error) {
      console.error('Error loading room colors:', error);
    }
  };

  const loadBoards = async () => {
    try {
      setLoading(true);
      const data = await lobbyAPI.getSavedBoards();
      setOwnBoards(data.own_boards || []);
      setReceivedBoards(data.received_boards || []);
      setRemainingSaves(data.remaining_saves || 10);
    } catch (error: any) {
      console.error('Error loading saved boards:', error);
      toast.error('Error loading saved boards');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (boardId: number) => {
    if (!window.confirm('Are you sure you want to delete this board? All scores will be deleted.')) {
      return;
    }

    try {
      await lobbyAPI.deleteSavedBoard(boardId);
      toast.success('Board deleted successfully');
      loadBoards(); // Reload boards
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to delete board';
      toast.error(errorMessage);
    }
  };

  const handlePlay = (boardId: number) => {
    navigate(`/saved-boards/play/${boardId}`);
  };

  const handleShareClick = (boardId: number) => {
    setSharingBoardId(boardId);
    setShareMode('menu');
    setShareUsername('');
    setShareSuggestions([]);
  };

  const handleShareToAllPlaymates = async (boardId: number) => {
    try {
      // Share to all buddies
      const sharePromises = buddies.map(buddy => 
        lobbyAPI.shareSavedBoard(boardId, buddy.display_name).catch(err => {
          console.error(`Error sharing to ${buddy.display_name}:`, err);
          return null;
        })
      );
      await Promise.all(sharePromises);
      toast.success(`Board shared with all ${buddies.length} playmates!`);
      setSharingBoardId(null);
      setShareMode(null);
    } catch (error: any) {
      toast.error('Error sharing board with playmates');
    }
  };

  const handleCopyLink = async (boardId: number) => {
    try {
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/saved-boards/play/${boardId}`;
      await navigator.clipboard.writeText(link);
      toast.success('Link copied to clipboard!');
      setSharingBoardId(null);
      setShareMode(null);
    } catch (error) {
      toast.error('Failed to copy link to clipboard');
    }
  };

  const handleShareSearch = async (query: string) => {
    setShareUsername(query);
    if (query.length < 2) {
      setShareSuggestions([]);
      return;
    }
    try {
      // Include buddies for board sharing (unlike playmates tab)
      const response = await dashboardAPI.searchUsers(query, true);
      setShareSuggestions(response.results || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const handleShareSubmit = async (e: React.FormEvent, boardId: number) => {
    e.preventDefault();
    if (!shareUsername.trim()) return;

    try {
      await lobbyAPI.shareSavedBoard(boardId, shareUsername);
      toast.success(`Board shared with ${shareUsername}!`);
      setSharingBoardId(null);
      setShareMode(null);
      setShareUsername('');
      setShareSuggestions([]);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to share board';
      toast.error(errorMessage);
    }
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <Loading minHeight="400px" />;
  }

  // Calculate max saves: if we have ownBoards.length saved and remainingSaves remaining, total is ownBoards.length + remainingSaves
  // This works for both premium (100 max) and regular users (10 max)
  const maxSaves = ownBoards.length + remainingSaves;
  const usedSaves = ownBoards.length;
  const progressPercentage = maxSaves > 0 ? (usedSaves / maxSaves) * 100 : 0;

  // Render a board card - used for both own boards and received boards
  const renderBoardCard = (board: SavedBoard, isReceived: boolean = false) => {
    const isSharing = sharingBoardId === board.id;
    const isShareMenuOpen = isSharing && shareMode === 'menu';
    const isShareUserSearchOpen = isSharing && shareMode === 'user';

    return (
      <div key={board.id} className="saved-board-card">
        <div className="saved-board-header">
          <div className="board-info">
            <h3 
              className="board-room-name" 
              style={{ color: roomColorMap[board.room_type] || '#71bbe9' }}
            >
              {board.room_type}
            </h3>
            {isReceived && board.shared_by && (
              <div className="board-shared-by" style={{ color: board.shared_by_color || '#71bbe9', fontSize: '0.9rem', marginBottom: '8px' }}>
                Shared by {board.shared_by}
              </div>
            )}
            <div className="board-meta">
              <span className="board-score">Score: {board.score}</span>
              <span className="board-timer">Timer: {board.timer || 90}s</span>
              {board.one_shot && <span className="board-oneshot">One-Shot</span>}
            </div>
            <div className="board-date">{formatDate(board.saved_at)}</div>
          </div>
          {!isReceived && (
            <div className="board-actions">
              <button
                className="share-board-btn"
                onClick={() => handleShareClick(board.id)}
              >
                Share
              </button>
              <button
                className="delete-board-btn"
                onClick={() => handleDelete(board.id)}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Board Preview */}
        <div className="board-preview-container" style={{ position: 'relative' }}>
          {(board.comment_count && board.comment_count > 0) && (
            <div 
              className="comment-badge" 
              onClick={(e) => {
                e.stopPropagation();
                setViewingCommentsBoardId(board.id);
              }}
              style={{ 
                position: 'absolute', 
                top: '8px', 
                right: '8px', 
                zIndex: 10,
                cursor: 'pointer'
              }}
            >
              💬 {board.comment_count}
            </div>
          )}
          <div className="board-wrapper">
            <div id={`saved-board-${board.id}`} className="board board-dark">
              {Array.from({ length: 16 }, (_, i) => {
                const row = Math.floor(i / 4);
                const col = i % 4;
                const letter = board.board_letters?.[row]?.[col] || '';
                const bonusValue = board.bonus_letters?.[row]?.[col] || 0;
                const isSnark = bonusValue === 1;
                const isBoojum = bonusValue === 2;

                return (
                  <div
                    key={i}
                    className={`letter dark-mode ${isSnark ? 'snark' : ''} ${isBoojum ? 'boojum' : ''}`}
                    data-x={row}
                    data-y={col}
                    data-index={i}
                    data-letter={letter}
                  >
                    <div className="letValue">{letter}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="board-preview-actions">
            <button
              className="play-board-btn"
              onClick={() => handlePlay(board.id)}
            >
              Play
            </button>
            <button
              className="view-scores-btn"
              onClick={() => setViewingScoresBoardId(board.id)}
            >
              Scores
            </button>
            <button
              className="view-comments-btn"
              onClick={() => setViewingCommentsBoardId(board.id)}
            >
              Comments {board.comment_count && board.comment_count > 0 && `(${board.comment_count})`}
            </button>
          </div>
        </div>

        {/* Share Menu - only show for own boards */}
        {!isReceived && isShareMenuOpen && (
          <div className="share-menu">
            <div className="share-menu-options">
              <button
                className="share-menu-option"
                onClick={() => setShareMode('user')}
              >
                Share to User
              </button>
              <button
                className="share-menu-option"
                onClick={() => handleShareToAllPlaymates(board.id)}
                disabled={buddies.length === 0}
              >
                Share to All Playmates {buddies.length > 0 && `(${buddies.length})`}
              </button>
              <button
                className="share-menu-option"
                onClick={() => handleCopyLink(board.id)}
              >
                Copy Link
              </button>
              <button
                className="share-menu-cancel"
                onClick={() => {
                  setSharingBoardId(null);
                  setShareMode(null);
                  setShareUsername('');
                  setShareSuggestions([]);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Share to User Form - only show for own boards */}
        {!isReceived && isShareUserSearchOpen && (
          <div className="share-board-form">
            <form onSubmit={(e) => handleShareSubmit(e, board.id)}>
              <input
                type="text"
                placeholder="Search username..."
                value={shareUsername}
                onChange={(e) => handleShareSearch(e.target.value)}
                className="share-username-input"
              />
              {shareSuggestions.length > 0 && (
                <div className="share-suggestions">
                  {shareSuggestions.map((user) => (
                    <div
                      key={user.id}
                      className="share-suggestion-item"
                      onClick={() => {
                        setShareUsername(user.display_name);
                        setShareSuggestions([]);
                      }}
                    >
                      {user.display_name}
                    </div>
                  ))}
                </div>
              )}
              <div className="share-form-actions">
                <button type="submit" className="share-submit-btn" disabled={!shareUsername.trim()}>
                  Share
                </button>
                <button
                  type="button"
                  className="share-cancel-btn"
                  onClick={() => {
                    setSharingBoardId(null);
                    setShareMode(null);
                    setShareUsername('');
                    setShareSuggestions([]);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="saved-boards-tab">
      <div className="saved-boards-header">
        <div className="saves-progress-container">
          <div className="saves-progress-bar">
            <div 
              className="saves-progress-used" 
              style={{ width: `${progressPercentage}%` }}
            ></div>
            <div 
              className="saves-progress-remaining" 
              style={{ width: `${100 - progressPercentage}%` }}
            ></div>
          </div>
          <div className="saves-progress-text">
            {usedSaves} used / {remainingSaves} remaining
          </div>
        </div>
      </div>

      {/* My Saved Boards Section */}
      <div className="saved-boards-section">
        <h2 className="saved-boards-section-title">My Saved Boards</h2>
        {ownBoards.length === 0 ? (
          <div className="no-saved-boards">
            <p>You haven't saved any boards yet.</p>
            <p>Save boards from live game rooms after a round ends!</p>
          </div>
        ) : (
          <div className="saved-boards-grid">
            {ownBoards.map((board) => renderBoardCard(board, false))}
          </div>
        )}
      </div>

      {/* Received Boards Section */}
      <div className="saved-boards-section">
        <h2 className="saved-boards-section-title">Received Boards</h2>
        {receivedBoards.length === 0 ? (
          <div className="no-saved-boards">
            <p>You haven't received any shared boards yet.</p>
            <p>Boards shared with you by other players will appear here.</p>
          </div>
        ) : (
          <div className="saved-boards-grid">
            {receivedBoards.map((board) => renderBoardCard(board, true))}
          </div>
        )}
      </div>

      {/* Scores Modal */}
      {viewingScoresBoardId && (
        <ScoresModal
          isOpen={true}
          onClose={() => setViewingScoresBoardId(null)}
          finalScores={null}
          savedBoardId={viewingScoresBoardId}
          isOneShot={[...ownBoards, ...receivedBoards].find(b => b.id === viewingScoresBoardId)?.one_shot || false}
        />
      )}

      {/* Comments Modal */}
      {viewingCommentsBoardId && (() => {
        const board = [...ownBoards, ...receivedBoards].find(b => b.id === viewingCommentsBoardId);
        if (!board) return null;
        // Determine board owner: for own boards, it's current user; for received boards, use board_owner_id
        const isReceivedBoard = receivedBoards.some(b => b.id === board.id);
        const boardOwnerId = isReceivedBoard && board.board_owner_id
          ? board.board_owner_id
          : (currentUser?.id || 0);
        return (
          <SavedBoardCommentModal
            board={{ id: board.id, room_type: board.room_type }}
            boardOwnerId={boardOwnerId}
            onClose={() => {
              setViewingCommentsBoardId(null);
              loadBoards(); // Refresh to get updated comment count
            }}
          />
        );
      })()}
    </div>
  );
};

export default SavedBoardsTab;

