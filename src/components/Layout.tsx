import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, lobbyAPI } from '../services/api';
import { Menu, X, Bell } from 'lucide-react';
import { toast } from 'react-toastify';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

interface ChatMessage {
  user: string;
  chat_color: string;
  content: string;
  timestamp: string;
}

interface Activity {
  username: string;
  chat_color: string;
  activity_type: string;
  description: string;
  timestamp_ago: string;
  profile_url: string;
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

const Layout = ({ children }: LayoutProps) => {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(window.innerWidth >= 1440);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1440);
  const { user, isAuthenticated, logout } = useAuth();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Activities state
  const [activities, setActivities] = useState<Activity[]>([]);

  // Users online state
  const [usersOnline, setUsersOnline] = useState<UserOnline[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [guestsOnline, setGuestsOnline] = useState(0);
  const [mobileUsersDropdownOpen, setMobileUsersDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchProfilePicture = async () => {
      if (isAuthenticated && user) {
        try {
          const profile = await authAPI.getProfile(user.username.toLowerCase());
          setProfilePictureUrl(profile.profile_picture_url);
        } catch (error) {
          // Profile might not exist yet, use default
          setProfilePictureUrl(null);
        }
      }
    };

    fetchProfilePicture();
  }, [isAuthenticated, user]);

  // Load chat messages
  useEffect(() => {
    const loadChatMessages = async () => {
      try {
        const data = await lobbyAPI.getChatMessages();
        setChatMessages(data.messages || []);
      } catch (error: any) {
        console.error('Error loading chat messages:', error);
      }
    };

    loadChatMessages();

    // Poll for new messages every 5 seconds
    chatPollingIntervalRef.current = setInterval(async () => {
      try {
        const timestampData = await lobbyAPI.getLastMessageTimestamp();
        if (timestampData.new_message === 'yes') {
          const data = await lobbyAPI.getChatMessages();
          setChatMessages(data.messages || []);
        }
      } catch (error: any) {
        // Silently handle 404s - endpoint may not exist
        if (error?.response?.status !== 404) {
          console.error('Error checking for new messages:', error);
        }
      }
    }, 5000);

    return () => {
      if (chatPollingIntervalRef.current) {
        clearInterval(chatPollingIntervalRef.current);
      }
    };
  }, []);

  // Load activities feed
  useEffect(() => {
    const loadActivities = async () => {
      try {
        const data = await lobbyAPI.getActivitiesFeed();
        setActivities(data.activities || []);
      } catch (error: any) {
        console.error('Error loading activities:', error);
      }
    };

    loadActivities();
    const interval = setInterval(loadActivities, 600000); // Every 10 minutes
    return () => clearInterval(interval);
  }, []);

  // Load users online
  useEffect(() => {
    const loadUsersOnline = async () => {
      try {
        const data = await lobbyAPI.getUsersOnline();
        setUsersOnline(data.users || []);
        setOnlineCount(data.online_count || 0);
      } catch (error: any) {
        // Silently handle 404s - endpoint may not exist
        if (error?.response?.status !== 404) {
          console.error('Error loading users online:', error);
        }
      }
    };

    const loadOnlineCounts = async () => {
      try {
        const data = await lobbyAPI.getNoUsersOnline();
        setOnlineCount(data.no_users_online || 0);
        setGuestsOnline(data.no_guests_online || 0);
      } catch (error: any) {
        // Silently handle 404s - endpoint may not exist
        if (error?.response?.status !== 404) {
          console.error('Error loading online counts:', error);
        }
      }
    };

    loadUsersOnline();
    loadOnlineCounts();
    const userInterval = setInterval(loadUsersOnline, 10000); // Every 10 seconds
    const countInterval = setInterval(loadOnlineCounts, 10000); // Every 10 seconds
    return () => {
      clearInterval(userInterval);
      clearInterval(countInterval);
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !isAuthenticated) return;

    try {
      await lobbyAPI.sendChatMessage(newMessage.trim());
      setNewMessage('');
      // Reload messages
      const data = await lobbyAPI.getChatMessages();
      setChatMessages(data.messages || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send message');
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const desktop = window.innerWidth >= 1440;
      setIsDesktop(desktop);
      // Only set initial state on mount, don't override user interactions
      // This effect only runs once on mount
    };

    // Set initial state based on screen size
    if (window.innerWidth >= 1440) {
      setLeftSidebarOpen(true);
      setIsDesktop(true);
    } else {
      setLeftSidebarOpen(false);
      setIsDesktop(false);
    }

    // Listen for resize to update isDesktop state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout-container">
      {/* Top Bar */}
      <nav className="top-bar">
        <div className="top-bar-left">
          <button
            className="burger-button"
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            aria-label="Toggle sidebar"
          >
            <Menu size={24} />
          </button>
        </div>
        <div className="top-bar-right">
          {isAuthenticated && (
            <>
              {/* Mobile Users Online Button */}
              <button
                className="mobile-users-button"
                onClick={() => setMobileUsersDropdownOpen(!mobileUsersDropdownOpen)}
                aria-label="Users online"
              >
                <span className="mobile-users-count">{onlineCount}</span>
                <span className="mobile-users-label">Online</span>
              </button>
              <button
                className="notification-button"
                onClick={() => {
                  // TODO: Open notifications
                }}
                aria-label="Notifications"
              >
                <Bell size={24} />
                {/* TODO: Add notification badge if there are unread notifications */}
              </button>
            </>
          )}
          <button
            className="profile-picture-button-top"
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            aria-label="Toggle profile menu"
          >
            {isAuthenticated ? (
              profilePictureUrl ? (
                <img
                  src={profilePictureUrl}
                  alt="Profile"
                  className="profile-button-image"
                />
              ) : (
                <div className="profile-button-placeholder">
                  {user?.username.charAt(0).toUpperCase()}
                </div>
              )
            ) : (
              <img
                src="/images/default.png"
                alt="Guest"
                className="profile-button-image"
              />
            )}
          </button>
        </div>
      </nav>

      {/* Players Online - Desktop (below top bar) */}
      <div className={`players-online-desktop ${leftSidebarOpen ? 'left-open' : 'left-closed'}`}>
        <div className="players-online-container">
          <div className="players-online-count-label">
            <div>
              Online: <span className="players-online-count-number">{onlineCount}</span>
            </div>
            {guestsOnline > 0 && (
              <div>
                Guests: <span className="players-online-count-number">{guestsOnline}</span>
              </div>
            )}
          </div>
          <div className="players-online-list">
            {usersOnline.map((user) => (
              <div key={user.id} className="player-online-item">
                <Link
                  to={`/profile/${user.profile_url}`}
                  className="player-online-name"
                  style={{ color: user.chat_color }}
                >
                  {user.display_name}
                </Link>
                <div className="player-online-status">
                  {user.online === 'yes' ? (
                    <>
                      <span className="status-dot online-dot"></span>
                      {user.playing ? (
                        <span className="status-text playing-text">{user.playing}</span>
                      ) : (
                        <span className="status-text online-text">{user.activity || 'Online'}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="status-dot offline-dot"></span>
                      <span className="status-text offline-text">Online: {user.time_ago}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Users Dropdown */}
      {mobileUsersDropdownOpen && (
        <div className="mobile-users-dropdown">
          <div className="mobile-users-dropdown-header">
            <h3>Players Online ({onlineCount})</h3>
            <button
              className="mobile-users-close"
              onClick={() => setMobileUsersDropdownOpen(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="mobile-users-dropdown-list">
            {usersOnline.map((user) => (
              <div key={user.id} className="player-online-item">
                <Link
                  to={`/profile/${user.profile_url}`}
                  className="player-online-name"
                  style={{ color: user.chat_color }}
                  onClick={() => setMobileUsersDropdownOpen(false)}
                >
                  {user.display_name}
                </Link>
                <div className="player-online-status">
                  {user.online === 'yes' ? (
                    <>
                      <span className="status-dot online-dot"></span>
                      {user.playing ? (
                        <span className="status-text playing-text">{user.playing}</span>
                      ) : (
                        <span className="status-text online-text">{user.activity || 'Online'}</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="status-dot offline-dot"></span>
                      <span className="status-text offline-text">Online: {user.time_ago}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Left Sidebar */}
      <aside className={`left-sidebar ${leftSidebarOpen ? 'open' : 'closed'}`}>
        <nav className="sidebar-nav">
          <div className="nav-section">
            {leftSidebarOpen && <div className="nav-section-title">Live</div>}
            <Link
              to="/lobby"
              className={`nav-link ${location.pathname.startsWith('/lobby') ? 'active' : ''}`}
            >
              {leftSidebarOpen && <span>Live Games</span>}
            </Link>
          </div>
          <div className="nav-section">
            {leftSidebarOpen && <div className="nav-section-title">Daily Challenges</div>}
            <Link
              to="/minigames"
              className={`nav-link ${location.pathname.startsWith('/minigames') ? 'active' : ''}`}
            >
              {leftSidebarOpen && <span>Mini-Games</span>}
            </Link>
            <Link
              to="/daily-boards"
              className={`nav-link ${location.pathname.startsWith('/daily-boards') ? 'active' : ''}`}
            >
              {leftSidebarOpen && <span>Everyday Board</span>}
            </Link>
            <Link
              to="/timeless-boards"
              className={`nav-link ${location.pathname.startsWith('/timeless-boards') ? 'active' : ''}`}
            >
              {leftSidebarOpen && <span>Timeless Board</span>}
            </Link>
          </div>
          <div className="nav-section">
            {leftSidebarOpen && <div className="nav-section-title">Tournament</div>}
            <Link
              to="/tournament"
              className={`nav-link ${location.pathname.startsWith('/tournament') ? 'active' : ''}`}
            >
              {leftSidebarOpen && <span>Tournament (Biweekly)</span>}
            </Link>
          </div>
        </nav>
        {/* Activities Feed */}
        <div className="sidebar-activities">
          <h3 className="sidebar-section-title">Activities</h3>
          <div className="sidebar-activities-feed">
            {activities.length > 0 ? (
              <ul className="sidebar-activities-list">
                {activities.map((activity, idx) => (
                  <li key={idx} className="sidebar-activity-item">
                    <strong>
                      <Link
                        to={`/profile/${activity.profile_url}`}
                        className="sidebar-activity-username"
                        style={{ color: activity.chat_color }}
                        onClick={() => setLeftSidebarOpen(false)}
                      >
                        {activity.username}
                      </Link>
                    </strong>
                    <span
                      className="sidebar-activity-description"
                      dangerouslySetInnerHTML={{ __html: activity.description }}
                    />
                    <br />
                    <small className="sidebar-activity-timestamp">{activity.timestamp_ago}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sidebar-no-activities">No recent activities</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${leftSidebarOpen ? 'left-open' : 'left-closed'}`}>
        {children}
      </main>

      {/* Right Sidebar */}
      <aside className={`right-sidebar ${rightSidebarOpen ? 'open' : 'closed'}`}>
        <nav className="sidebar-nav">
          {/* Dashboard link - visible to all users (guests and authenticated) */}
          <Link
            to="/dashboard"
            className={`nav-link ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}
            onClick={() => setRightSidebarOpen(false)}
          >
            <span>Dashboard</span>
          </Link>
          
          {isAuthenticated ? (
            <>
              <Link
                to={`/profile/${user?.username.toLowerCase()}`}
                className={`nav-link ${location.pathname.startsWith('/profile') ? 'active' : ''}`}
                onClick={() => setRightSidebarOpen(false)}
              >
                <span>Profile</span>
              </Link>
              <Link
                to="/leaderboards"
                className={`nav-link ${location.pathname.startsWith('/leaderboards') ? 'active' : ''}`}
                onClick={() => setRightSidebarOpen(false)}
              >
                <span>High Scores</span>
              </Link>
              <Link
                to="/forum"
                className={`nav-link ${location.pathname.startsWith('/forum') ? 'active' : ''}`}
                onClick={() => setRightSidebarOpen(false)}
              >
                <span>Forum</span>
              </Link>
              <button
                className="nav-link logout-link"
                onClick={handleLogout}
              >
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/leaderboards"
                className={`nav-link ${location.pathname.startsWith('/leaderboards') ? 'active' : ''}`}
                onClick={() => setRightSidebarOpen(false)}
              >
                <span>High Scores</span>
              </Link>
              <Link
                to="/forum"
                className={`nav-link ${location.pathname.startsWith('/forum') ? 'active' : ''}`}
                onClick={() => setRightSidebarOpen(false)}
              >
                <span>Forum</span>
              </Link>
              <Link
                to="/login"
                className="nav-link"
                onClick={() => setRightSidebarOpen(false)}
              >
                <span>Login</span>
              </Link>
            </>
          )}
        </nav>
        {/* Lobby Chat */}
        <div className="sidebar-chat">
          <h3 className="sidebar-section-title">Lobby Chat</h3>
          <div className="sidebar-chat-messages" id="sidebar-messages">
            {chatMessages.map((msg, idx) => {
              // Special handling for TheHerald messages
              if (msg.user === "TheHerald") {
                return (
                  <div key={idx} className="sidebar-chat-message">
                    <em style={{ color: '#71bbe9' }}>{msg.content}</em>
                    <br />
                    <em style={{ color: 'grey' }}>{msg.timestamp}</em>
                  </div>
                );
              }
              
              // Regular chat messages
              return (
                <div key={idx} className="sidebar-chat-message">
                  <span className="sidebar-chat-user" style={{ color: msg.chat_color }}>
                    {msg.user}:
                  </span>
                  <span className="sidebar-chat-content">{msg.content}</span>
                  <span className="sidebar-chat-timestamp">{msg.timestamp}</span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSendMessage} className="sidebar-chat-input-form">
            <textarea
              className="sidebar-chat-input"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={isAuthenticated ? "Let people know you're here" : "You need to be logged in to chat"}
              disabled={!isAuthenticated}
              rows={3}
            />
            {isAuthenticated && (
              <button type="submit" className="sidebar-chat-send-button">
                Send
              </button>
            )}
          </form>
        </div>
      </aside>

      {/* Overlay - only show for right sidebar on desktop, both on mobile/tablet */}
      {((!isDesktop && leftSidebarOpen) || rightSidebarOpen || mobileUsersDropdownOpen) && (
        <div
          className="sidebar-overlay"
          onClick={() => {
            if (!isDesktop) {
              setLeftSidebarOpen(false);
            }
            setRightSidebarOpen(false);
            setMobileUsersDropdownOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default Layout;

