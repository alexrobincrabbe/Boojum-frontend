import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { lobbyAPI, dashboardAPI } from '../../services/api';
import { Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import { OpenPlayScoresTable, type OpenPlayScoreRow } from './OpenPlayScoresTable';
import './OpenPlayPage.css';
import '../daily-boards/DailyBoardPage.css';

interface OpenPlayBoardItem {
  id: number;
  created_at: string;
  created_by_display_name: string;
  type: 'normal' | 'bonus';
  time_limit: number;
  number_of_words: number;
  total_points: number;
  played: boolean;
  leaders: OpenPlayScoreRow[];
  player_count: number;
}

interface UserSearchResult {
  id: number;
  display_name: string;
}

export default function OpenPlayPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [boards, setBoards] = useState<OpenPlayBoardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [timeLimitFilter, setTimeLimitFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [playedFilter, setPlayedFilter] = useState<string>('');
  const [minWords, setMinWords] = useState<string>('');
  const [minPoints, setMinPoints] = useState<string>('');
  const [filterUserId, setFilterUserId] = useState<number | null>(null);
  const [filterUserLabel, setFilterUserLabel] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);

  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [newTimeLimit, setNewTimeLimit] = useState<90 | 180>(90);
  const [newBonus, setNewBonus] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showBestWord, setShowBestWord] = useState(true);
  const [scoreboardBoard, setScoreboardBoard] = useState<OpenPlayBoardItem | null>(null);
  const [fullScores, setFullScores] = useState<OpenPlayScoreRow[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [highlightBoardId, setHighlightBoardId] = useState<number | null>(null);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);
  const scrollTargetBoardId = searchParams.get('board');
  const scrolledToBoardRef = useRef<string | null>(null);

  const buildParams = useCallback(
    (cursor?: number | null) => {
      const params: Record<string, string | number | undefined> = { limit: 20 };
      if (cursor) params.cursor = cursor;
      if (timeLimitFilter) params.time_limit = timeLimitFilter;
      if (typeFilter) params.type = typeFilter;
      if (playedFilter) params.played = playedFilter;
      if (minWords) params.min_words = minWords;
      if (minPoints) params.min_total_points = minPoints;
      if (filterUserId) params.user_id = filterUserId;
      return params;
    },
    [timeLimitFilter, typeFilter, playedFilter, minWords, minPoints, filterUserId]
  );

  const fetchBoards = useCallback(
    async (cursor: number | null, append: boolean) => {
      if (!isAuthenticated || fetchingRef.current) return;
      fetchingRef.current = true;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const data = await lobbyAPI.getOpenPlayBoards(buildParams(cursor ?? undefined));
        const newBoards: OpenPlayBoardItem[] = data.boards || [];
        setBoards((prev) => (append ? [...prev, ...newBoards] : newBoards));
        setNextCursor(data.next_cursor ?? null);
        setHasMore(!!data.has_more);
      } catch (error) {
        console.error('Error fetching open play boards:', error);
        toast.error('Failed to load boards');
      } finally {
        setLoading(false);
        setLoadingMore(false);
        fetchingRef.current = false;
      }
    },
    [isAuthenticated, buildParams]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchBoards(null, false);
  }, [isAuthenticated, fetchBoards]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && nextCursor && !fetchingRef.current) {
          fetchBoards(nextCursor, true);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, loading, loadingMore, fetchBoards]);

  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await dashboardAPI.searchUsers(userSearchQuery.trim(), true);
        setUserSearchResults(data.results || []);
      } catch {
        setUserSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [userSearchQuery]);

  useEffect(() => {
    if (!scrollTargetBoardId || loading) return;

    const boardId = parseInt(scrollTargetBoardId, 10);
    if (Number.isNaN(boardId)) {
      setSearchParams({}, { replace: true });
      return;
    }

    if (scrolledToBoardRef.current === scrollTargetBoardId) return;

    const boardElement = document.getElementById(`open-play-board-${boardId}`);
    if (boardElement) {
      scrolledToBoardRef.current = scrollTargetBoardId;
      boardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightBoardId(boardId);
      const highlightTimeout = setTimeout(() => {
        setHighlightBoardId(null);
        setSearchParams({}, { replace: true });
      }, 2500);
      return () => clearTimeout(highlightTimeout);
    }

    const boardInList = boards.some((board) => board.id === boardId);
    if (!boardInList && hasMore && nextCursor && !loadingMore && !fetchingRef.current) {
      fetchBoards(nextCursor, true);
      return;
    }

    if (!boardInList && !hasMore && !loading && !loadingMore) {
      setSearchParams({}, { replace: true });
    }
  }, [
    scrollTargetBoardId,
    boards,
    loading,
    hasMore,
    nextCursor,
    loadingMore,
    fetchBoards,
    setSearchParams,
  ]);

  useEffect(() => {
    scrolledToBoardRef.current = null;
  }, [scrollTargetBoardId]);

  const handleCreateGame = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setCreating(true);
    try {
      const data = await lobbyAPI.createOpenPlayBoard(newTimeLimit, newBonus);
      setShowNewGameModal(false);
      navigate(`/open-play/play/${data.id}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to create board');
    } finally {
      setCreating(false);
    }
  };

  const openFullScoreboard = async (board: OpenPlayBoardItem) => {
    setScoreboardBoard(board);
    setFullScores([]);
    setScoresLoading(true);
    try {
      const data = await lobbyAPI.getOpenPlayBoardScores(board.id);
      setFullScores(data.scores || []);
    } catch {
      toast.error('Could not load scoreboard');
      setScoreboardBoard(null);
    } finally {
      setScoresLoading(false);
    }
  };

  const closeFullScoreboard = () => {
    setScoreboardBoard(null);
    setFullScores([]);
  };

  const handleToggleBestWord = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowBestWord((prev) => !prev);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="open-play-page">
        <div className="open-play-container">
          <div className="open-play-header">
            <h1 className="open-play-title">Open Play</h1>
            <p className="open-play-login-prompt">
              Please <Link to="/login">log in</Link> to play and create Open Play boards.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="open-play-page">
      <div className="open-play-container">
        <div className="open-play-header">
          <h1 className="open-play-title">Open Play</h1>

          <div className="open-play-intro">
            <p>Press &ldquo;New Game&rdquo; to create boards.</p>
            <p>Play and compete in your own time.</p>
            <p>These are not live games - anyone can join in and play whenever they like.</p>
            <p>
              Boards created by other players will also appear on this page for everyone to play.
            </p>
          </div>

          <div className="open-play-filters">
          <div className="open-play-filters-stack">
            <select
              value={timeLimitFilter}
              onChange={(e) => setTimeLimitFilter(e.target.value)}
              aria-label="Time limit filter"
            >
              <option value="">All timers</option>
              <option value="90">90 seconds</option>
              <option value="180">180 seconds</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Bonus filter"
            >
              <option value="">All rules</option>
              <option value="normal">No bonus letters</option>
              <option value="bonus">Bonus letters</option>
            </select>
            <select
              value={playedFilter}
              onChange={(e) => setPlayedFilter(e.target.value)}
              aria-label="Played filter"
            >
              <option value="">All boards</option>
              <option value="false">Not played by me</option>
              <option value="true">Played by me</option>
            </select>
          </div>
          <div className="open-play-filters-secondary">
            <div className="open-play-filters-row">
              <input
                type="number"
                min={0}
                placeholder="Min words"
                value={minWords}
                onChange={(e) => setMinWords(e.target.value)}
                className="open-play-filter-input"
              />
              <input
                type="number"
                min={0}
                placeholder="Min points"
                value={minPoints}
                onChange={(e) => setMinPoints(e.target.value)}
                className="open-play-filter-input"
              />
            </div>
            <div className="open-play-user-filter">
              <input
                type="text"
                placeholder="Filter by player who played..."
                value={filterUserId ? filterUserLabel : userSearchQuery}
                onChange={(e) => {
                  setFilterUserId(null);
                  setFilterUserLabel('');
                  setUserSearchQuery(e.target.value);
                }}
                className="open-play-user-search"
              />
              {filterUserId && (
                <button
                  type="button"
                  className="open-play-clear-user"
                  onClick={() => {
                    setFilterUserId(null);
                    setFilterUserLabel('');
                    setUserSearchQuery('');
                    fetchBoards(null, false);
                  }}
                >
                  Clear player
                </button>
              )}
              {userSearchResults.length > 0 && !filterUserId && (
                <ul className="open-play-user-suggestions">
                  {userSearchResults.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setFilterUserId(u.id);
                          setFilterUserLabel(u.display_name);
                          setUserSearchQuery('');
                          setUserSearchResults([]);
                          setTimeout(() => fetchBoards(null, false), 0);
                        }}
                      >
                        {u.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          </div>
        </div>

        {loading && <div className="loading-state">Loading boards...</div>}

        {!loading && boards.length === 0 && (
          <div className="open-play-empty">No boards match your filters. Start a new game!</div>
        )}

        <div className="open-play-boards-list">
          <button
            type="button"
            className="open-play-new-game-list-btn"
            onClick={() => setShowNewGameModal(true)}
          >
            <Plus size={20} aria-hidden />
            <span>New Game</span>
          </button>
          {boards.map((board) => (
            <article
              key={board.id}
              id={`open-play-board-${board.id}`}
              className={`open-play-board-card${highlightBoardId === board.id ? ' open-play-board-card--highlighted' : ''}`}
            >
              <div className="open-play-card-header">
                <div>
                  <span className="open-play-card-id">Board #{board.id}</span>
                  <span className="open-play-card-meta">
                    by {board.created_by_display_name} · {formatDate(board.created_at)}
                  </span>
                </div>
                <div className="open-play-card-rules">
                  <span className="open-play-rule-badge">{board.time_limit}s</span>
                  {board.type === 'bonus' ? (
                    <span className="open-play-rule-badge bonus">Bonus</span>
                  ) : (
                    <span className="open-play-rule-badge">Standard</span>
                  )}
                  <span className="open-play-stat">{board.number_of_words} words</span>
                  <span className="open-play-stat">{board.total_points} pts avail.</span>
                </div>
              </div>

              <div className="daily-board-scores-section">
                <OpenPlayScoresTable
                  scores={board.leaders}
                  showBestWord={showBestWord}
                  onToggleBestWord={handleToggleBestWord}
                />
              </div>

              <div className="open-play-card-actions">
                {board.player_count > 0 && (
                  <button
                    type="button"
                    className="open-play-view-scores-btn"
                    onClick={() => openFullScoreboard(board)}
                  >
                    {board.player_count > 3
                      ? `Full scoreboard (${board.player_count})`
                      : 'Full scoreboard'}
                  </button>
                )}
                {board.played ? (
                  <span className="open-play-played-label">You played this board</span>
                ) : (
                  <button
                    type="button"
                    className="play-board-btn"
                    onClick={() => navigate(`/open-play/play/${board.id}`)}
                  >
                    Play
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        <div ref={loadMoreRef} className="open-play-load-more">
          {loadingMore && <span>Loading more...</span>}
          {!hasMore && boards.length > 0 && <span>End of list</span>}
        </div>

        {scoreboardBoard && (
          <div className="open-play-modal-overlay" onClick={closeFullScoreboard}>
            <div
              className="open-play-modal open-play-scores-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="open-play-scores-title"
            >
              <h2 id="open-play-scores-title">
                Board #{scoreboardBoard.id} — Full scoreboard
              </h2>
              <p className="open-play-scores-modal-meta">
                {scoreboardBoard.player_count}{' '}
                {scoreboardBoard.player_count === 1 ? 'player' : 'players'}
              </p>
              <div className="open-play-scores-modal-body">
                {scoresLoading ? (
                  <div className="loading-state">Loading scores...</div>
                ) : (
                  <OpenPlayScoresTable
                    scores={fullScores}
                    showBestWord={showBestWord}
                    onToggleBestWord={handleToggleBestWord}
                  />
                )}
              </div>
              <div className="open-play-modal-actions">
                <button type="button" onClick={closeFullScoreboard}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showNewGameModal && (
          <div className="open-play-modal-overlay" onClick={() => setShowNewGameModal(false)}>
            <div
              className="open-play-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-labelledby="new-game-title"
            >
              <h2 id="new-game-title">New Open Play Game</h2>
              <label className="open-play-modal-field">
                Time limit
                <select
                  value={newTimeLimit}
                  onChange={(e) => setNewTimeLimit(Number(e.target.value) as 90 | 180)}
                >
                  <option value={90}>90 seconds</option>
                  <option value={180}>180 seconds</option>
                </select>
              </label>
              <label className="open-play-modal-field open-play-checkbox">
                <input
                  type="checkbox"
                  checked={newBonus}
                  onChange={(e) => setNewBonus(e.target.checked)}
                />
                Bonus letters (Boojum / Snark)
              </label>
              <div className="open-play-modal-actions">
                <button type="button" onClick={() => setShowNewGameModal(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="open-play-new-game-btn"
                  disabled={creating}
                  onClick={handleCreateGame}
                >
                  {creating ? 'Creating...' : 'Play now'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
