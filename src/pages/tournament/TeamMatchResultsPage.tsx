import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { teamTournamentAPI } from '../../services/api';
import { Loading } from '../../components/Loading';
import { TeamWordLists } from './components/TeamWordLists';
import { useBoardTheme } from '../../contexts/BoardThemeContext';
import { toast } from 'react-toastify';
import '../game-room/GameRoom.css';
import './MatchResultsPage.css';

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

interface MatchDetails {
  match: {
    id: number;
    round: number;
    team_1: Team;
    team_2: Team;
  };
  result: {
    team_1_score: number;
    team_2_score: number;
    winner_team: {
      id: number;
      name: string;
    } | null;
  };
  board: {
    letters: string[][];
    words: string[];
    boojum_bonus: number[][] | null;
  };
  board_words_by_length: Record<string, Array<{
    word: string;
    team_1_found: boolean;
    team_1_count: number;
    team_1_type: 'single' | 'double' | 'triple' | null;
    team_2_found: boolean;
    team_2_count: number;
    team_2_type: 'single' | 'double' | 'triple' | null;
    players_found: (number | null)[];
  }>>;
  score_summary: {
    team_1: {
      total: number;
      singles: number;
      doubles: number;
      triples: number;
      players: Array<{
        name: string;
        score: number;
      }>;
    };
    team_2: {
      total: number;
      singles: number;
      doubles: number;
      triples: number;
      players: Array<{
        name: string;
        score: number;
      }>;
    };
  };
}

export default function TeamMatchResultsPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [data, setData] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<'team_1' | 'team_2' | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<number>>(new Set());
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { darkMode } = useBoardTheme();

  // Initialize with team_1 selected and all its players selected by default
  useEffect(() => {
    if (data && !selectedTeam) {
      setSelectedTeam('team_1');
      setSelectedPlayerIds(new Set([
        data.match.team_1.player_1.id,
        data.match.team_1.player_2.id,
        data.match.team_1.player_3.id,
      ]));
    }
  }, [data, selectedTeam]);

  useEffect(() => {
    const loadMatchDetails = async () => {
      if (!matchId) {
        setError('Match ID is required');
        setLoading(false);
        return;
      }

      try {
        const matchData = await teamTournamentAPI.getTeamMatchDetails(parseInt(matchId));
        setData(matchData);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: string } } };
        setError(error.response?.data?.error || 'Failed to load match details');
        console.error('Error loading match details:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMatchDetails();
  }, [matchId]);



  // Toggle team filter
  const toggleTeamFilter = (team: 'team_1' | 'team_2', e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (selectedTeam === team) {
      // Deselect team
      setSelectedTeam(null);
      setSelectedPlayerIds(new Set());
      toast.info('Team filter cleared');
    } else {
      // Select new team - automatically select all players from that team
      setSelectedTeam(team);
      if (data) {
        const teamPlayers = team === 'team_1' 
          ? [data.match.team_1.player_1.id, data.match.team_1.player_2.id, data.match.team_1.player_3.id]
          : [data.match.team_2.player_1.id, data.match.team_2.player_2.id, data.match.team_2.player_3.id];
        setSelectedPlayerIds(new Set(teamPlayers));
        toast.success(`Filtering by ${team === 'team_1' ? data.match.team_1.name : data.match.team_2.name} - all players selected`);
      }
    }
  };

  // Toggle player in filter (only works if team is selected)
  const togglePlayerFilter = (playerId: number, team: 'team_1' | 'team_2', e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    // Only allow filtering if team is selected and player is from that team
    if (!selectedTeam || selectedTeam !== team) {
      toast.info('Please select a team first');
      return;
    }
    
    // Clear any pending toast
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    
    const wasSelected = selectedPlayerIds.has(playerId);
    const player = data ? [
      data.match.team_1.player_1,
      data.match.team_1.player_2,
      data.match.team_1.player_3,
      data.match.team_2.player_1,
      data.match.team_2.player_2,
      data.match.team_2.player_3,
    ].find(p => p.id === playerId) : null;
    const playerName = player?.display_name || 'Player';
    
    setSelectedPlayerIds(prev => {
      const newSet = new Set(prev);
      if (wasSelected) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
    
    // Show toast after state update
    toastTimeoutRef.current = setTimeout(() => {
      if (wasSelected) {
        toast.info(`Removed ${playerName} from filter`);
      } else {
        toast.success(`Added ${playerName} to filter`);
      }
      toastTimeoutRef.current = null;
    }, 0);
  };

  // Use all words (no length filter)
  const filteredWordsByLength = data?.board_words_by_length || {};

  if (loading) {
    return <Loading minHeight="calc(100vh - 70px)" />;
  }

  if (error || !data) {
    return (
      <div className="match-results-container">
        <div className="error-message">{error || 'Match not found'}</div>
      </div>
    );
  }

  const { match, result, score_summary } = data;

  return (
    <div className="match-results-container">
      <div className="match-header">
        <h2>Round {match.round}</h2>
        <div className="match-teams">
          <div className="team-section">
            <h3>{match.team_1.name}</h3>
            <div className="team-players">
              {[match.team_1.player_1, match.team_1.player_2, match.team_1.player_3].map((player) => (
                <Link
                  key={player.id}
                  to={`/profile/${player.profile_url}`}
                  className="player-link"
                  style={{ color: player.chat_color || '#71bbe9' }}
                >
                  {player.display_name}
                </Link>
              ))}
            </div>
            <div className="team-score">{result.team_1_score}</div>
          </div>
          <div className="vs-divider">vs</div>
          <div className="team-section">
            <h3>{match.team_2.name}</h3>
            <div className="team-players">
              {[match.team_2.player_1, match.team_2.player_2, match.team_2.player_3].map((player) => (
                <Link
                  key={player.id}
                  to={`/profile/${player.profile_url}`}
                  className="player-link"
                  style={{ color: player.chat_color || '#71bbe9' }}
                >
                  {player.display_name}
                </Link>
              ))}
            </div>
            <div className="team-score">{result.team_2_score}</div>
          </div>
        </div>
        {result.winner_team && (
          <div className="winner-announcement">
            Winner: {result.winner_team.name}
          </div>
        )}
      </div>

      {/* Score Summary */}
      <div className="score-summary-section">
        <h3>Score Summary</h3>
        <div className="score-summary-grid">
          <div className="team-summary">
            <h4>{match.team_1.name}</h4>
            <div className="score-breakdown">
              <div className="score-item">
                <span className="score-label green">Singles:</span>
                <span className="score-value">{score_summary.team_1.singles}</span>
              </div>
              <div className="score-item">
                <span className="score-label yellow">Doubles:</span>
                <span className="score-value">{score_summary.team_1.doubles}</span>
              </div>
              <div className="score-item">
                <span className="score-label pink">Triples:</span>
                <span className="score-value">{score_summary.team_1.triples}</span>
              </div>
              <div className="score-item">
                <span className="score-label blue">Total:</span>
                <span className="score-value">{score_summary.team_1.total}</span>
              </div>
            </div>
            <div className="player-scores">
              {score_summary.team_1.players.map((player, idx) => (
                <div key={idx} className="player-score-item">
                  {player.name}: {player.score} pts
                </div>
              ))}
            </div>
          </div>
          <div className="team-summary">
            <h4>{match.team_2.name}</h4>
            <div className="score-breakdown">
              <div className="score-item">
                <span className="score-label green">Singles:</span>
                <span className="score-value">{score_summary.team_2.singles}</span>
              </div>
              <div className="score-item">
                <span className="score-label yellow">Doubles:</span>
                <span className="score-value">{score_summary.team_2.doubles}</span>
              </div>
              <div className="score-item">
                <span className="score-label pink">Triples:</span>
                <span className="score-value">{score_summary.team_2.triples}</span>
              </div>
              <div className="score-item">
                <span className="score-label blue">Total:</span>
                <span className="score-value">{score_summary.team_2.total}</span>
              </div>
            </div>
            <div className="player-scores">
              {score_summary.team_2.players.map((player, idx) => (
                <div key={idx} className="player-score-item">
                  {player.name}: {player.score} pts
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Board Display */}
      {data.board && data.board.letters && (
        <div className="board-container">
          <h3 className="board-title">Game Board</h3>
          <div className="board-display-container">
            <div className="board-wrapper">
              <div 
                id="board" 
                className={`board ${darkMode ? 'board-dark' : 'board-light'}`}
              >
                {Array.from({ length: 16 }, (_, i) => {
                  const row = Math.floor(i / 4);
                  const col = i % 4;
                  const letter = data.board.letters?.[row]?.[col] || '';
                  // boojum is a 2D array: [[0,0,0,0], [0,0,0,0], [0,0,0,0], [0,0,0,0]]
                  // Values: 0 = no bonus, 1 = snark (doubles letter), 2 = boojum (doubles word)
                  let bonusValue = 0;
                  if (data.board.boojum_bonus && Array.isArray(data.board.boojum_bonus) && data.board.boojum_bonus[row]) {
                    bonusValue = data.board.boojum_bonus[row][col] || 0;
                  }
                  const isSnark = bonusValue === 1;
                  const isBoojum = bonusValue === 2;
                  
                  return (
                    <div 
                      key={i} 
                      className={`letter ${darkMode ? 'dark-mode' : 'light-mode'} ${isSnark ? 'snark' : ''} ${isBoojum ? 'boojum' : ''}`}
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
          </div>
        </div>
      )}

      {/* Team and Player Filter */}
      <div className="player-filter-section">
        <h3>Filter by Team and Players</h3>
        <div className="player-filter-instructions">
          <p>First select a team, then select players from that team to filter word color coding.</p>
        </div>
        
        {/* Team Filter Buttons */}
        <div className="team-filter-buttons">
          <button
            className={`team-filter-button ${selectedTeam === 'team_1' ? 'selected' : ''}`}
            onClick={(e) => toggleTeamFilter('team_1', e)}
          >
            {match.team_1.name}
          </button>
          <button
            className={`team-filter-button ${selectedTeam === 'team_2' ? 'selected' : ''}`}
            onClick={(e) => toggleTeamFilter('team_2', e)}
          >
            {match.team_2.name}
          </button>
        </div>

        {/* Player Filter - Only show players from selected team */}
        {selectedTeam && (
          <div className="player-filter-list">
            {(selectedTeam === 'team_1' ? [
              { player: match.team_1.player_1, team: 'team_1' },
              { player: match.team_1.player_2, team: 'team_1' },
              { player: match.team_1.player_3, team: 'team_1' },
            ] : [
              { player: match.team_2.player_1, team: 'team_2' },
              { player: match.team_2.player_2, team: 'team_2' },
              { player: match.team_2.player_3, team: 'team_2' },
            ]).map(({ player, team }) => (
              <div
                key={player.id}
                className={`player-filter-item ${selectedPlayerIds.has(player.id) ? 'selected' : ''}`}
                onClick={(e) => togglePlayerFilter(player.id, team as 'team_1' | 'team_2', e)}
                style={{ 
                  cursor: 'pointer',
                  borderColor: selectedPlayerIds.has(player.id) ? (player.chat_color || '#71bbe9') : 'transparent',
                  backgroundColor: selectedPlayerIds.has(player.id) ? `rgba(${player.chat_color ? '113, 187, 233' : '113, 187, 233'}, 0.3)` : 'rgba(0, 0, 0, 0.3)'
                }}
              >
                <span
                  style={{ color: player.chat_color || '#71bbe9', fontWeight: 'bold' }}
                >
                  {player.display_name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Filter Status Banner */}
        {selectedTeam && selectedPlayerIds.size > 0 && (
          <div className="player-filter-banner">
            <span className="filter-label">Filtered by:</span>
            <span className="filtered-team-name">{selectedTeam === 'team_1' ? match.team_1.name : match.team_2.name}</span>
            {Array.from(selectedPlayerIds).map(playerId => {
              const player = [
                match.team_1.player_1,
                match.team_1.player_2,
                match.team_1.player_3,
                match.team_2.player_1,
                match.team_2.player_2,
                match.team_2.player_3,
              ].find(p => p.id === playerId);
              return player ? (
                <span 
                  key={playerId} 
                  className="filtered-player-name" 
                  style={{ color: player.chat_color }}
                  onClick={(e) => togglePlayerFilter(playerId, selectedTeam, e)}
                >
                  {player.display_name}
                </span>
              ) : null;
            })}
            <button
              className="clear-filter-btn"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTeam(null);
                setSelectedPlayerIds(new Set());
                toast.info('Filter cleared');
              }}
            >
              Clear Filter
            </button>
          </div>
        )}
        {selectedTeam && selectedPlayerIds.size === 0 && (
          <div className="player-filter-banner">
            <span className="filter-label">No players selected</span>
            <span className="filter-hint">Select players from {selectedTeam === 'team_1' ? match.team_1.name : match.team_2.name} to see highlights</span>
          </div>
        )}
        {!selectedTeam && (
          <div className="player-filter-banner">
            <span className="filter-label">No team selected</span>
            <span className="filter-hint">Select a team to filter by players</span>
          </div>
        )}
      </div>

      <div className="word-lists-section">
        <TeamWordLists
          wordsByLength={filteredWordsByLength}
          team1Name={match.team_1.name}
          team2Name={match.team_2.name}
          selectedPlayerIds={selectedPlayerIds}
          selectedTeam={selectedTeam}
          allPlayers={[
            { id: match.team_1.player_1.id, team: 'team_1', position: 'player_1' },
            { id: match.team_1.player_2.id, team: 'team_1', position: 'player_2' },
            { id: match.team_1.player_3.id, team: 'team_1', position: 'player_3' },
            { id: match.team_2.player_1.id, team: 'team_2', position: 'player_1' },
            { id: match.team_2.player_2.id, team: 'team_2', position: 'player_2' },
            { id: match.team_2.player_3.id, team: 'team_2', position: 'player_3' },
          ]}
          boojum={data.board.boojum_bonus ? (() => {
            // Extract boojum letter from boojum_bonus array
            for (let row = 0; row < 4; row++) {
              for (let col = 0; col < 4; col++) {
                if (data.board.boojum_bonus[row]?.[col] === 2) {
                  return data.board.letters[row]?.[col];
                }
              }
            }
            return undefined;
          })() : undefined}
          snark={data.board.boojum_bonus ? (() => {
            // Extract snark letter from boojum_bonus array
            for (let row = 0; row < 4; row++) {
              for (let col = 0; col < 4; col++) {
                if (data.board.boojum_bonus[row]?.[col] === 1) {
                  return data.board.letters[row]?.[col];
                }
              }
            }
            return undefined;
          })() : undefined}
        />
      </div>

    </div>
  );
}

