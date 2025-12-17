import React, { useState } from 'react';
import { lobbyAPI } from '../../../services/api';
import { toast } from 'react-toastify';

interface PollProps {
  poll: {
    id: number;
    question: string;
    options: Array<{ value: string; percentage: number }>;
    total_votes: number;
    user_vote: number | null;
    discussion_link: string;
  };
}

const Poll: React.FC<PollProps> = ({ poll: initialPoll }) => {
  const [poll, setPoll] = useState(initialPoll);
  const [voting, setVoting] = useState(false);

  const handleVote = async (optionNo: number) => {
    if (poll.user_vote !== null || voting) {
      return;
    }

    setVoting(true);
    try {
      const result = await lobbyAPI.votePoll(optionNo);
      setPoll({
        ...poll,
        options: result.poll_options,
        total_votes: result.total_votes,
        user_vote: optionNo,
      });
      toast.success('Vote submitted!');
    } catch (error: any) {
      console.error('Failed to vote:', error);
      toast.error(error.response?.data?.error || 'Failed to submit vote');
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="blue-border" id="poll-container">
      <div className="row collapse show" id="poll-details-collapse">
        <p id="poll-question-container">
          <span id="poll-question">
            <span className="poll-prefix">Poll:&nbsp;</span>
            <span className="green">{poll.question}</span>
          </span>
        </p>
        {poll.user_vote !== null ? (
          <>
            {poll.options.map((option, index) => {
              if (!option.value) return null;
              return (
                <div key={index}>
                  <div className="progress" style={{ display: 'inline-block', width: '100%' }}>
                    <div
                      className="progress-bar custom-progress-bar"
                      style={{ width: `${option.percentage}%` }}
                      role="progressbar"
                    >
                      {option.percentage}%
                    </div>
                  </div>
                  <p className="poll-option">{option.value}</p>
                </div>
              );
            })}
            <span id="total-votes">
              Total Votes: {poll.total_votes}
              {poll.discussion_link && (
                <>
                  <span className="green"> Discuss</span>
                  <a
                    style={{ textDecoration: 'underline' }}
                    className="yellow"
                    href={poll.discussion_link}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {' '}here
                  </a>
                </>
              )}
            </span>
          </>
        ) : (
          <div id="options-container">
            {poll.options.map((option, index) => {
              if (!option.value) return null;
              return (
                <React.Fragment key={index}>
                  <button
                    className="poll-button"
                    onClick={() => handleVote(index + 1)}
                    disabled={voting}
                  >
                    {option.value}
                  </button>
                  <br />
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Poll;

