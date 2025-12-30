import { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { lobbyAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Loading } from '../../components/Loading';
import { usePageOnboarding } from '../../hooks/usePageOnboarding';
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

  // Page-specific onboarding steps - recalculate when data loads
  const lobbySteps = useMemo(() => {
    if (adminRooms.length === 0) {
      return [];
    }

    // Step 1: Describe the live games section
    const step1 = {
      target: '[data-onboarding="rooms-section"]',
      content: 'Welcome to the Live Games section! Here you can join active game rooms and play with other players in real-time.',
      placement: 'top' as const,
      disableScrolling: false,
    };

    // Steps 2-5: Describe different rooms and their rules
    // We'll create steps for up to 4 different room types
    const roomTypeSteps: any[] = [];
    const seenTypes = new Set<string>();

    adminRooms.forEach((room, index) => {
      if (roomTypeSteps.length >= 4) return; // Limit to 4 room steps

      let roomType = '';
      let roomDescription = '';
      
      if (room.guest) {
        roomType = 'Short Game';
        roomDescription = 'Short Game rooms have a 90-second timer - perfect for quick games!';
      } else if (room.bonus) {
        roomType = 'Bonus Letters';
        roomDescription = 'Bonus Letters rooms include special bonus letters that give extra points when used in words.';
      } else if (room.timer === 180) {
        roomType = 'Long Game';
        roomDescription = 'Long Game rooms have a 3-minute timer - more time to find longer words and higher scores!';
      } else if (room.one_shot) {
        roomType = 'One Word';
        roomDescription = 'The Unicorn room (One Word) allows players to submit only one word. The highest scoring word wins. If two players submit the same word, the fastest submission wins.';
      } else {
        roomType = 'Standard Game';
        roomDescription = 'Standard Game rooms have a 90-second timer with classic Boggle rules.';
      }

      // Only add one step per room type
      if (!seenTypes.has(roomType)) {
        seenTypes.add(roomType);
        roomTypeSteps.push({
          target: `[data-onboarding="room-card-${index}"]`,
          content: roomDescription,
          placement: 'right' as const,
          disableScrolling: false,
        });
      }
    });

    return [step1, ...roomTypeSteps];
  }, [adminRooms]);

  // Auto-start when data is loaded and we have steps
  const autoStart = !loading && adminRooms.length > 0 && lobbySteps.length > 0;
  
  // Debug logging
  useEffect(() => {
    console.log('[LobbyPage] Onboarding state:', {
      loading,
      adminRoomsCount: adminRooms.length,
      autoStart,
      stepsCount: lobbySteps.length,
      steps: lobbySteps.map(s => s.target),
    });
  }, [loading, adminRooms.length, autoStart, lobbySteps.length]);

  const { JoyrideComponent, resetTour } = usePageOnboarding({
    steps: lobbySteps,
    pageKey: 'lobby',
    autoStart, // Only auto-start when data is loaded and steps are ready
  });

  // Expose resetTour globally for debugging (can be removed later)
  useEffect(() => {
    (window as any).resetLobbyOnboarding = resetTour;
    // Also expose a function to check/clear localStorage
    (window as any).checkLobbyOnboarding = () => {
      const completed = localStorage.getItem('onboarding_lobby_completed');
      console.log('Lobby onboarding completed status:', completed);
      return completed;
    };
    (window as any).clearLobbyOnboarding = () => {
      localStorage.removeItem('onboarding_lobby_completed');
      console.log('Cleared lobby onboarding from localStorage');
      resetTour();
    };
    return () => {
      delete (window as any).resetLobbyOnboarding;
      delete (window as any).checkLobbyOnboarding;
      delete (window as any).clearLobbyOnboarding;
    };
  }, [resetTour]);

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
      {/* Debug: Manual start button - remove after testing */}
      {(
        <div style={{ position: 'fixed', top: '10px', right: '10px', zIndex: 99999, background: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '5px', color: 'white' }}>
          <div style={{ marginBottom: '5px', fontSize: '12px' }}>
            Status: {localStorage.getItem('onboarding_lobby_completed') === 'true' ? 'Completed' : 'Not completed'}
          </div>
          <button 
            onClick={() => {
              console.log('Manual start - steps:', lobbySteps);
              console.log('Manual start - elements:', {
                roomsSection: document.querySelector('[data-onboarding="rooms-section"]'),
                roomCard: document.querySelector('[data-onboarding="room-card"]'),
                highScores: document.querySelector('[data-onboarding="high-scores-link"]'),
              });
              // Clear localStorage first
              localStorage.removeItem('onboarding_lobby_completed');
              console.log('Cleared onboarding_lobby_completed from localStorage');
              resetTour();
            }}
            style={{ padding: '5px 10px', cursor: 'pointer', marginRight: '5px' }}
          >
            Start Lobby Tour
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('onboarding_lobby_completed');
              console.log('Cleared onboarding_lobby_completed from localStorage');
            }}
            style={{ padding: '5px 10px', cursor: 'pointer' }}
          >
            Clear Only
          </button>
        </div>
      )}
      <div className="lobby-row">
        {/* Center Column - Rooms & Word of the Day */}
        <div className="lobby-col-center">
          {wordOfTheDay && (
            <div className="lobby-section wotd-section" data-onboarding="word-of-the-day">
              <h3 id="word-of-the-day">{wordOfTheDay.word}:</h3>
              <p id="word-of-the-day-definition">{wordOfTheDay.definition}</p>
            </div>
          )}

          <div className="lobby-section rooms-section" data-onboarding="rooms-section">
            <div className="rooms-list">
              {/* Admin-created rooms */}
              {adminRooms.map((room, index) => {
                return (
                  <div key={room.room_id} className="room-card-wrapper">
                    <Link
                      to={`/rooms/guest/${room.room_slug}/`}
                      className="room-link"
                    >
                      <div 
                        className="room-card" 
                        style={{ borderColor: room.color }}
                        data-onboarding={`room-card-${index}`}
                      >
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
                );
              })}
              
              {/* Custom rooms section */}
              {customRooms.length > 0 && (
                <>
                  <div className="custom-rooms-header">
                    <h3>Custom Rooms</h3>
                  </div>
                  {customRooms.map((room) => (
                    <div key={room.room_id} className="room-card-wrapper custom-room-wrapper">
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
                          {room.description && (
                            <div className="custom-room-description">
                              {room.description}
                            </div>
                          )}
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
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

      </div>
      {/* Only render Joyride when it should actually run to avoid blocking interactions */}
      {JoyrideComponent}
    </div>
  );
};

export default LobbyPage;

