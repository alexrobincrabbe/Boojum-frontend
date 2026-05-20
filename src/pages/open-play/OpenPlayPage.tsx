import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { lobbyAPI, dashboardAPI } from '../../services/api';
import { Username } from '../../components/Username';
import { ProfilePicture } from '../../components/ProfilePicture';
import { Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import './OpenPlayPage.css';
import '../daily-boards/DailyBoardPage.css';

interface OpenPlayLeader {
  player_id: number;
  player_display_name: string;
  player_profile_url: string;
  player_profile_picture: string;
  player_chat_color: string;
  score: number;
  best_word: string | null;
  best_word_score: number | string | null;
  number_of_words: number;
  is_current_user: boolean;
}

interface OpenPlayBoardItem {
  id: number;
  created_at: string;
  created_by_display_name: string;
  type: 'normal' | 'bonus';
  time_limit: number;
  number_of_words: number;
  total_points: number;
  played: boolean;
  leaders: OpenPlayLeader[];
  player_count: number;
}

interface UserSearchResult {
  id: number;
  display_name: string;
}

export default function OpenPlayPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

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

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

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
            <p>
              Play and compete in your own time.
              <br />
              These are not live games - anyone can join in and play whenever they like.
            </p>
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
            <article key={board.id} className="open-play-board-card">
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
                {board.leaders.length > 0 ? (
                  <div className="scores-table-container">
                    <table className="scores-table">
                      <thead>
                        <tr>
                          <th className="rank-col" />
                          <th className="player-col" />
                          <th className="score-col">Score</th>
                          <th className="word-col">Best Word</th>
                          <th className="words-col">Words</th>
                          <th className="word-toggle-col">
                            <button
                              type="button"
                              className={`toggle-header-btn ${showBestWord ? 'best-word-mode' : 'words-mode'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowBestWord(!showBestWord);
                              }}
                            >
                              {showBestWord ? 'Best Word' : 'Words'}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {board.leaders.map((leader, index) => (
                          <tr
                            key={leader.player_id || index}
                            className={leader.is_current_user ? 'current-user-score' : ''}
                          >
                            <td className="rank-col">{index + 1}</td>
                            <td className="player-col">
                              <div className="player-info">
                                <ProfilePicture
                                  profilePictureUrl={leader.player_profile_picture}
                                  profileUrl={leader.player_profile_url}
                                  chatColor={leader.player_chat_color}
                                  size={40}
                                  showBorder
                                />
                                <Username
                                  username={leader.player_display_name}
                                  profileUrl={leader.player_profile_url}
                                  chatColor={leader.player_chat_color}
                                />
                              </div>
                            </td>
                            <td className="score-col">
                              {leader.score} <span className="score-pts">pts</span>
                            </td>
                            <td className="word-col">
                              <div className="best-word-container">
                                {leader.best_word ? (
                                  <span className="best-word-text">{leader.best_word}</span>
                                ) : (
                                  <span className="hidden-word">*****</span>
                                )}
                                {leader.best_word_score != null && leader.best_word_score !== '' && (
                                  <span className="best-word-score">
                                    {leader.best_word_score}
                                    <span className="best-word-score-pts">pts</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="words-col">{leader.number_of_words}</td>
                            <td className="word-toggle-col">
                              {showBestWord ? (
                                <div className="best-word-container">
                                  {leader.best_word ? (
                                    <span className="best-word-text">{leader.best_word}</span>
                                  ) : (
                                    <span className="hidden-word">*****</span>
                                  )}
                                  {leader.best_word_score != null && leader.best_word_score !== '' && (
                                    <span className="best-word-score">
                                      {leader.best_word_score}
                                      <span className="best-word-score-pts">pts</span>
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="words-count">{leader.number_of_words}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="no-scores">No scores yet</div>
                )}
              </div>

              <div className="open-play-card-actions">
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
