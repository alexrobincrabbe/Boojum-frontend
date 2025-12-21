import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(new Set());

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

  // Group badges by type (position + pool combination)
  const groupedBadges = sortedWins.reduce((acc, win) => {
    const key = `${win.position}-${win.pool}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(win);
    return acc;
  }, {} as Record<string, TournamentWin[]>);

  const toggleStack = (stackKey: string) => {
    setExpandedStacks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stackKey)) {
        newSet.delete(stackKey);
      } else {
        newSet.add(stackKey);
      }
      return newSet;
    });
  };

  return (
    <>
      <div className="tournament-badges-container">
      <div className="tournament-medals-row">
        {Object.entries(groupedBadges).map(([stackKey, wins]) => {
          const isExpanded = expandedStacks.has(stackKey);
          const [, pool] = stackKey.split('-').map(Number);
          const tierColor = getTierColor(pool);
          const stackSize = wins.length;
          
          return (
            <div key={stackKey} className="badge-stack-container">
              <div 
                className={`badge-stack ${isExpanded ? 'expanded' : ''}`}
                style={!isExpanded ? { '--stack-size': stackSize - 1 } as React.CSSProperties : {}}
                onClick={() => {
                  toggleStack(stackKey);
                }}
              >
                {wins.map((win, index) => {
                  const uniqueKey = `${win.id}-${win.pool}-${win.position}-${index}`;
                  const zIndex = stackSize - index;
                  const rightOffset = index * 8; // 8px overlap per badge to the left (using right positioning)
                  
                  return (
                    <div
                      key={uniqueKey}
                      className={`tournament-medal ${win.position === 1 ? 'gold' : win.position === 2 ? 'silver' : 'bronze'}`}
                      onClick={(e) => {
                        if (isExpanded) {
                          e.stopPropagation();
                          setSelectedWin(win);
                        }
                      }}
                      title={isExpanded ? cleanTitle(win.name) : `${stackSize} ${win.position === 1 ? '1st' : win.position === 2 ? '2nd' : '3rd'} place${stackSize > 1 ? 's' : ''}`}
                      style={{ 
                        boxShadow: `0 0 15px ${tierColor}40, 0 0 30px ${tierColor}20`,
                        zIndex: zIndex,
                        right: isExpanded ? 'auto' : `${rightOffset}px`,
                        position: isExpanded ? 'relative' : 'absolute',
                        marginLeft: isExpanded ? '0' : '0',
                        marginRight: isExpanded ? '10px' : '0',
                        transition: 'all 0.3s ease'
                      }}
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
              <div className="medal-detail-actions">
                <Link 
                  to={`/tournament?id=${selectedWin.id}`}
                  className="medal-detail-link"
                  onClick={() => setSelectedWin(null)}
                >
                  View Tournament Archive
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TournamentBadges;

