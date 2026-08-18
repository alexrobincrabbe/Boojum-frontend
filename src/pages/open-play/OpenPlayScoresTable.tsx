import { ProfilePicture } from '../../components/ProfilePicture';
import { Username } from '../../components/Username';

export interface OpenPlayScoreRow {
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
  points_tier?: string;
}

interface OpenPlayScoresTableProps {
  scores: OpenPlayScoreRow[];
  showBestWord: boolean;
  onToggleBestWord: (e: React.MouseEvent) => void;
}

export function OpenPlayScoresTable({
  scores,
  showBestWord,
  onToggleBestWord,
}: OpenPlayScoresTableProps) {
  if (scores.length === 0) {
    return <div className="no-scores">No scores yet</div>;
  }

  return (
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
                onClick={onToggleBestWord}
              >
                {showBestWord ? 'Best Word' : 'Words'}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {scores.map((leader, index) => (
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
                    pointsTier={leader.points_tier}
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
  );
}
