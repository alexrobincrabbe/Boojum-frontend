import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { lobbyAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Loading } from '../../components/Loading';
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
  custom?: boolean;
  created_by?: string;
  created_by_username?: string;
  visibility?: string;
}

interface WordOfTheDay {
  word: string;
  definition: string;
  day: string;
}

const LobbyPage = () => {
  const [adminRooms, setAdminRooms] = useState<Room[]>([]);
  const [customRooms, setCustomRooms] = useState<Room[]>([]);
  const [wordOfTheDay, setWordOfTheDay] = useState<WordOfTheDay | null>(null);
  const [roomUsers, setRoomUsers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const roomUsersPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial lobby data
  useEffect(() => {
    const loadLobbyData = async () => {
      try {
        const data = await lobbyAPI.getLobbyData();
        setAdminRooms(data.admin_rooms || []);
        setCustomRooms(data.custom_rooms || []);
        setWordOfTheDay(data.word_of_the_day || null);
      } catch (error: any) {
        toast.error('Failed to load lobby data');
        console.error('Error loading lobby data:', error);
      } finally {
        setLoading(false);
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


  const getRoomType = (room: Room) => {
    if (room.guest) return 'Short Game';
    if (room.bonus) return 'Bonus Letters';
    if (room.timer === 180) return 'Long Game';
    if (room.one_shot) return 'One Word';
    return '';
  };

  const getGameTypeForLeaderboard = (room: Room): string => {
    if (room.one_shot) return 'one_shot';
    if (room.bonus) return 'bonus';
    if (room.timer === 180) return 'long_game';
    return 'normal';
  };

  if (loading) {
    return <Loading minHeight="calc(100vh - 70px)" />;
  }

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
            <div className="rooms-list">
              {/* Admin-created rooms */}
              {adminRooms.map((room) => (
                <div key={room.room_id} className="room-card-wrapper">
                  <Link
                    to={`/rooms/guest/${room.room_slug}/`}
                    className="room-link"
                  >
                    <div className="room-card" style={{ borderColor: room.color }}>
                      <h2 className="room-title" style={{ color: room.color }}>
                        {room.room_name}
                        <span className="room-playing">
                          <strong>Playing:</strong>{' '}
                          <span 
                            className={`room-user-count ${(roomUsers[room.room_slug] || 0) === 0 ? 'zero' : 'greater-than-zero'}`}
                          >
                            {roomUsers[room.room_slug] || 0}
                          </span>
                        </span>
                      </h2>
                      <div className="room-details">
                        {(() => {
                          const roomType = getRoomType(room);
                          return roomType === 'Bonus Letters' || roomType === 'One Word' ? (
                            <span className="room-rules">{roomType}</span>
                          ) : null;
                        })()}
                        <span className="duration">{room.timer} seconds</span>
                      </div>
                    </div>
                  </Link>
                  <Link
                    to={`/leaderboards?gameType=${getGameTypeForLeaderboard(room)}&period=weekly`}
                    className="room-highscores-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    High Scores
                  </Link>
                </div>
              ))}
              
              {/* Custom rooms section */}
              {customRooms.length > 0 && (
                <>
                  <div className="custom-rooms-header">
                    <h3>Custom Rooms</h3>
                  </div>
                  {customRooms.map((room) => (
                    <div key={room.room_id} className="room-card-wrapper">
                      <Link
                        to={`/rooms/guest/${room.room_slug}/`}
                        className="room-link"
                      >
                        <div className="room-card" style={{ borderColor: room.color }}>
                          <h2 className="room-title" style={{ color: room.color }}>
                            {room.room_name}
                            <span className="room-playing">
                              <strong>Playing:</strong>{' '}
                              <span 
                                className={`room-user-count ${(roomUsers[room.room_slug] || 0) === 0 ? 'zero' : 'greater-than-zero'}`}
                              >
                                {roomUsers[room.room_slug] || 0}
                              </span>
                            </span>
                          </h2>
                          <div className="room-details">
                            {(() => {
                              const roomType = getRoomType(room);
                              return roomType === 'Bonus Letters' || roomType === 'One Word' ? (
                                <span className="room-rules">{roomType}</span>
                              ) : null;
                            })()}
                            <span className="duration">{room.timer} seconds</span>
                          </div>
                        </div>
                      </Link>
                      <div className="custom-room-info">
                        {room.created_by && (
                          <div className="custom-room-owner">
                            <strong>Owner:</strong> {room.created_by}
                          </div>
                        )}
                        {room.visibility && (
                          <div className="custom-room-visibility">
                            <strong>Visibility:</strong> {room.visibility === 'public' ? 'Public' : 'Playmates Only'}
                          </div>
                        )}
                        {room.description && (
                          <div className="custom-room-description">
                            {room.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LobbyPage;

