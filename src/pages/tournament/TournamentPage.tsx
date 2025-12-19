import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { tournamentAPI } from '../../services/api';
import { Loading } from '../../components/Loading';
import { X } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import './TournamentPage.css';

interface TournamentPlayer {
  id: number;
  username: string;
  display_name: string;
  profile_url: string;
  profile_picture_url?: string;
  chat_color?: string;
  wins?: number;
  score_total?: number;
  group_games_played?: number;
}

interface TournamentMatch { 
  id: number;
  round: number;
  pool: number | null;
  group_number: number | null;
  player_1: TournamentPlayer | null;
  player_2: TournamentPlayer | null;
  closed: boolean;
  player_1_played: boolean;
  player_2_played: boolean;
  result: {
    winner: TournamentPlayer | null;
    loser: TournamentPlayer | null;
    score_player_1: number;
    score_player_2: number;
  } | null;
}

interface TournamentGroup {
  id: number;
  group_number: number;
  players: TournamentPlayer[];
}

interface Tournament {
  id: number;
  name: string;
  description: string;
  type: string;
  one_shot: boolean;
  round_format: string;
  rounds: number;
  current_round: number;
  time_limit: number;
  registration_close: string | null;
  start: string | null;
  champion: TournamentPlayer | null;
  champion_2: TournamentPlayer | null;
  champion_3: TournamentPlayer | null;
}

interface TournamentData {
  tournament: Tournament | null;
  registration_open: boolean;
  registered: boolean;
  tournament_started: boolean;
  registered_players: TournamentPlayer[];
  no_registered_players: number;
  groups: TournamentGroup[];
  matches: TournamentMatch[];
  rounds: number;
  round_time_remaining: Array<{
    round: number;
    time_remaining: string;
    seconds_remaining: number;
  }>;
  registration_time_remaining: string;
  registration_seconds_remaining: number;
  time_till_start: string;
  semi_final: number | null;
  quarter_final: number | null;
  user_group: number;
  player_pool: number;
  pools: number[];
}

interface TournamentPageProps {
  tournamentType?: 'active' | 'test';
}

const TournamentPage = ({ tournamentType = 'active' }: TournamentPageProps = {}) => {
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<TournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<number>(1); // 1=SuperStars, 2=RisingStars, 3=ShootingStars
  const [selectedRound, setSelectedRound] = useState<number>(1);
  const [selectedGroup, setSelectedGroup] = useState<number>(1); // 1 or 2 within each tier
  const [registering, setRegistering] = useState(false);
  const [registrationTimeRemaining, setRegistrationTimeRemaining] = useState<string>('');
  const [roundTimeRemaining, setRoundTimeRemaining] = useState<Record<number, string>>({});
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const loadTournamentData = async () => {
      try {
        const tournamentData = await tournamentAPI.getTournamentData(tournamentType);
        setData(tournamentData);
        // Set default round to current round, or last round if current round exceeds rounds
        if (tournamentData.tournament?.current_round) {
          const currentRound = tournamentData.tournament.current_round;
          const totalRounds = tournamentData.tournament.rounds || tournamentData.rounds || 1;
          // If current round is greater than total rounds, show the last round
          const defaultRound = currentRound > totalRounds ? totalRounds : currentRound;
          setSelectedRound(defaultRound);
        }
        // Set default tier and group based on user's pool and group
        // If player_pool is available, use it; otherwise derive from user_group
        if (tournamentData.player_pool) {
          setSelectedTier(tournamentData.player_pool);
        } else if (tournamentData.user_group) {
          // Derive tier from group number: Groups 1-2 = Tier 1, Groups 3-4 = Tier 2, Groups 5-6 = Tier 3
          if (tournamentData.user_group <= 2) {
            setSelectedTier(1);
          } else if (tournamentData.user_group <= 4) {
            setSelectedTier(2);
          } else if (tournamentData.user_group <= 6) {
            setSelectedTier(3);
          }
        }
        
        // Set default group based on user's group number
        // Groups 1-2 are Tier 1, Groups 3-4 are Tier 2, Groups 5-6 are Tier 3
        if (tournamentData.user_group) {
          if (tournamentData.user_group <= 2) {
            // Tier 1 (SuperStars): group 1 = group_number 1, group 2 = group_number 2
            setSelectedGroup(tournamentData.user_group);
          } else if (tournamentData.user_group <= 4) {
            // Tier 2 (RisingStars): group 1 = group_number 3, group 2 = group_number 4
            setSelectedGroup(tournamentData.user_group - 2);
          } else if (tournamentData.user_group <= 6) {
            // Tier 3 (ShootingStars): group 1 = group_number 5, group 2 = group_number 6
            setSelectedGroup(tournamentData.user_group - 4);
          }
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || 'Failed to load tournament data');
        console.error('Error loading tournament data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTournamentData();
  }, [tournamentType, searchParams]);

  // Real-time countdown for registration
  const registrationCountdownRef = useRef<number | null>(null);
  const secondsRemainingRef = useRef<number>(0);
  
  useEffect(() => {
    // Clear any existing interval
    if (registrationCountdownRef.current !== null) {
      clearInterval(registrationCountdownRef.current);
      registrationCountdownRef.current = null;
    }

    // Start countdown if there are seconds remaining, regardless of registration_open status
    // (registration_open might be false due to timing, but if seconds remain, countdown should run)
    if (!data || !data.registration_seconds_remaining || data.registration_seconds_remaining <= 0) {
      setRegistrationTimeRemaining('');
      return;
    }

    // Initialize seconds remaining
    secondsRemainingRef.current = data.registration_seconds_remaining;
    
    const updateCountdown = () => {
      if (secondsRemainingRef.current <= 0) {
        setRegistrationTimeRemaining('');
        if (registrationCountdownRef.current !== null) {
          clearInterval(registrationCountdownRef.current);
          registrationCountdownRef.current = null;
        }
        return;
      }

      const days = Math.floor(secondsRemainingRef.current / (3600 * 24));
      const hours = Math.floor((secondsRemainingRef.current % (3600 * 24)) / 3600);
      const minutes = Math.floor((secondsRemainingRef.current % 3600) / 60);
      const secs = secondsRemainingRef.current % 60;

      let timeString = '';
      if (days > 0) {
        timeString = `${days} days ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }

      setRegistrationTimeRemaining(timeString);
      secondsRemainingRef.current--;
    };

    // Update immediately
    updateCountdown();

    // Update every second
    registrationCountdownRef.current = window.setInterval(() => {
      updateCountdown();
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
      // Clear all intervals
      Object.values(roundCountdownRefs.current).forEach(intervalId => {
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
      });
      roundCountdownRefs.current = {};
      return;
    }

    // Clear existing intervals for rounds that are no longer in the data
    Object.keys(roundCountdownRefs.current).forEach(roundStr => {
      const round = parseInt(roundStr);
      if (!data.round_time_remaining.find(r => r.round === round)) {
        const intervalId = roundCountdownRefs.current[round];
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
        delete roundCountdownRefs.current[round];
        delete roundSecondsRemainingRefs.current[round];
      }
    });

    // Initialize countdowns for each round
    data.round_time_remaining.forEach((roundData) => {
      if (!roundData.seconds_remaining || roundData.seconds_remaining <= 0) {
        setRoundTimeRemaining(prev => {
          const updated = { ...prev };
          delete updated[roundData.round];
          return updated;
        });
        return;
      }

      // Initialize seconds remaining for this round
      roundSecondsRemainingRefs.current[roundData.round] = roundData.seconds_remaining;

      // Clear existing interval for this round if it exists
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

      // Update immediately
      updateRoundCountdown();

      // Update every second
      roundCountdownRefs.current[roundData.round] = window.setInterval(() => {
        updateRoundCountdown();
      }, 1000);
    });

    return () => {
      // Clear all intervals on cleanup
      Object.values(roundCountdownRefs.current).forEach(intervalId => {
        if (intervalId !== null) {
          clearInterval(intervalId);
        }
      });
      roundCountdownRefs.current = {};
    };
  }, [data]);

  const handleRegister = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to register for the tournament');
      return;
    }
    
    setRegistering(true);
    try {
      const response = await tournamentAPI.register(tournamentType);
      toast.success(response.message || 'Registered successfully!');
      // Reload tournament data to update registration status
      const tournamentData = await tournamentAPI.getTournamentData(tournamentType);
      setData(tournamentData);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to register for tournament');
      console.error('Error registering for tournament:', err);
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
      const response = await tournamentAPI.unregister(tournamentType);
      toast.success(response.message || 'Withdrawn successfully!');
      // Reload tournament data to update registration status
      const tournamentData = await tournamentAPI.getTournamentData(tournamentType);
      setData(tournamentData);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to withdraw from tournament');
      console.error('Error withdrawing from tournament:', err);
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

  if (!data || !data.tournament) {
    return (
      <div className="tournament-container">
        <div className="tournament-description">
          <span className="no-tournament">There is no tournament at the moment. Check back soon!</span>
        </div>
      </div>
    );
  }

  const { tournament } = data;

  return (
    <div className="tournament-container">
      <div id="tournament-wrapper" className="container-fluid">
        {/* Round time remaining */}
        {data.round_time_remaining.map((roundData) => {
          const timeRemaining = roundTimeRemaining[roundData.round] || roundData.time_remaining;
          if (!timeRemaining) return null;
          // Get current seconds from ref, fallback to initial data
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
          {/* Tournament Details */}
          <div className="col-12">
            <h1 className="tournament-title pink">{tournament.name}</h1>
            <button
              className="tournament-rules-button blue"
              onClick={() => setRulesModalOpen(true)}
            >
              View Rules and Info
            </button>
          </div>

          {/* Registration Section */}
          <div className="col-12">
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
                      className="tournament-register-button button-registered blue"
                      onClick={handleUnregister}
                      disabled={registering}
                    >
                      {registering ? 'Withdrawing...' : 'withdraw'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <button 
                      className="tournament-register-button blue"
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
          {!data.tournament_started && data.registered_players.length > 0 && (
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
        {data.tournament_started && (data.matches.length > 0 || (data.groups && data.groups.length > 0 && tournament.round_format === 'group_phase')) && (
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

            {/* Tier/Pool Selection Tab - Underneath round tabs */}
            <div className="tier-tabs-container">
              <div className="tier-tabs">
                {data.pools.map((pool) => (
                  <button
                    key={pool}
                    className={`tier-tab ${selectedTier === pool ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedTier(pool);
                      if (selectedRound === 1 && tournament.round_format === 'group_phase') {
                        setSelectedGroup(1); // Reset to group 1 when tier changes
                      }
                    }}
                  >
                    {pool === 1 ? 'SuperStars' : pool === 2 ? 'RisingStars' : 'ShootingStars'}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Round Content */}
            <div className="round-section">
              <h3 className="round-header blue">Round {selectedRound}</h3>
              {(() => {
                const roundTimeData = data.round_time_remaining.find(r => r.round === selectedRound);
                const roundMatches = data.matches.filter(m => {
                  if (m.round !== selectedRound) return false;
                  if (tournament.round_format === 'group_phase') {
                    // For group phase, round 1 uses groups, rounds 2+ use pools
                    if (selectedRound === 1) {
                      // In round 1, filter by group (tiers map to groups: 1-2=SuperStars, 3-4=RisingStars, 5-6=ShootingStars)
                      if (selectedTier === 1) {
                        if (selectedGroup === 1) return m.group_number === 1;
                        if (selectedGroup === 2) return m.group_number === 2;
                      } else if (selectedTier === 2) {
                        if (selectedGroup === 1) return m.group_number === 3;
                        if (selectedGroup === 2) return m.group_number === 4;
                      } else if (selectedTier === 3) {
                        if (selectedGroup === 1) return m.group_number === 5;
                        if (selectedGroup === 2) return m.group_number === 6;
                      }
                      return false;
                    } else {
                      // For rounds after 1, filter by pool (tier = pool)
                      return m.pool === selectedTier;
                    }
                  } else {
                    // For non-group phase, filter by pool
                    return m.pool === selectedTier;
                  }
                });

                const timeRemaining = roundTimeRemaining[selectedRound] || (roundTimeData?.time_remaining);
                return (
                  <>
                    {timeRemaining && (
                      <div className="round-time">
                        Time remaining: <span className="yellow">{timeRemaining}</span>
                      </div>
                    )}

                    {/* Group Tables for Round 1 - Group Phase */}
                    {tournament.round_format === 'group_phase' && selectedRound === 1 && data.groups && data.groups.length > 0 && (
                      <div className="group-tables-section">
                        {/* Group Selection Tab */}
                        <div className="group-tabs-container">
                          <div className="group-tabs">
                            <button
                              className={`group-tab ${selectedGroup === 1 ? 'active' : ''}`}
                              onClick={() => setSelectedGroup(1)}
                            >
                              Group 1
                            </button>
                            <button
                              className={`group-tab ${selectedGroup === 2 ? 'active' : ''}`}
                              onClick={() => setSelectedGroup(2)}
                            >
                              Group 2
                            </button>
                          </div>
                        </div>

                        {/* Group Tables */}
                        {data.groups
                          .filter(group => {
                            // Filter groups by selected tier and group
                            if (selectedTier === 1) {
                              // SuperStars: groups 1 and 2
                              if (selectedGroup === 1) return group.group_number === 1;
                              if (selectedGroup === 2) return group.group_number === 2;
                            } else if (selectedTier === 2) {
                              // RisingStars: groups 3 and 4
                              if (selectedGroup === 1) return group.group_number === 3;
                              if (selectedGroup === 2) return group.group_number === 4;
                            } else if (selectedTier === 3) {
                              // ShootingStars: groups 5 and 6
                              if (selectedGroup === 1) return group.group_number === 5;
                              if (selectedGroup === 2) return group.group_number === 6;
                            }
                            return false;
                          })
                          .map((group) => (
                            <div key={group.id} className="group-table-container">
                              <h4 className="group-table-title">
                                {group.group_number === 1 || group.group_number === 2 ? 'SuperStars' : 
                                 group.group_number === 3 || group.group_number === 4 ? 'RisingStars' : 'ShootingStars'} - 
                                Group {selectedGroup}
                              </h4>
                              <table className="group-table">
                                <thead>
                                  <tr>
                                    <th></th>
                                    <th className="blue th-small">Results</th>
                                    <th className="green">Won</th>
                                    <th className="pink th-small">Total points</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.players.map((player, idx) => {
                                    const qualifierClass = idx < 2 ? 'qualifier' : idx < 4 ? 'B-qualifier' : idx < 6 ? 'C-qualifier' : '';
                                    return (
                                      <tr key={player.id} className={qualifierClass}>
                                        <td>
                                          <a 
                                            href={`/profile/${player.profile_url}`}
                                            style={{ 
                                              color: player.chat_color || '#71bbe9',
                                              textShadow: player.chat_color === '#71bbe9' 
                                                ? '2px 2px 6px rgb(38, 76, 146), -2px -2px 6px rgb(38, 76, 146), 2px -2px 6px rgb(38, 76, 146), -2px 2px 6px rgb(38, 76, 146)'
                                                : 'none'
                                            }}
                                          >
                                            {player.display_name}
                                          </a>
                                        </td>
                                        <td>{player.group_games_played || 0}</td>
                                        <td>{player.wins || 0}</td>
                                        <td>{player.score_total || 0}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Matches */}
                    <div className="matches-container">
                      {roundMatches.map((match) => {
                        const isCurrentUserPlayer1 = user && match.player_1 && user.id === match.player_1.id;
                        const isCurrentUserPlayer2 = user && match.player_2 && user.id === match.player_2.id;
                        const bothPlayed = match.player_1_played && match.player_2_played;
                        const onlyPlayer1Played = match.player_1_played && !match.player_2_played;
                        const onlyPlayer2Played = !match.player_1_played && match.player_2_played;
                        
                        return (
                          <div key={match.id} className="match-container">
                            <div className="match-players">
                              {match.player_1 && (() => {
                                const chatColor = (match.player_1.chat_color && match.player_1.chat_color !== '#71bbe9') ? match.player_1.chat_color : '#71bbe9';
                                const isGlowWorm = chatColor === '#71bbe9';
                                
                                // Determine what to show for player 1
                                let player1Display: React.ReactElement | null = null;
                                if (!match.player_1_played) {
                                  // Player hasn't played
                                  if (isCurrentUserPlayer1) {
                                    // Show play button for current user
                                    player1Display = (
                                      <button className="play-button blue">
                                        Play
                                      </button>
                                    );
                                  } else {
                                    // Show pending for other players
                                    player1Display = (
                                      <span className="match-status">pending</span>
                                    );
                                  }
                                } else if (onlyPlayer1Played) {
                                  // Only player 1 has played
                                  if (isCurrentUserPlayer1 && match.result && typeof match.result.score_player_1 === 'number') {
                                    // Show result for current user
                                    player1Display = (
                                      <span 
                                        className="match-score"
                                        style={{
                                          color: match.result.winner?.id === match.player_1.id ? '#33c15b' : '#ff5596'
                                        }}
                                      >
                                        {match.result.score_player_1}
                                      </span>
                                    );
                                  } else {
                                    // Show "played" for other players
                                    player1Display = (
                                      <span className="match-status">played</span>
                                    );
                                  }
                                } else if (bothPlayed && match.result && typeof match.result.score_player_1 === 'number') {
                                  // Both played, show result
                                  player1Display = (
                                    <span 
                                      className="match-score"
                                      style={{
                                        color: match.result.winner?.id === match.player_1.id ? '#33c15b' : '#ff5596'
                                      }}
                                    >
                                      {match.result.score_player_1}
                                    </span>
                                  );
                                }
                                
                                return (
                                  <div className="match-player">
                                    <a 
                                      href={`/profile/${match.player_1.profile_url}`}
                                      className="player-link"
                                      style={{
                                        color: chatColor,
                                        textShadow: isGlowWorm
                                          ? '2px 2px 6px rgb(38, 76, 146), -2px -2px 6px rgb(38, 76, 146), 2px -2px 6px rgb(38, 76, 146), -2px 2px 6px rgb(38, 76, 146)'
                                          : 'none'
                                      }}
                                    >
                                      {match.player_1.display_name}
                                    </a>
                                    {player1Display}
                                  </div>
                                );
                              })()}
                              {match.player_2 && (() => {
                                const chatColor = (match.player_2.chat_color && match.player_2.chat_color !== '#71bbe9') ? match.player_2.chat_color : '#71bbe9';
                                const isGlowWorm = chatColor === '#71bbe9';
                                
                                // Determine what to show for player 2
                                let player2Display: React.ReactElement | null = null;
                                if (!match.player_2_played) {
                                  // Player hasn't played
                                  if (isCurrentUserPlayer2) {
                                    // Show play button for current user
                                    player2Display = (
                                      <button className="play-button blue">
                                        Play
                                      </button>
                                    );
                                  } else {
                                    // Show pending for other players
                                    player2Display = (
                                      <span className="match-status">pending</span>
                                    );
                                  }
                                } else if (onlyPlayer2Played) {
                                  // Only player 2 has played
                                  if (isCurrentUserPlayer2 && match.result && typeof match.result.score_player_2 === 'number') {
                                    // Show result for current user
                                    player2Display = (
                                      <span 
                                        className="match-score"
                                        style={{
                                          color: match.result.winner?.id === match.player_2.id ? '#33c15b' : '#ff5596'
                                        }}
                                      >
                                        {match.result.score_player_2}
                                      </span>
                                    );
                                  } else {
                                    // Show "played" for other players
                                    player2Display = (
                                      <span className="match-status">played</span>
                                    );
                                  }
                                } else if (bothPlayed && match.result && typeof match.result.score_player_2 === 'number') {
                                  // Both played, show result
                                  player2Display = (
                                    <span 
                                      className="match-score"
                                      style={{
                                        color: match.result.winner?.id === match.player_2.id ? '#33c15b' : '#ff5596'
                                      }}
                                    >
                                      {match.result.score_player_2}
                                    </span>
                                  );
                                }
                                
                                return (
                                  <div className="match-player">
                                    <a 
                                      href={`/profile/${match.player_2.profile_url}`}
                                      className="player-link"
                                      style={{
                                        color: chatColor,
                                        textShadow: isGlowWorm
                                          ? '2px 2px 6px rgb(38, 76, 146), -2px -2px 6px rgb(38, 76, 146), 2px -2px 6px rgb(38, 76, 146), -2px 2px 6px rgb(38, 76, 146)'
                                          : 'none'
                                      }}
                                    >
                                      {match.player_2.display_name}
                                    </a>
                                    {player2Display}
                                  </div>
                                );
                              })()}
                            </div>
                          {match.player_1_played && match.player_2_played && match.result && (
                            <div className="match-actions">
                              <a href={`/tournament/match/${match.id}`} className="view-results-button blue">
                                View Results
                              </a>
                            </div>
                          )}
                          {match.closed && match.result && (
                            <div className="match-result">
                              Winner: {match.result.winner?.display_name}
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
        {(tournament.champion || tournament.champion_2 || tournament.champion_3) && (
          <div className="champions-section">
            {tournament.champion && (
              <div className="champion-section champion-superstars">
                <h3 className="champion-tier blue">SuperStars</h3>
                <h2 className="champion-title blue">Champion: {tournament.champion.display_name}</h2>
              </div>
            )}
            {tournament.champion_2 && (
              <div className="champion-section champion-risingstars">
                <h3 className="champion-tier yellow">RisingStars</h3>
                <h2 className="champion-title yellow">Champion: {tournament.champion_2.display_name}</h2>
              </div>
            )}
            {tournament.champion_3 && (
              <div className="champion-section champion-shootingstars">
                <h3 className="champion-tier pink">ShootingStars</h3>
                <h2 className="champion-title pink">Champion: {tournament.champion_3.display_name}</h2>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rules Modal - rendered via portal to escape stacking context */}
      {rulesModalOpen && createPortal(
        <div className="tournament-rules-modal-overlay" onClick={() => setRulesModalOpen(false)}>
          <div className="tournament-rules-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="tournament-rules-modal-header">
              <h2 className="tournament-rules-modal-title">Tournament Rules and Info</h2>
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
        </div>,
        document.body
      )}
    </div>
  );
};

export default TournamentPage;

