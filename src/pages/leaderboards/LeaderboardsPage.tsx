import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { leaderboardsAPI } from '../../services/api';
import { ProfilePicture } from '../../components/ProfilePicture';
import { Username } from '../../components/Username';
import { Loading } from '../../components/Loading';
import './LeaderboardsPage.css';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  display_name: string;
  profile_url: string;
  profile_picture_url: string | null;
  chat_color: string;
  high_score?: number;
  best_word?: string;
  best_word_score?: number;
  most_words?: number;
  time?: number;
  unicorn?: boolean;
}

interface LeaderboardData {
  game_type: string;
  period: string;
  one_shot: boolean;
  high_score_list?: LeaderboardEntry[];
  best_word_list?: LeaderboardEntry[];
  most_words_list?: LeaderboardEntry[];
  one_shot_list_normal?: LeaderboardEntry[];
  one_shot_list_bonus?: LeaderboardEntry[];
}

type AllLeaderboardsData = {
  [gameType: string]: {
    [period: string]: LeaderboardData;
  };
};

const LeaderboardsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gameType, setGameType] = useState(searchParams.get('gameType') || 'normal');
  const [period, setPeriod] = useState(searchParams.get('period') || 'weekly');
  const [allData, setAllData] = useState<AllLeaderboardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllLeaderboards();
  }, []);

  const loadAllLeaderboards = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await leaderboardsAPI.getAllLeaderboards();
      setAllData(response);
      // Update URL params
      setSearchParams({ gameType, period });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load leaderboards');
      console.error('Failed to load leaderboards:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGameTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newGameType = e.target.value;
    setGameType(newGameType);
    setSearchParams({ gameType: newGameType, period });
  };

  const handlePeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPeriod = e.target.value;
    setPeriod(newPeriod);
    setSearchParams({ gameType, period: newPeriod });
  };

  // Get current data from allData
  const data: LeaderboardData | null = allData?.[gameType]?.[period] || null;

  // Get the color for the selected game mode
  const getGameModeColor = (mode: string): string => {
    switch (mode) {
      case 'normal':
        return 'var(--color-yellow)';
      case 'long_game':
        return 'var(--color-purple)';
      case 'bonus':
        return 'var(--color-pink)';
      case 'one_shot':
        return 'var(--color-green)';
      default:
        return 'var(--color-yellow)';
    }
  };

  const getRankClass = (rank: number): string => {
    if (rank === 1) return 'bw-rank label rank-1';
    if (rank === 2) return 'bw-rank label rank-2';
    if (rank === 3) return 'bw-rank label rank-3';
    return 'bw-rank label';
  };

  const getRankStyle = (_rank: number): React.CSSProperties => {
    return { fontWeight: 'bold' };
  };

  const renderOneShotTables = () => {
    if (!data?.one_shot_list_normal || !data?.one_shot_list_bonus) return null;

    return (
      <div className="row">
        <div className="col-lg-6">
          <div className="table-container">
            <h5 className="blue">Normal</h5>
            <div className="leaderboard_table_container yellow-border">
              <table className="leaderboard_table">
                <tbody>
                  {data.one_shot_list_normal.map((score) => (
                    <tr key={score.user_id}>
                      <td>
                        <div className={getRankClass(score.rank)} style={getRankStyle(score.rank)}>
                          {score.rank}
                        </div>
                      </td>
                      <td>
                        <ProfilePicture
                          profilePictureUrl={score.profile_picture_url}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                          size={30}
                        />
                      </td>
                      <td className="player-name">
                        <Username
                          username={score.display_name}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                        />
                      </td>
                      <td className={`word ${score.unicorn ? 'pink' : ''}`}>
                        <span className="best-word">{score.best_word}</span>
                        <span className="leaderboard-best-word-score">{score.best_word_score}pts</span>
                      </td>
                      <td>
                        <span className="one-shot-time blue">{score.time}s</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="table-container">
            <h5 className="blue">Bonus</h5>
            <div className="leaderboard_table_container pink-border">
              <table className="leaderboard_table">
                <tbody>
                  {data.one_shot_list_bonus.map((score) => (
                    <tr key={score.user_id}>
                      <td>
                        <div className={getRankClass(score.rank)} style={getRankStyle(score.rank)}>
                          {score.rank}
                        </div>
                      </td>
                      <td>
                        <ProfilePicture
                          profilePictureUrl={score.profile_picture_url}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                          size={30}
                        />
                      </td>
                      <td className="player-name">
                        <Username
                          username={score.display_name}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                        />
                      </td>
                      <td className={`word ${score.unicorn ? 'pink' : ''}`}>
                        <span className="best-word">{score.best_word}</span>
                        <span className="leaderboard-best-word-score">{score.best_word_score}pts</span>
                      </td>
                      <td>
                        <span className="one-shot-time blue">{score.time}s</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRegularTables = () => {
    if (!data?.high_score_list || !data?.best_word_list || !data?.most_words_list) return null;

    return (
      <div className="row">
        <div className="col-lg-4">
          <div className="table-container">
            <h5 className="blue">High Score</h5>
            <div className="leaderboard_table_container yellow-border">
              <table className="leaderboard_table">
                <tbody>
                  {data.high_score_list.map((score) => (
                    <tr key={score.user_id}>
                      <td>
                        <div className={getRankClass(score.rank)} style={getRankStyle(score.rank)}>
                          {score.rank}
                        </div>
                      </td>
                      <td>
                        <ProfilePicture
                          profilePictureUrl={score.profile_picture_url}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                          size={30}
                        />
                      </td>
                      <td className="player-name">
                        <Username
                          username={score.display_name}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                        />
                      </td>
                      <td className="number">{score.high_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="table-container">
            <h5 className="blue">Best Word</h5>
            <div className="leaderboard_table_container pink-border">
              <table className="leaderboard_table">
                <tbody>
                  {data.best_word_list.map((score) => (
                    <tr key={score.user_id}>
                      <td>
                        <div className={getRankClass(score.rank)} style={getRankStyle(score.rank)}>
                          {score.rank}
                        </div>
                      </td>
                      <td>
                        <ProfilePicture
                          profilePictureUrl={score.profile_picture_url}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                          size={30}
                        />
                      </td>
                      <td className="player-name">
                        <Username
                          username={score.display_name}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                        />
                      </td>
                      <td>
                        <span className="best-word">{score.best_word}</span>
                        <span className="leaderboard-best-word-score">{score.best_word_score}pts</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="table-container">
            <h5 className="blue">Most Words</h5>
            <div className="leaderboard_table_container green-border">
              <table className="leaderboard_table">
                <tbody>
                  {data.most_words_list.map((score) => (
                    <tr key={score.user_id}>
                      <td>
                        <div className={getRankClass(score.rank)} style={getRankStyle(score.rank)}>
                          {score.rank}
                        </div>
                      </td>
                      <td>
                        <ProfilePicture
                          profilePictureUrl={score.profile_picture_url}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                          size={30}
                        />
                      </td>
                      <td className="player-name">
                        <Username
                          username={score.display_name}
                          profileUrl={score.profile_url}
                          chatColor={score.chat_color}
                        />
                      </td>
                      <td className="number">{score.most_words}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid leaderboards-page">
      <div className="leaderboard-selectors">
        <div className="selector-group">
          <select
            id="gameMode"
            className="green-border"
            value={gameType}
            onChange={handleGameTypeChange}
            style={{ color: getGameModeColor(gameType) }}
          >
            <option value="normal">LookingGlass</option>
            <option value="long_game">Forever</option>
            <option value="bonus">Boojum</option>
            <option value="one_shot">Unicorn</option>
          </select>
        </div>
        <div className="selector-group">
          <select
            id="leaderboardType"
            className="yellow-border"
            value={period}
            onChange={handlePeriodChange}
          >
            <option value="all-time">All-Time</option>
            <option value="weekly">This Week</option>
            <option value="last-week">Last Week</option>
            <option value="monthly">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="yearly">This Year</option>
            <option value="last-year">Last Year</option>
          </select>
        </div>
      </div>
      <div id="leaderboard-wrapper" style={{ position: 'relative' }}>
        {loading && <Loading minHeight="calc(100vh - 70px)" />}
        {error && (
          <div className="error-message" style={{ color: 'red', textAlign: 'center', padding: '20px' }}>
            {error}
          </div>
        )}
        {!loading && !error && data && (
          <div id="leaderboard-content">
            {data.one_shot ? renderOneShotTables() : renderRegularTables()}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardsPage;
