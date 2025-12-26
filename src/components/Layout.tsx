import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, lobbyAPI, dashboardAPI } from '../services/api';
import { Menu, X, Bell, BarChart3, Pin, PinOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { PollModal } from './PollModal';
import NotificationDropdown from './NotificationDropdown';
import { Username } from './Username';
import './Layout.css';

// Component to convert anchor tags to React Router Links
const ActivityDescription = ({ html, onLinkClick }: { html: string; onLinkClick: () => void }) => {
  // Parse HTML and convert anchor tags to React Router Links
  const parseHtml = (htmlString: string): React.ReactNode[] => {
    // Normalize profile URLs: convert /viewprofile/ to /profile/
    const normalizedHtml = htmlString.replace(/\/viewprofile\//gi, '/profile/');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = normalizedHtml;
    
    const elements: React.ReactNode[] = [];
    let keyIndex = 0;
    
    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (text) {
          elements.push(text);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        if (element.tagName === 'A') {
          const href = element.getAttribute('href') || '';
          const text = element.textContent || '';
          // Normalize profile URLs
          const normalizedHref = href.replace(/\/viewprofile\//gi, '/profile/');
          // Check if it's an internal route (starts with /)
          if (normalizedHref.startsWith('/')) {
            elements.push(
              <Link key={`link-${keyIndex++}`} to={normalizedHref} onClick={onLinkClick}>
                {text}
              </Link>
            );
          } else {
            // External link, keep as anchor
            elements.push(
              <a key={`link-${keyIndex++}`} href={href} target="_blank" rel="noopener noreferrer">
                {text}
              </a>
            );
          }
        } else {
          // For other elements, process children and preserve structure
          const childElements: React.ReactNode[] = [];
          Array.from(element.childNodes).forEach((child) => {
            const childKey = keyIndex++;
            if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent || '';
              if (text) {
                childElements.push(text);
              }
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const childEl = child as Element;
              if (childEl.tagName === 'A') {
                const href = childEl.getAttribute('href') || '';
                const text = childEl.textContent || '';
                // Normalize profile URLs
                const normalizedHref = href.replace(/\/viewprofile\//gi, '/profile/');
                if (normalizedHref.startsWith('/')) {
                  childElements.push(
                    <Link key={`link-${childKey}`} to={normalizedHref} onClick={onLinkClick}>
                      {text}
                    </Link>
                  );
                } else {
                  childElements.push(
                    <a key={`link-${childKey}`} href={href} target="_blank" rel="noopener noreferrer">
                      {text}
                    </a>
                  );
                }
              } else {
                // Recursively process nested elements
                const nestedDiv = document.createElement('div');
                nestedDiv.appendChild(child.cloneNode(true));
                const nestedContent = parseHtml(nestedDiv.innerHTML);
                childElements.push(...nestedContent);
              }
            }
          });
          // Wrap in the same element type if needed, or just add children
          if (childElements.length > 0) {
            elements.push(...childElements);
          }
        }
      }
    };
    
    // Process all nodes
    Array.from(tempDiv.childNodes).forEach((node) => {
      processNode(node);
    });
    
    return elements.length > 0 ? elements : [htmlString];
  };
  
  const parsedContent = parseHtml(html);
  
  return (
    <span className="sidebar-activity-description">
      {parsedContent}
    </span>
  );
};

interface LayoutProps {
  children: React.ReactNode;
}

interface ChatMessage {
  user: string;
  chat_color: string;
  content: string;
  timestamp: string;
  profile_url?: string;
  profile_picture_url?: string | null;
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
  profile_picture_url?: string | null;
  online: string;
  time_ago: string;
  playing: string;
  activity: string;
}

interface PollOption {
  value: string;
  percentage: number;
}

interface Poll {
  id: number;
  question: string;
  options: PollOption[];
  total_votes: number;
  user_vote: number | null;
  discussion_link: string;
}

const Layout = ({ children }: LayoutProps) => {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(window.innerWidth >= 1440);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1440);
  const [leftSidebarPinned, setLeftSidebarPinned] = useState(false);
  const [rightSidebarPinned, setRightSidebarPinned] = useState(false);
  const [isTabletOrDesktop, setIsTabletOrDesktop] = useState(window.innerWidth >= 768);
  const { user, isAuthenticated, logout, loading: authLoading } = useAuth();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rightSidebarRef = useRef<HTMLElement>(null);

  // Activities state
  const [activities, setActivities] = useState<Activity[]>([]);

  // Users online state
  const [usersOnline, setUsersOnline] = useState<UserOnline[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [guestsOnline, setGuestsOnline] = useState(0);
  const [mobileUsersDropdownOpen, setMobileUsersDropdownOpen] = useState(false);
  const [showPlaymatesOnly, setShowPlaymatesOnly] = useState(false);
  
  // Poll state
  const [poll, setPoll] = useState<Poll | null>(null);
  const [pollModalOpen, setPollModalOpen] = useState(false);

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
    
    // Listen for profile picture updates
    const handleProfilePictureUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ profilePictureUrl: string | null }>;
      if (customEvent.detail?.profilePictureUrl !== undefined) {
        setProfilePictureUrl(customEvent.detail.profilePictureUrl);
      } else {
        // If no URL provided, refetch the profile
        fetchProfilePicture();
      }
    };
    
    window.addEventListener('profilePictureUpdated', handleProfilePictureUpdate);
    
    return () => {
      window.removeEventListener('profilePictureUpdated', handleProfilePictureUpdate);
    };
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
        const normalize = (html: string) =>
          html
            .replace(/\/minigames\?show_doodles=(true|1)/gi, '/doodledum')
            .replace(/\/minigames/gi, '/doodledum');
        const normalized = (data.activities || []).map((a: Activity) => ({
          ...a,
          description: normalize(a.description || ''),
        }));
        setActivities(normalized);
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
        // Pass filter preference to backend
        const filterParam = isAuthenticated && showPlaymatesOnly ? 'true' : 'false';
        const data = await lobbyAPI.getUsersOnline(filterParam);
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
  }, [isAuthenticated, showPlaymatesOnly]);

  // Load playmates list and filter preference once for authenticated users (for filtering online list)
  useEffect(() => {
    const loadPlaymates = async () => {
      if (!isAuthenticated) {
        setShowPlaymatesOnly(false);
        return;
      }
      try {
        const bundle = await dashboardAPI.getDashboardBundle();
        // Load filter preference from backend
        setShowPlaymatesOnly(bundle.playmates?.filter_online_playmates_only || false);
      } catch (error) {
        console.error('Error loading playmates for filter', error);
      }
    };
    loadPlaymates();
    
    // Reload playmates and filter preference periodically to sync with dashboard changes
    const interval = setInterval(loadPlaymates, 5000); // Every 5 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Load poll data
  useEffect(() => {
    const loadPoll = async () => {
      try {
        const data = await lobbyAPI.getLobbyData();
        setPoll(data.poll || null);
      } catch (error: any) {
        // Silently handle errors - poll is optional
        console.error('Error loading poll:', error);
      }
    };
    loadPoll();
  }, []);

  // Load notifications
  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadNotifications(0);
      return;
    }

    const loadNotifications = async () => {
      try {
        const data = await authAPI.getNotifications();
        setUnreadNotifications(data.unread_count || 0);
      } catch (error: any) {
        // Silently handle errors
        console.error('Error loading notifications:', error);
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleNotificationClick = async () => {
    if (!isAuthenticated) return;
    
    const newShowState = !showNotifications;
    setShowNotifications(newShowState);
  };

  const handleNotificationsRead = async () => {
    // Mark notifications as read when closing the dropdown
    try {
      await authAPI.markNotificationsRead();
      setUnreadNotifications(0);
    } catch (error: any) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handlePollVote = async (optionNo: number) => {
    if (!isAuthenticated) {
      toast.error('You must be logged in to vote');
      return;
    }

    // Check if user already voted for this option
    if (poll?.user_vote === optionNo) {
      toast.info('You have already voted for this option');
      return;
    }

    try {
      const previousVote = poll?.user_vote;
      const data = await lobbyAPI.votePoll(optionNo);
      
      // Reload poll data to get updated user_vote and ensure we have the latest state
      const pollData = await lobbyAPI.getLobbyData();
      const updatedPoll = pollData.poll;
      
      if (updatedPoll) {
        setPoll({
          ...updatedPoll,
          options: data.poll_options,
          total_votes: data.total_votes,
        });
        
        // Only show success if the vote actually changed
        if (updatedPoll.user_vote !== previousVote) {
          toast.success('Vote recorded!');
        } else {
          toast.info('You have already voted on this poll');
        }
      } else {
        // Fallback: update with what we got from vote response
        setPoll({
          ...poll!,
          options: data.poll_options,
          total_votes: data.total_votes,
        });
        toast.success('Vote recorded!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to vote');
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Scroll right sidebar to top when it opens
  useEffect(() => {
    if (rightSidebarOpen && rightSidebarRef.current) {
      // Small delay to ensure the sidebar is rendered
      setTimeout(() => {
        rightSidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [rightSidebarOpen]);

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
      const tabletOrDesktop = window.innerWidth >= 768;
      setIsDesktop(desktop);
      setIsTabletOrDesktop(tabletOrDesktop);
      
      // On very large screens, automatically unpin sidebars (they don't need pinning)
      if (desktop) {
        setLeftSidebarPinned(false);
        setRightSidebarPinned(false);
      }
    };

    // Set initial state based on screen size
    if (window.innerWidth >= 1440) {
      setLeftSidebarOpen(true);
      setIsDesktop(true);
    } else {
      setLeftSidebarOpen(false);
      setIsDesktop(false);
    }
    setIsTabletOrDesktop(window.innerWidth >= 768);

    // Listen for resize to update isDesktop state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // On mobile: close one sidebar when the other opens
  const handleLeftSidebarToggle = () => {
    const isMobile = !isTabletOrDesktop;
    if (isMobile && rightSidebarOpen) {
      setRightSidebarOpen(false);
      setRightSidebarPinned(false);
    }
    // If closing, automatically unpin
    if (leftSidebarOpen) {
      setLeftSidebarPinned(false);
    }
    setLeftSidebarOpen(!leftSidebarOpen);
  };

  const handleRightSidebarToggle = () => {
    const isMobile = !isTabletOrDesktop;
    if (isMobile && leftSidebarOpen) {
      setLeftSidebarOpen(false);
      setLeftSidebarPinned(false);
    }
    // If closing, automatically unpin
    if (rightSidebarOpen) {
      setRightSidebarPinned(false);
    }
    setRightSidebarOpen(!rightSidebarOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Backend already filters and sorts correctly based on filter_playmates_only parameter
  // Just use the users returned from the backend (already limited to 20)
  const filteredUsers = usersOnline;

  return (
    <div className="layout-container">
      {/* Top Bar */}
      <nav className="top-bar">
        <div className="top-bar-left">
          <button
            className="burger-button"
            onClick={handleLeftSidebarToggle}
            aria-label="Toggle sidebar"
          >
            <Menu size={24} />
          </button>
        </div>
        <div className="top-bar-right">
          {/* Poll Button */}
          {poll && (
            <button
              className="poll-button"
              onClick={() => setPollModalOpen(true)}
              aria-label="Open poll"
            >
              <BarChart3 size={24} />
              <span className="poll-button-label">Poll</span>
            </button>
          )}
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
                onClick={handleNotificationClick}
                aria-label="Notifications"
              >
                <Bell size={24} />
                {unreadNotifications > 0 && (
                  <span className="notification-badge" />
                )}
              </button>
              <NotificationDropdown
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                unreadCount={unreadNotifications}
                onNotificationsRead={handleNotificationsRead}
              />
            </>
          )}
          <button
            className="profile-picture-button-top"
            onClick={handleRightSidebarToggle}
            aria-label="Toggle profile menu"
          >
            {isAuthenticated && profilePictureUrl ? (
              <img
                src={profilePictureUrl}
                alt="Profile"
                className="profile-button-image"
              />
            ) : (
              <img
                src="/images/default.png"
                alt={isAuthenticated ? "Profile" : "Guest"}
                className="profile-button-image"
              />
            )}
            <img src="/images/chat.png" alt="Chat" className="chat-badge" />
          </button>
        </div>
      </nav>

      {/* Players Online - Desktop (below top bar) */}
      <div className={`players-online-desktop ${leftSidebarOpen ? 'left-open' : 'left-closed'}`}>
        <div className="players-online-container">
          <div className="players-online-count-label">
            <div>
              <span>Online:</span> <span className="players-online-count-number">{onlineCount}</span>
            </div>
            {guestsOnline > 0 && (
              <div>
                Guests: <span className="players-online-count-number">{guestsOnline}</span>
              </div>
            )}
          </div>
          <div className="players-online-list">
            {filteredUsers.map((user) => (
              <div key={user.id} className="player-online-item">
                <Username
                  username={user.display_name}
                  profileUrl={user.profile_url}
                  chatColor={user.chat_color}
                  className="player-online-name"
                  onClick={() => {
                    if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                  }}
                />
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
            {filteredUsers.map((user) => (
              <div key={user.id} className="player-online-item">
                <Username
                  username={user.display_name}
                  profileUrl={user.profile_url}
                  chatColor={user.chat_color}
                  className="player-online-name"
                  onClick={() => setMobileUsersDropdownOpen(false)}
                />
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
      <aside className={`left-sidebar ${leftSidebarOpen ? 'open' : 'closed'} ${leftSidebarPinned ? 'pinned' : ''}`}>
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-link-with-pin">
              <Link
                to="/lobby"
                className={`nav-link nav-link-large ${location.pathname.startsWith('/lobby') ? 'active' : ''}`}
                onClick={() => {
                  if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                }}
              >
                {leftSidebarOpen && <span>Live Games</span>}
              </Link>
              {isTabletOrDesktop && (
                <button
                  className="sidebar-pin-button-inline"
                  onClick={() => {
                    const newPinnedState = !leftSidebarPinned;
                    setLeftSidebarPinned(newPinnedState);
                    // If pinning, ensure sidebar is open
                    if (newPinnedState && !leftSidebarOpen) {
                      setLeftSidebarOpen(true);
                    }
                  }}
                  aria-label={leftSidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                  title={leftSidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                >
                  {leftSidebarPinned ? <PinOff size={18} /> : <Pin size={18} />}
                </button>
              )}
            </div>
          </div>
          <div className="nav-section">
            {leftSidebarOpen && <div className="nav-section-title">Daily Challenges</div>}
            <div className="nav-links-grid">
              <Link
                to="/minigames"
                className={`nav-link ${location.pathname.startsWith('/minigames') ? 'active' : ''}`}
                onClick={() => {
                  if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                }}
              >
                {leftSidebarOpen && <span>Mini-Games</span>}
              </Link>
              <Link
                to="/doodledum"
                className={`nav-link ${location.pathname.startsWith('/doodledum') ? 'active' : ''}`}
                onClick={() => {
                  if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                }}
              >
                {leftSidebarOpen && <span>Doodledum</span>}
              </Link>
              <Link
                to="/daily-boards"
                className={`nav-link ${location.pathname.startsWith('/daily-boards') ? 'active' : ''}`}
                onClick={() => {
                  if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                }}
              >
                {leftSidebarOpen && <span>Everyday Board</span>}
              </Link>
              <Link
                to="/timeless-boards"
                className={`nav-link ${location.pathname.startsWith('/timeless-boards') ? 'active' : ''}`}
                onClick={() => {
                  if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                }}
              >
                {leftSidebarOpen && <span>Timeless Board</span>}
              </Link>
            </div>
          </div>
          <div className="nav-section">
            {leftSidebarOpen && <div className="nav-section-title">More</div>}
            <Link
              to="/leaderboards"
              className={`nav-link ${location.pathname.startsWith('/leaderboards') ? 'active' : ''}`}
              onClick={() => {
                if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
              }}
            >
              {leftSidebarOpen && <span>High Scores</span>}
            </Link>
            <Link
              to="/forum"
              className={`nav-link ${location.pathname.startsWith('/forum') ? 'active' : ''}`}
              onClick={() => {
                if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
              }}
            >
              {leftSidebarOpen && <span>Forum</span>}
            </Link>
          </div>
          <div className="nav-section">
            {leftSidebarOpen && <div className="nav-section-title">Tournament</div>}
            <Link
              to="/tournament"
              className={`nav-link ${location.pathname.startsWith('/tournament') && !location.pathname.startsWith('/tournament/test') ? 'active' : ''}`}
              onClick={() => {
                if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
              }}
            >
              {leftSidebarOpen && <span>Tournament (Biweekly)</span>}
            </Link>
            {!authLoading && user?.is_superuser && (
              <Link
                to="/tournament/test"
                className={`nav-link ${location.pathname.startsWith('/tournament/test') ? 'active' : ''}`}
                onClick={() => {
                  if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                }}
              >
                {leftSidebarOpen && <span>Test Tournament</span>}
              </Link>
            )}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${leftSidebarOpen ? 'left-open' : 'left-closed'}`}>
        {children}
      </main>

      {/* Right Sidebar */}
      <aside 
        ref={rightSidebarRef}
        className={`right-sidebar ${rightSidebarOpen ? 'open' : 'closed'} ${rightSidebarPinned ? 'pinned' : ''}`}
      >
        <nav className="sidebar-nav">
          {/* Dashboard, Profile, and Login/Logout links */}
          <div className="nav-links-grid">
            <Link
              to="/dashboard"
              className={`nav-link ${location.pathname.startsWith('/dashboard') ? 'active' : ''}`}
              onClick={() => {
                if (!rightSidebarPinned) setRightSidebarOpen(false);
              }}
            >
              <span>Dashboard</span>
            </Link>
            {isAuthenticated ? (
              <>
                <Link
                  to={`/profile/${user?.username.toLowerCase()}`}
                  className={`nav-link ${location.pathname.startsWith('/profile') ? 'active' : ''}`}
                  onClick={() => {
                    if (!rightSidebarPinned) setRightSidebarOpen(false);
                  }}
                >
                  <span>Profile</span>
                </Link>
                <button
                  className="nav-link logout-link"
                  onClick={handleLogout}
                >
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="nav-link"
                onClick={() => {
                  if (!rightSidebarPinned) setRightSidebarOpen(false);
                }}
              >
                <span>Login</span>
              </Link>
            )}
          </div>
        </nav>
        {/* Lobby Chat */}
        <div className="sidebar-chat">
          <div className="sidebar-chat-header">
            <h3 className="sidebar-section-title">Lobby Chat</h3>
            {isTabletOrDesktop && (
              <button
                className="sidebar-pin-button-inline"
                onClick={() => {
                  const newPinnedState = !rightSidebarPinned;
                  setRightSidebarPinned(newPinnedState);
                  // If pinning, ensure sidebar is open
                  if (newPinnedState && !rightSidebarOpen) {
                    setRightSidebarOpen(true);
                  }
                }}
                aria-label={rightSidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                title={rightSidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              >
                {rightSidebarPinned ? <PinOff size={18} /> : <Pin size={18} />}
              </button>
            )}
          </div>
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
                  <Username
                    username={msg.user}
                    profileUrl={msg.profile_url}
                    chatColor={msg.chat_color}
                    className="sidebar-chat-user"
                  />
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
        {/* Activities Feed */}
        <div className="sidebar-activities">
          <h3 className="sidebar-section-title">Activities</h3>
          <div className="sidebar-activities-feed">
            {activities.length > 0 ? (
              <ul className="sidebar-activities-list">
                {activities.map((activity, idx) => (
                  <li key={idx} className="sidebar-activity-item">
                    <strong>
                      <Username
                        username={activity.username}
                        profileUrl={activity.profile_url}
                        chatColor={activity.chat_color}
                        className="sidebar-activity-username"
                        onClick={() => {
                          if (!isDesktop && !rightSidebarPinned) setRightSidebarOpen(false);
                        }}
                      />
                    </strong>
                    <ActivityDescription 
                      html={activity.description}
                      onLinkClick={() => {
                        if (!isDesktop && !rightSidebarPinned) setRightSidebarOpen(false);
                      }}
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

      {/* Overlay - only show when sidebars are not pinned */}
      {(((!isDesktop && leftSidebarOpen && !leftSidebarPinned) || (rightSidebarOpen && !rightSidebarPinned) || mobileUsersDropdownOpen)) && (
        <div
          className="sidebar-overlay"
          onClick={() => {
            // Only close sidebars if they're not pinned
            if (!isDesktop && !leftSidebarPinned) {
              setLeftSidebarOpen(false);
            }
            if (!rightSidebarPinned) {
              setRightSidebarOpen(false);
            }
            setMobileUsersDropdownOpen(false);
          }}
        />
      )}

      {/* Poll Modal */}
      <PollModal
        poll={poll}
        isOpen={pollModalOpen}
        onClose={() => setPollModalOpen(false)}
        onVote={handlePollVote}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
};

export default Layout;

