import { useState } from 'react';
import { Trophy, X, Star } from 'lucide-react';
import './TournamentBadges.css';

interface TournamentWin {
  id: number;
  name: string;
  position: number;
  start_date: string | null;
  type: string;
  one_shot: boolean;
  pool: number;
}

interface TournamentBadgesProps {
  tournamentWins: TournamentWin[];
}

const TournamentBadges = ({ tournamentWins }: TournamentBadgesProps) => {
  const [selectedWin, setSelectedWin] = useState<TournamentWin | null>(null);

  if (!tournamentWins || tournamentWins.length === 0) {
    return null;
  }

  const getTierColor = (pool: number) => {
    switch (pool) {
      case 1:
        return '#71bbe9'; // SuperStars - Blue
      case 2:
        return '#f5ce45'; // RisingStars - Site Yellow
      case 3:
        return '#eb5497'; // ShootingStars - Pink
      default:
        return '#71bbe9';
    }
  };

  const getTierName = (pool: number) => {
    switch (pool) {
      case 1:
        return 'SuperStars';
      case 2:
        return 'RisingStars';
      case 3:
        return 'ShootingStars';
      default:
        return '';
    }
  };

  const cleanTitle = (title: string) => {
    return title.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Sort tournaments chronologically (newest first)
  const sortedWins = [...tournamentWins].sort((a, b) => {
    if (a.start_date && b.start_date) {
      return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
    }
    if (a.start_date) return -1;
    if (b.start_date) return 1;
    return 0;
  });

  return (
    <>
      <div className="tournament-badges-container">
        <h2 className="tournament-badges-title">
          <Trophy size={24} className="trophy-icon" />
          Tournament Wins
        </h2>
      <div className="tournament-medals-row">
        {sortedWins.map((win) => {
          const tierColor = getTierColor(win.pool);
          return (
            <div
              key={win.id}
              className={`tournament-medal ${win.position === 1 ? 'gold' : win.position === 2 ? 'silver' : 'bronze'}`}
              onClick={() => setSelectedWin(win)}
              title={cleanTitle(win.name)}
              style={{ boxShadow: `0 0 15px ${tierColor}40, 0 0 30px ${tierColor}20` }}
            >
              <Star 
                size={56} 
                className="medal-tier-star" 
                style={{ fill: tierColor, stroke: '#000', strokeWidth: 1.5 }}
              />
              <span className="medal-position">
                {win.position}
              </span>
            </div>
          );
        })}
      </div>
      </div>

      {selectedWin && (
        <div className="medal-detail-overlay" onClick={() => setSelectedWin(null)}>
          <div className="medal-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="medal-detail-close"
              onClick={() => setSelectedWin(null)}
            >
              <X size={24} />
            </button>
            <div className="medal-detail-content">
              <div 
                className={`medal-detail-medal ${selectedWin.position === 1 ? 'gold' : selectedWin.position === 2 ? 'silver' : 'bronze'}`}
                style={{ boxShadow: `0 0 20px ${getTierColor(selectedWin.pool)}40, 0 0 40px ${getTierColor(selectedWin.pool)}20` }}
              >
                <Star 
                  size={90} 
                  className="medal-tier-star-large" 
                  style={{ fill: getTierColor(selectedWin.pool), stroke: '#000', strokeWidth: 2 }}
                />
                <span className="medal-position-large">
                  {selectedWin.position}
                </span>
              </div>
              <h3 className="medal-detail-title">{cleanTitle(selectedWin.name)}</h3>
              <div className="medal-detail-info">
                <div className="medal-detail-row">
                  <span className="medal-detail-label">Tier:</span>
                  <span 
                    className="medal-detail-value"
                    style={{ color: getTierColor(selectedWin.pool) }}
                  >
                    {getTierName(selectedWin.pool)}
                  </span>
                </div>
                <div className="medal-detail-row">
                  <span className="medal-detail-label">Position:</span>
                  <span className="medal-detail-value">
                    {selectedWin.position === 1 ? '1st Place' : selectedWin.position === 2 ? '2nd Place' : '3rd Place'}
                  </span>
                </div>
                {selectedWin.start_date && (
                  <div className="medal-detail-row">
                    <span className="medal-detail-label">Date:</span>
                    <span className="medal-detail-value">{formatDate(selectedWin.start_date)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TournamentBadges;

