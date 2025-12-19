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
}

interface WordOfTheDay {
  word: string;
  definition: string;
  day: string;
}

const LobbyPage = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [wordOfTheDay, setWordOfTheDay] = useState<WordOfTheDay | null>(null);
  const [roomUsers, setRoomUsers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const roomUsersPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load initial lobby data
  useEffect(() => {
    const loadLobbyData = async () => {
      try {
        const data = await lobbyAPI.getLobbyData();
        setRooms(data.rooms || []);
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
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LobbyPage;

