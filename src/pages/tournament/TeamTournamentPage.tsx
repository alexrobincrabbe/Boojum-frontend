import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { teamTournamentAPI } from '../../services/api';
import { Loading } from '../../components/Loading';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';
import './TournamentPage.css';

interface TeamPlayer {
  id: number;
  username: string;
  display_name: string;
  profile_url: string;
  chat_color?: string;
}

interface Team {
  id: number;
  name: string;
  player_1: TeamPlayer;
  player_2: TeamPlayer;
  player_3: TeamPlayer;
}

interface TeamMatch {
  id: number;
  round: number;
  team_1: Team;
  team_2: Team;
  closed: boolean;
  team_result: {
    winner_team: Team | null;
    loser_team: Team | null;
    team_1_score: number;
    team_2_score: number;
    team_1_submitted: boolean;
    team_2_submitted: boolean;
    team_1_player_1_played: boolean;
    team_1_player_2_played: boolean;
    team_1_player_3_played: boolean;
    team_2_player_1_played: boolean;
    team_2_player_2_played: boolean;
    team_2_player_3_played: boolean;
  } | null;
}

interface TeamTournament {
  id: number;
  name: string;
  description: string;
  type: string;
  rounds: number;
  current_round: number;
  time_limit: number;
  registration_close: string | null;
  start: string | null;
  champion_team: Team | null;
  finalist_team: Team | null;
}

interface RegisteredPlayer {
  id: number;
  username: string;
  display_name: string;
  profile_url: string;
  profile_picture_url: string;
  chat_color: string;
}

interface TeamTournamentData {
  active_tournament: TeamTournament | null;
  registration_open: boolean;
  registered: boolean;
  tournament_started: boolean;
  matches: TeamMatch[];
  rounds: number;
  round_time_remaining: Array<{
    round: number;
    time_remaining: string;
    seconds_remaining: number;
  }>;
  registration_time_remaining: string;
  registration_seconds_remaining: number;
  time_till_start: string;
  registered_players: RegisteredPlayer[];
  no_registered_players: number;
}

interface TeamTournamentPageProps {
  tournamentType?: 'active' | 'test';
}

const TeamTournamentPage = ({ tournamentType = 'active' }: TeamTournamentPageProps = {}) => {
  const [data, setData] = useState<TeamTournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState<Record<number, string>>({});
  const [registering, setRegistering] = useState(false);
  const [registrationTimeRemaining, setRegistrationTimeRemaining] = useState<string>('');
  const { user, isAuthenticated } = useAuth();

  const cleanTournamentName = (name: string) => {
    return name.replace(/&nbsp;/g, '').trim();
  };

  useEffect(() => {
    const loadTournamentData = async () => {
      try {
        const tournamentData = await teamTournamentAPI.getTeamTournamentData(tournamentType);
        setData(tournamentData);
        if (tournamentData.active_tournament?.current_round) {
          const currentRound = tournamentData.active_tournament.current_round;
          const totalRounds = tournamentData.active_tournament.rounds || tournamentData.rounds || 1;
          const defaultRound = currentRound > totalRounds ? totalRounds : currentRound;
          setSelectedRound(defaultRound);
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || 'Failed to load team tournament data');
        console.error('Error loading team tournament data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTournamentData();
  }, [tournamentType]);

  // Registration timer countdown
  const registrationCountdownRef = useRef<number | null>(null);
  const registrationSecondsRemainingRef = useRef<number>(0);

  useEffect(() => {
    if (!data || !data.registration_time_remaining || data.registration_seconds_remaining <= 0) {
      setRegistrationTimeRemaining('');
      if (registrationCountdownRef.current !== null) {
        clearInterval(registrationCountdownRef.current);
        registrationCountdownRef.current = null;
      }
      return;
    }

    registrationSecondsRemainingRef.current = data.registration_seconds_remaining;
    setRegistrationTimeRemaining(data.registration_time_remaining);

    if (registrationCountdownRef.current !== null) {
      clearInterval(registrationCountdownRef.current);
    }

    const updateRegistrationCountdown = () => {
      const secondsRemaining = registrationSecondsRemainingRef.current;
      if (secondsRemaining <= 0) {
        setRegistrationTimeRemaining('');
        if (registrationCountdownRef.current !== null) {
          clearInterval(registrationCountdownRef.current);
          registrationCountdownRef.current = null;
        }
        return;
      }

      const days = Math.floor(secondsRemaining / (3600 * 24));
      const hours = Math.floor((secondsRemaining % (3600 * 24)) / 3600);
      const minutes = Math.floor((secondsRemaining % 3600) / 60);
      const secs = secondsRemaining % 60;

      let timeString = '';
      if (days > 0) {
        timeString = `${days} days ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      setRegistrationTimeRemaining(timeString);
      registrationSecondsRemainingRef.current--;
    };

    updateRegistrationCountdown();
    registrationCountdownRef.current = window.setInterval(() => {
      updateRegistrationCountdown();
    }, 1000);

    return () => {
      if (registrationCountdownRef.current !== null) {
        clearInterval(registrationCountdownRef.current);
        registrationCountdownRef.current = null;
      }
    };
  }, [data]);

  // Real-time countdown for round timers
  const roundCountdownRefs = useRef<Record<number, number | null>>({});
  const roundSecondsRemainingRefs = useRef<Record<number, number>>({});

  useEffect(() => {
    if (!data || !data.round_time_remaining || data.round_time_remaining.length === 0) {
      setRoundTimeRemaining({});
      Object.values(roundCountdownRefs.current).forEach(intervalId => {
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
      });
      roundCountdownRefs.current = {};
      return;
    }

    data.round_time_remaining.forEach((roundData) => {
      if (!roundData.seconds_remaining || roundData.seconds_remaining <= 0) {
        setRoundTimeRemaining(prev => {
          const updated = { ...prev };
          delete updated[roundData.round];
          return updated;
        });
        return;
      }

      roundSecondsRemainingRefs.current[roundData.round] = roundData.seconds_remaining;

      if (roundCountdownRefs.current[roundData.round] !== null && roundCountdownRefs.current[roundData.round] !== undefined) {
        clearInterval(roundCountdownRefs.current[roundData.round]!);
      }

      const updateRoundCountdown = () => {
        const secondsRemaining = roundSecondsRemainingRefs.current[roundData.round];
        if (secondsRemaining <= 0) {
          setRoundTimeRemaining(prev => {
            const updated = { ...prev };
            delete updated[roundData.round];
            return updated;
          });
          if (roundCountdownRefs.current[roundData.round] !== null) {
            clearInterval(roundCountdownRefs.current[roundData.round]!);
            roundCountdownRefs.current[roundData.round] = null;
          }
          return;
        }

        const days = Math.floor(secondsRemaining / (3600 * 24));
        const hours = Math.floor((secondsRemaining % (3600 * 24)) / 3600);
        const minutes = Math.floor((secondsRemaining % 3600) / 60);
        const secs = secondsRemaining % 60;

        let timeString = '';
        if (days > 0) {
          timeString = `${days} days ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
          timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        setRoundTimeRemaining(prev => ({
          ...prev,
          [roundData.round]: timeString,
        }));

        roundSecondsRemainingRefs.current[roundData.round]--;
      };

      updateRoundCountdown();

      roundCountdownRefs.current[roundData.round] = window.setInterval(() => {
        updateRoundCountdown();
      }, 1000);
    });

    return () => {
      Object.values(roundCountdownRefs.current).forEach(intervalId => {
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
      });
      roundCountdownRefs.current = {};
    };
  }, [data]);

  const isUserInTeam = (team: Team): boolean => {
    if (!user) return false;
    return team.player_1.id === user.id || team.player_2.id === user.id || team.player_3.id === user.id;
  };

  const handleRegister = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to register for the tournament');
      return;
    }
    
    setRegistering(true);
    try {
      const response = await teamTournamentAPI.register(tournamentType);
      toast.success(response.message || 'Registered successfully!');
      // Reload tournament data to update registration status
      const tournamentData = await teamTournamentAPI.getTeamTournamentData(tournamentType);
      setData(tournamentData);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to register for tournament');
      console.error('Error registering team for tournament:', err);
    } finally {
      setRegistering(false);
    }
  };

  const handleUnregister = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to withdraw from the tournament');
      return;
    }
    
    setRegistering(true);
    try {
      const response = await teamTournamentAPI.unregister(tournamentType);
      toast.success(response.message || 'Unregistered successfully!');
      // Reload tournament data to update registration status
      const tournamentData = await teamTournamentAPI.getTeamTournamentData(tournamentType);
      setData(tournamentData);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to unregister from tournament');
      console.error('Error unregistering team from tournament:', err);
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return <Loading minHeight="calc(100vh - 70px)" />;
  }

  if (error) {
    return (
      <div className="tournament-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!data || !data.active_tournament) {
    return (
      <div className="tournament-container">
        <div className="tournament-description">
          <span className="no-tournament">There is no team tournament at the moment. Check back soon!</span>
        </div>
      </div>
    );
  }

  const { active_tournament: tournament } = data;

  return (
    <div className="tournament-container">
      <div id="tournament-wrapper" className="container-fluid">
        {/* Round time remaining */}
        {data.round_time_remaining.map((roundData) => {
          const timeRemaining = roundTimeRemaining[roundData.round] || roundData.time_remaining;
          if (!timeRemaining) return null;
          const roundSecondsRef = roundSecondsRemainingRefs.current[roundData.round];
          const currentSeconds = roundSecondsRef !== undefined ? roundSecondsRef : roundData.seconds_remaining;
          const timeClass = 
            currentSeconds > 7200 ? 'blue' :
            currentSeconds > 1800 ? 'yellow' : 'pink';
          return (
            <div key={roundData.round} className="round-remaining-container">
              <span className="yellow">Round {roundData.round} ends:</span>
              <span className={`time-remaining ${timeClass}`}>
                {timeRemaining}
              </span>
            </div>
          );
        })}

        <div className="row justify-content-center">
          <div className="col-12">
            <h1 className="tournament-title pink">{cleanTournamentName(tournament.name)}</h1>
            <button
              className="tournament-rules-button blue"
              onClick={() => setRulesModalOpen(true)}
            >
              View Rules and Info
            </button>
          </div>

          {/* Registration Section */}
          <div className="col-12" data-onboarding="team-tournament-registration">
            {!isAuthenticated ? (
              <div className="registration-closed">
                <span>Please login to take part in the tournament</span>
              </div>
            ) : (data.registration_open || registrationTimeRemaining) ? (
              <div>
                {registrationTimeRemaining && (
                  <div className="registration-timer-container">
                    <span className="blue">Signup ends: </span>
                    <span className="green">{registrationTimeRemaining}</span>
                  </div>
                )}
                {data.registered ? (
                  <div>
                    <button 
                      className="tournament-register-button button-registered"
                      onClick={handleUnregister}
                      disabled={registering}
                    >
                      {registering ? 'Withdrawing...' : 'withdraw'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <button 
                      className="tournament-register-button"
                      onClick={handleRegister}
                      disabled={registering}
                    >
                      {registering ? 'Registering...' : 'register'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              !data.tournament_started && (
                <div className="registration-closed">
                  <span className="pink">Registration is closed.</span>
                  {data.time_till_start && (
                    <span> Tournament starts in: &nbsp;<em className="yellow">{data.time_till_start}</em></span>
                  )}
                </div>
              )
            )}
          </div>

          {/* Registered Players List */}
          {!data.tournament_started && data.registered_players && data.registered_players.length > 0 && (
            <div className="col-12">
              <h3 className="round-header blue">Registered Players ({data.no_registered_players})</h3>
              <div className="registered-players-list">
                {data.registered_players.map((player) => {
                  const profilePictureUrl = player.profile_picture_url || '/images/default.png';
                  const chatColor = player.chat_color || '#71bbe9';
                  const isGlowWorm = chatColor === '#71bbe9';
                  
                  return (
                    <div key={player.id} className="registered-player">
                      <img
                        src={profilePictureUrl}
                        alt={player.display_name}
                        className="registered-player-avatar"
                        style={{ borderColor: chatColor }}
                      />
                      <a 
                        href={`/profile/${player.profile_url}`} 
                        className="player-link"
                        style={{
                          color: chatColor,
                          textShadow: isGlowWorm 
                            ? '2px 2px 6px rgb(38, 76, 146), -2px -2px 6px rgb(38, 76, 146), 2px -2px 6px rgb(38, 76, 146), -2px 2px 6px rgb(38, 76, 146)'
                            : 'none'
                        }}
                      >
                        {player.display_name}
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Tournament Rounds and Matches */}
        {data.tournament_started && data.matches.length > 0 && (
          <div className="row justify-content-center">
            {/* Round Selection Tab */}
            <div className="round-tabs-container">
              <div className="round-tabs">
                {Array.from({ length: data.rounds }, (_, i) => i + 1).map((round) => (
                  <button
                    key={round}
                    className={`round-tab ${selectedRound === round ? 'active' : ''}`}
                    onClick={() => setSelectedRound(round)}
                  >
                    Round {round}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Round Content */}
            <div className="round-section">
              <h3 className="round-header blue">Round {selectedRound}</h3>
              {(() => {
                const roundTimeData = data.round_time_remaining.find(r => r.round === selectedRound);
                const roundMatches = data.matches.filter(m => m.round === selectedRound);
                const timeRemaining = roundTimeRemaining[selectedRound] || (roundTimeData?.time_remaining);

                return (
                  <>
                    {timeRemaining && (
                      <div className="round-time">
                        Time remaining: <span className="yellow">{timeRemaining}</span>
                      </div>
                    )}

                    {/* Matches */}
                    <div className="matches-container">
                      {roundMatches.map((match) => {
                        const userInTeam1 = isUserInTeam(match.team_1);
                        const userInTeam2 = isUserInTeam(match.team_2);
                        const bothPlayed = match.team_result?.team_1_submitted && match.team_result?.team_2_submitted;
                        
                        // Check if current user has already played
                        let userHasPlayed = false;
                        if (user && match.team_result) {
                          if (userInTeam1) {
                            if (user.id === match.team_1.player_1.id) {
                              userHasPlayed = match.team_result.team_1_player_1_played;
                            } else if (user.id === match.team_1.player_2.id) {
                              userHasPlayed = match.team_result.team_1_player_2_played;
                            } else if (user.id === match.team_1.player_3.id) {
                              userHasPlayed = match.team_result.team_1_player_3_played;
                            }
                          } else if (userInTeam2) {
                            if (user.id === match.team_2.player_1.id) {
                              userHasPlayed = match.team_result.team_2_player_1_played;
                            } else if (user.id === match.team_2.player_2.id) {
                              userHasPlayed = match.team_result.team_2_player_2_played;
                            } else if (user.id === match.team_2.player_3.id) {
                              userHasPlayed = match.team_result.team_2_player_3_played;
                            }
                          }
                        }

                        // Helper function to check if a player has played
                        const hasPlayerPlayed = (playerId: number, team: Team, result: typeof match.team_result): boolean => {
                          if (!result) return false;
                          if (team.id === match.team_1.id) {
                            if (playerId === match.team_1.player_1.id) return result.team_1_player_1_played;
                            if (playerId === match.team_1.player_2.id) return result.team_1_player_2_played;
                            if (playerId === match.team_1.player_3.id) return result.team_1_player_3_played;
                          } else if (team.id === match.team_2.id) {
                            if (playerId === match.team_2.player_1.id) return result.team_2_player_1_played;
                            if (playerId === match.team_2.player_2.id) return result.team_2_player_2_played;
                            if (playerId === match.team_2.player_3.id) return result.team_2_player_3_played;
                          }
                          return false;
                        };

                        return (
                          <div key={match.id} className="team-match-container">
                            <div className="team-match-header">
                              <div className="team-match-team">
                                <div className="team-match-team-name">{match.team_1.name}</div>
                                {bothPlayed && match.team_result && (
                                  <div className="team-match-score">{match.team_result.team_1_score}</div>
                                )}
                              </div>
                              <div className="team-match-vs">vs</div>
                              <div className="team-match-team">
                                <div className="team-match-team-name">{match.team_2.name}</div>
                                {bothPlayed && match.team_result && (
                                  <div className="team-match-score">{match.team_result.team_2_score}</div>
                                )}
                              </div>
                            </div>
                            
                            <div className="team-match-players">
                              <div className="team-match-team-players">
                                {[match.team_1.player_1, match.team_1.player_2, match.team_1.player_3].map((player) => {
                                  const played = hasPlayerPlayed(player.id, match.team_1, match.team_result);
                                  const isCurrentUser = user && user.id === player.id;
                                  return (
                                    <div key={player.id} className={`team-match-player-row ${played ? 'played' : ''} ${isCurrentUser ? 'current-user' : ''}`}>
                                      <a
                                        href={`/profile/${player.profile_url}`}
                                        className="team-match-player-link"
                                        style={{ color: player.chat_color || '#71bbe9' }}
                                      >
                                        {player.display_name}
                                      </a>
                                      {played ? (
                                        <span className="team-match-player-status played">✓ Played</span>
                                      ) : (
                                        <span className="team-match-player-status pending">Pending</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              
                              <div className="team-match-team-players">
                                {[match.team_2.player_1, match.team_2.player_2, match.team_2.player_3].map((player) => {
                                  const played = hasPlayerPlayed(player.id, match.team_2, match.team_result);
                                  const isCurrentUser = user && user.id === player.id;
                                  return (
                                    <div key={player.id} className={`team-match-player-row ${played ? 'played' : ''} ${isCurrentUser ? 'current-user' : ''}`}>
                                      <a
                                        href={`/profile/${player.profile_url}`}
                                        className="team-match-player-link"
                                        style={{ color: player.chat_color || '#71bbe9' }}
                                      >
                                        {player.display_name}
                                      </a>
                                      {played ? (
                                        <span className="team-match-player-status played">✓ Played</span>
                                      ) : (
                                        <span className="team-match-player-status pending">Pending</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {!bothPlayed && (userInTeam1 || userInTeam2) && !userHasPlayed && (
                              <div className="team-match-actions">
                                <Link to={`/team-tournament/play/${match.id}`} className="play-button blue">
                                  Play
                                </Link>
                              </div>
                            )}
                            {bothPlayed && match.team_result && (
                              <div className="team-match-actions">
                                <Link to={`/team-tournament/match/${match.id}`} className="view-results-button blue">
                                  View Results
                                </Link>
                              </div>
                            )}
                            {match.closed && match.team_result && (
                              <div className="match-result">
                                Winner: {match.team_result.winner_team?.name}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Champions */}
        {tournament.champion_team && (
          <div className="champions-section">
            <div className="champion-section">
              <h2 className="champion-title blue">Champions: {tournament.champion_team.name}</h2>
            </div>
          </div>
        )}
      </div>

      {/* Rules Modal */}
      {rulesModalOpen && (
        <div className="tournament-rules-modal-overlay" onClick={() => setRulesModalOpen(false)}>
          <div className="tournament-rules-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="tournament-rules-modal-header">
              <h2 className="tournament-rules-modal-title">Team Tournament Rules and Info</h2>
              <button
                className="tournament-rules-modal-close"
                onClick={() => setRulesModalOpen(false)}
                aria-label="Close rules"
              >
                <X size={24} />
              </button>
            </div>
            <div className="tournament-rules-modal-body">
              <div 
                id="tournament-info" 
                dangerouslySetInnerHTML={{ __html: tournament.description }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamTournamentPage;

