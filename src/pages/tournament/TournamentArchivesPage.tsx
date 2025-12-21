import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { tournamentAPI } from '../../services/api';
import { Loading } from '../../components/Loading';
import './TournamentArchivesPage.css';

interface TournamentChampion {
  id: number;
  username: string;
  display_name: string;
  profile_picture_url?: string;
}

interface TournamentListItem {
  id: number;
  name: string;
  start: string | null;
  active: boolean;
  champion: TournamentChampion | null;
  champion_2: TournamentChampion | null;
  champion_3: TournamentChampion | null;
}

const TournamentArchivesPage = () => {
  const [tournamentList, setTournamentList] = useState<TournamentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadTournamentList = async () => {
      try {
        const response = await tournamentAPI.getTournamentList();
        setTournamentList(response.tournaments || []);
      } catch (err) {
        setError('Failed to load tournament archives');
        console.error('Error loading tournament list:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTournamentList();
  }, []);

  const handleTournamentClick = (tournamentId: number, isActive: boolean) => {
    if (isActive) {
      navigate('/tournament');
    } else {
      navigate(`/tournament?id=${tournamentId}`);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Date unknown';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'Date unknown';
    }
  };

  const cleanTournamentName = (name: string) => {
    return name.replace(/&nbsp;/g, '').trim();
  };

  if (loading) {
    return <Loading minHeight="calc(100vh - 70px)" />;
  }

  if (error) {
    return (
      <div className="tournament-archives-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="tournament-archives-container">
      <div className="tournament-archives-wrapper">
        <div className="tournament-archives-header">
          <h1 className="tournament-archives-title pink">Tournament Archives</h1>
          <Link to="/tournament" className="tournament-archives-back-button blue">
            ← Back to Active Tournament
          </Link>
        </div>

        {tournamentList.length === 0 ? (
          <div className="tournament-archives-empty">
            <p>No tournaments found.</p>
          </div>
        ) : (
          <div className="tournament-archives-list">
            {tournamentList.map((tournament) => (
              <div
                key={tournament.id}
                className={`tournament-archives-item ${tournament.active ? 'active' : ''}`}
                onClick={() => handleTournamentClick(tournament.id, tournament.active)}
              >
                <div className="tournament-archives-item-content">
                  <h3 className="tournament-archives-item-name">
                    {cleanTournamentName(tournament.name)}
                    {tournament.active && (
                      <span className="tournament-archives-active-badge">Active</span>
                    )}
                  </h3>
                  <p className="tournament-archives-item-date">
                    {formatDate(tournament.start)}
                  </p>
                  {(tournament.champion || tournament.champion_2 || tournament.champion_3) && (
                    <div className="tournament-archives-winners">
                      <span className="tournament-archives-winners-label">Winners: </span>
                      {tournament.champion && (
                        <span className="tournament-archives-winner tournament-archives-winner-first">
                          <img 
                            src={tournament.champion.profile_picture_url || '/images/default.png'} 
                            alt={tournament.champion.display_name}
                            className="tournament-archives-winner-avatar"
                          />
                          {tournament.champion.display_name}
                        </span>
                      )}
                      {tournament.champion_2 && (
                        <span className="tournament-archives-winner tournament-archives-winner-second">
                          <img 
                            src={tournament.champion_2.profile_picture_url || '/images/default.png'} 
                            alt={tournament.champion_2.display_name}
                            className="tournament-archives-winner-avatar"
                          />
                          {tournament.champion_2.display_name}
                        </span>
                      )}
                      {tournament.champion_3 && (
                        <span className="tournament-archives-winner tournament-archives-winner-third">
                          <img 
                            src={tournament.champion_3.profile_picture_url || '/images/default.png'} 
                            alt={tournament.champion_3.display_name}
                            className="tournament-archives-winner-avatar"
                          />
                          {tournament.champion_3.display_name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="tournament-archives-item-arrow">→</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentArchivesPage;

