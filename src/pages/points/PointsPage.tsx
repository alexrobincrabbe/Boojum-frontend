import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { pointsAPI } from '../../services/api';
import { ProfilePicture } from '../../components/ProfilePicture';
import { Username } from '../../components/Username';
import { Loading } from '../../components/Loading';
import { PointsGuideModal } from '../../components/PointsGuideModal';
import '../leaderboards/LeaderboardsPage.css';
import './PointsPage.css';

interface PointsEntry {
  rank: number;
  user_id: number;
  username: string;
  display_name: string;
  profile_url: string;
  profile_picture_url: string | null;
  chat_color: string;
  points: number;
  points_all_time?: number;
  points_tier?: string;
}

const PAGE_SIZE = 50;

export default function PointsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') === 'all-time' ? 'all-time' : 'weekly';

  const [entries, setEntries] = useState<PointsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const fetchPage = useCallback(
    async (pointsPeriod: 'weekly' | 'all-time', offset: number, append: boolean) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await pointsAPI.getLeaderboard(pointsPeriod, PAGE_SIZE, offset);
        const users: PointsEntry[] = response.users || [];
        setEntries((prev) => (append ? [...prev, ...users] : users));
        setHasMore(!!response.has_more);
        setNextOffset(response.next_offset ?? null);
      } catch (err: unknown) {
        const message =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
            : null;
        setError(message || 'Failed to load points');
        console.error('Failed to load points:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        fetchingRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    fetchPage(period, 0, false);
  }, [period, fetchPage]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore || nextOffset == null) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (observed) => {
        if (observed[0]?.isIntersecting && hasMore && nextOffset != null && !fetchingRef.current) {
          fetchPage(period, nextOffset, true);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, nextOffset, loading, loadingMore, period, fetchPage]);

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value === 'all-time' ? 'all-time' : 'weekly';
    setSearchParams({ period: newPeriod });
  };

  const getRankClass = (rank: number): string => {
    if (rank === 1) return 'bw-rank label rank-1';
    if (rank === 2) return 'bw-rank label rank-2';
    if (rank === 3) return 'bw-rank label rank-3';
    return 'bw-rank label';
  };

  return (
    <div className="container-fluid leaderboards-page points-page">
      <div className="leaderboard-selectors">
        <div className="selector-group">
          <select
            id="pointsPeriod"
            className="yellow-border"
            value={period}
            onChange={handlePeriodChange}
            style={{ color: 'var(--color-yellow)' }}
          >
            <option value="weekly">This Week</option>
            <option value="all-time">All-Time</option>
          </select>
        </div>
        <button
          type="button"
          className="points-page-guide-button"
          onClick={() => setGuideOpen(true)}
          aria-label="How points work"
        >
          <HelpCircle size={18} />
          How points work
        </button>
      </div>

      <div id="leaderboard-wrapper" style={{ position: 'relative' }}>
        {loading && entries.length === 0 && <Loading minHeight="calc(100vh - 70px)" />}
        {error && (
          <div className="error-message" style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
            {error}
          </div>
        )}
        {!error && (
          <div id="leaderboard-content">
            <div className="row">
              <div className="col-lg-8 offset-lg-2">
                <div className="table-container">
                  <h5 className="blue">{period === 'all-time' ? 'All-Time Points' : 'This Week'}</h5>
                  <div className="leaderboard_table_container yellow-border">
                    <table className="leaderboard_table">
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.user_id}>
                            <td>
                              <div className={getRankClass(entry.rank)} style={{ fontWeight: 'bold' }}>
                                {entry.rank}
                              </div>
                            </td>
                            <td>
                              <ProfilePicture
                                profilePictureUrl={entry.profile_picture_url}
                                profileUrl={entry.profile_url}
                                chatColor={entry.chat_color}
                                size={30}
                                pointsTier={entry.points_tier}
                              />
                            </td>
                            <td className="player-name">
                              <Username
                                username={entry.display_name}
                                profileUrl={entry.profile_url}
                                chatColor={entry.chat_color}
                              />
                            </td>
                            <td className="number">{entry.points.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!loading && entries.length === 0 && (
                      <p className="points-page-empty">No players with points yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {hasMore && <div ref={loadMoreRef} className="points-page-load-more" aria-hidden="true" />}
            {loadingMore && (
              <p className="points-page-loading-more">Loading more…</p>
            )}
          </div>
        )}
      </div>
      <PointsGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
