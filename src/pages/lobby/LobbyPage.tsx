import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { lobbyAPI } from '../../services/api';
import { toast } from 'react-toastify';
import './LobbyPage.css';

interface Room {
  room_name: string;
  room_slug: string;
  users: number;
  timer: number;
  bonus: boolean;
  guest: boolean;
  room_id: number;
  description: string;
  visible: boolean;
  one_shot: boolean;
  color: string;
}

interface PollOption {
  value: string;
  percentage: number;
}

interface UserOnline {
  id: number;
  display_name: string;
  chat_color: string;
  profile_url: string;
  online: string;
  time_ago: string;
  playing: string;
  activity: string;
}

interface Poll {
  id: number;
  question: string;
  options: PollOption[];
  total_votes: number;
  user_vote: number | null;
  discussion_link: string;
}

interface WordOfTheDay {
  word: string;
  definition: string;
  day: string;
}

const LobbyPage = () => {
  const { isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [wordOfTheDay, setWordOfTheDay] = useState<WordOfTheDay | null>(null);
  const [roomUsers, setRoomUsers] = useState<Record<string, number>>({});
  const roomUsersPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial lobby data
  useEffect(() => {
    const loadLobbyData = async () => {
      try {
        const data = await lobbyAPI.getLobbyData();
        setRooms(data.rooms || []);
        setPoll(data.poll || null);
        setWordOfTheDay(data.word_of_the_day || null);
      } catch (error: any) {
        toast.error('Failed to load lobby data');
        console.error('Error loading lobby data:', error);
      }
    };

    loadLobbyData();
  }, []);

  // Load room users
  useEffect(() => {
    const loadRoomUsers = async () => {
      try {
        const data = await lobbyAPI.getRoomUsers();
        const roomUsersMap: Record<string, number> = {};
        data.rooms?.forEach((room: any) => {
          roomUsersMap[room.room_slug] = room.room_users;
        });
        setRoomUsers(roomUsersMap);
      } catch (error: any) {
        console.error('Error loading room users:', error);
      }
    };

    loadRoomUsers();
    roomUsersPollingIntervalRef.current = setInterval(loadRoomUsers, 5000); // Every 5 seconds

    return () => {
      if (roomUsersPollingIntervalRef.current) {
        clearInterval(roomUsersPollingIntervalRef.current);
      }
    };
  }, []);

  const handleVote = async (optionNo: number) => {
    if (!isAuthenticated) {
      toast.error('You must be logged in to vote');
      return;
    }

    try {
      const data = await lobbyAPI.votePoll(optionNo);
      setPoll({
        ...poll!,
        options: data.poll_options,
        total_votes: data.total_votes,
        user_vote: data.user_vote,
      });
      toast.success('Vote recorded!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to vote');
    }
  };

  const getRoomType = (room: Room) => {
    if (room.guest) return 'Short Game';
    if (room.bonus) return 'Bonus Letters';
    if (room.timer === 180) return 'Long Game';
    if (room.one_shot) return 'One Word';
    return '';
  };

  return (
    <div className="lobby-container">
      <div className="lobby-row">
        {/* Center Column - Rooms & Word of the Day */}
        <div className="lobby-col-center">
          {wordOfTheDay && (
            <div className="lobby-section wotd-section">
              <h3 id="word-of-the-day">{wordOfTheDay.word}:</h3>
              <p id="word-of-the-day-definition">{wordOfTheDay.definition}</p>
            </div>
          )}

          <div className="lobby-section rooms-section">
            <h2 className="rooms-title">Game Rooms</h2>
            <div className="rooms-list">
              {rooms.map((room) => (
                <Link
                  key={room.room_id}
                  to={`/rooms/guest/${room.room_slug}/`}
                  className="room-link"
                >
                  <div className="room-card" style={{ borderColor: room.color }}>
                    <h2 className="room-title" style={{ color: room.color }}>
                      {room.room_name}
                      <span className="room-playing">
                        <strong>Playing:</strong> {roomUsers[room.room_slug] || 0}
                      </span>
                    </h2>
                    <div className="room-details">
                      {getRoomType(room) && (
                        <span className="room-rules">{getRoomType(room)}</span>
                      )}
                      <span className="duration">{room.timer} seconds</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Poll */}
        <div className="lobby-col-right">
          {poll && (
            <div className="lobby-section poll-section">
              <h3 className="lobby-section-title">Poll</h3>
              <p className="poll-question">{poll.question}</p>
              <div className="poll-options">
                {poll.options.map((option, idx) => {
                  if (!option.value) return null;
                  const optionNo = idx + 1;
                  const isVoted = poll.user_vote === optionNo;
                  return (
                    <div key={idx} className="poll-option">
                      <button
                        className={`poll-option-button ${isVoted ? 'voted' : ''}`}
                        onClick={() => handleVote(optionNo)}
                        disabled={isVoted || !isAuthenticated}
                      >
                        {option.value}
                      </button>
                      {poll.total_votes > 0 && (
                        <div className="poll-bar-container">
                          <div
                            className="poll-bar"
                            style={{ width: `${option.percentage}%` }}
                          />
                          <span className="poll-percentage">{option.percentage}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {poll.total_votes > 0 && (
                <p className="poll-total">Total votes: {poll.total_votes}</p>
              )}
              {poll.discussion_link && (
                <a href={poll.discussion_link} target="_blank" rel="noopener noreferrer" className="poll-discussion-link">
                  Discussion
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;

