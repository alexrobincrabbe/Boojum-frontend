import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { pointsAPI } from '../services/api';
import { POINTS_AWARDED_EVENT } from '../utils/pointsToasts';
import './PointsGuideModal.css';

type ProgressStar = 'empty' | 'yellow' | 'pink';

interface LiveRoomProgress {
  name: string;
  awards: number;
  cap: number;
  points: number;
  star: ProgressStar;
}

interface TodayProgress {
  date: string;
  live: {
    points: number;
    rooms: LiveRoomProgress[];
  };
  daily: {
    completed: boolean;
    points: number;
    star: ProgressStar;
  };
  timeless: {
    points: number;
    level: number | null;
    level_name: string | null;
    multiplier: number | null;
    star: ProgressStar;
  };
  minigames?: {
    doodle_draw: { count: number; points: number; star: ProgressStar };
    doodle_solve: { count: number; points: number; star: ProgressStar };
    boojumble: { count: number; cap: number; points: number; star: ProgressStar };
    cluejum: { count: number; cap: number; points: number; star: ProgressStar };
  };
  tournament: {
    match: string;
    placement: { semi: number; final: number; champion: number };
    note: string;
  };
}

interface PointsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ProgressStarIcon({ star }: { star: ProgressStar }) {
  if (star === 'pink') {
    return <Star className="points-guide-star is-pink" size={18} fill="#eb5497" stroke="#eb5497" aria-hidden />;
  }
  if (star === 'yellow') {
    return <Star className="points-guide-star is-yellow" size={18} fill="#f5ce45" stroke="#f5ce45" aria-hidden />;
  }
  return <Star className="points-guide-star is-empty" size={18} fill="none" stroke="#8a8aa8" aria-hidden />;
}

function formatMultiplier(value: number | null): string | null {
  if (value == null) {
    return null;
  }
  const rendered = Number.isInteger(value) ? String(value) : String(value);
  return `×${rendered}`;
}

export function PointsGuideModal({ isOpen, onClose }: PointsGuideModalProps) {
  const [progress, setProgress] = useState<TodayProgress | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await pointsAPI.getToday();
        if (!cancelled) {
          setProgress(data);
        }
      } catch {
        if (!cancelled) {
          setProgress(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    const handleAwarded = () => {
      load();
    };
    window.addEventListener(POINTS_AWARDED_EVENT, handleAwarded);
    return () => {
      cancelled = true;
      window.removeEventListener(POINTS_AWARDED_EVENT, handleAwarded);
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const live = progress?.live;
  const daily = progress?.daily;
  const timeless = progress?.timeless;
  const minigames = progress?.minigames;
  const tournament = progress?.tournament;
  const multiplierLabel = formatMultiplier(timeless?.multiplier ?? null);

  return (
    <div className="points-guide-overlay" onClick={onClose}>
      <div
        className="points-guide-content"
        role="dialog"
        aria-labelledby="points-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="points-guide-header">
          <h3 id="points-guide-title" className="points-guide-title">Points</h3>
          <button className="points-guide-close" onClick={onClose} aria-label="Close points guide">
            <X size={20} />
          </button>
        </div>

        <div className="points-guide-body">
          <p className="points-guide-intro">
            Earn points by playing. Totals and daily limits use UTC days.
          </p>

          <section className="points-guide-section">
            <h4>Today</h4>
            <p className="points-guide-legend">
              <span><Star size={14} fill="none" stroke="#8a8aa8" aria-hidden /> not started</span>
              <span><Star size={14} fill="#f5ce45" stroke="#f5ce45" aria-hidden /> in progress</span>
              <span><Star size={14} fill="#eb5497" stroke="#eb5497" aria-hidden /> complete</span>
            </p>
            {loading && !progress ? (
              <p className="points-guide-muted">Loading today's progress...</p>
            ) : (
              <ul className="points-guide-rows">
                <li className="points-guide-group">
                  <div className="points-guide-row">
                    <span className="points-guide-row-label">Live rooms</span>
                    <span className="points-guide-row-meta">
                      {live ? `${live.points} pts today` : '0 pts today'}
                    </span>
                  </div>
                  <ul className="points-guide-subrows">
                    {(live?.rooms || [
                      { name: 'Looking Glass', awards: 0, cap: 10, points: 0, star: 'empty' as const },
                      { name: 'Forevermore', awards: 0, cap: 10, points: 0, star: 'empty' as const },
                      { name: 'Boojum', awards: 0, cap: 10, points: 0, star: 'empty' as const },
                    ]).map((room) => (
                      <li key={room.name} className="points-guide-row is-nested">
                        <ProgressStarIcon star={room.star} />
                        <span className="points-guide-row-label">{room.name}</span>
                        <span className="points-guide-row-meta">
                          {room.awards}/{room.cap}
                          {room.points > 0 ? ` · ${room.points} pts` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>

                <li className="points-guide-row">
                  <ProgressStarIcon star={daily?.star || 'empty'} />
                  <span className="points-guide-row-label">Daily board</span>
                  <span className="points-guide-row-meta">
                    {daily?.completed ? 'Completed' : 'Not completed'}
                    {' · '}
                    {daily?.points ?? 0} pts
                  </span>
                </li>

                <li className="points-guide-row">
                  <ProgressStarIcon star={timeless?.star || 'empty'} />
                  <span className="points-guide-row-label">Timeless</span>
                  <span className="points-guide-row-meta">
                    {timeless && timeless.points > 0
                      ? [
                          `${timeless.points} pts`,
                          timeless.level_name,
                          multiplierLabel,
                        ].filter(Boolean).join(' · ')
                      : 'No award yet'}
                  </span>
                </li>

                {minigames && (
                  <>
                    <li className="points-guide-row">
                      <ProgressStarIcon star={minigames.doodle_draw.star} />
                      <span className="points-guide-row-label">Doodle draw</span>
                      <span className="points-guide-row-meta">
                        {minigames.doodle_draw.count} · {minigames.doodle_draw.points} pts
                      </span>
                    </li>
                    <li className="points-guide-row">
                      <ProgressStarIcon star={minigames.doodle_solve.star} />
                      <span className="points-guide-row-label">Doodle solves</span>
                      <span className="points-guide-row-meta">
                        {minigames.doodle_solve.count} · {minigames.doodle_solve.points} pts
                      </span>
                    </li>
                    <li className="points-guide-row">
                      <ProgressStarIcon star={minigames.boojumble.star} />
                      <span className="points-guide-row-label">Boojumble</span>
                      <span className="points-guide-row-meta">
                        {minigames.boojumble.count}/{minigames.boojumble.cap} · {minigames.boojumble.points} pts
                      </span>
                    </li>
                    <li className="points-guide-row">
                      <ProgressStarIcon star={minigames.cluejum.star} />
                      <span className="points-guide-row-label">Cluejum</span>
                      <span className="points-guide-row-meta">
                        {minigames.cluejum.count}/{minigames.cluejum.cap} · {minigames.cluejum.points} pts
                      </span>
                    </li>
                  </>
                )}
              </ul>
            )}
          </section>

          <section className="points-guide-section">
            <h4>How points work</h4>
            <ul className="points-guide-rules">
              <li>
                <strong>Live rooms.</strong> Looking Glass, Forevermore, and Boojum award points based on your score,
                up to 10 times per room each UTC day.
              </li>
              <li>
                <strong>Daily board.</strong> Points are awarded based on your score, once per board.
              </li>
              <li>
                <strong>Timeless.</strong> 50 / 100 / 200 points at 50% / 75% / 100%, multiplied by the level
                (Curious ×1, Curiouser ×1.5, Rabbit Hole ×2). The highest award of the UTC day is kept.
              </li>
              <li>
                <strong>Doodledum.</strong> 100 points for each doodle you draw, and 30 for each doodle you solve.
              </li>
              <li>
                <strong>Boojumble.</strong> 10 / 50 / 100 for 3×3 / 4×4 / 5×5, once per puzzle.
              </li>
              <li>
                <strong>Cluejum.</strong> 50 points if you solve a section first try, otherwise 10, once per section.
              </li>
            </ul>
          </section>

          <section className="points-guide-section">
            <h4>Tournaments</h4>
            <p className="points-guide-muted">
              {tournament?.match || 'Solo tournament matches award points based on your score.'}
              {' '}
              Placement rewards upgrade to the highest rank reached: {tournament?.placement.semi ?? 250} for a
              semi-final, {tournament?.placement.final ?? 500} for a final, and {tournament?.placement.champion ?? 1000} for champion.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
