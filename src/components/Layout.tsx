import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import { authAPI, lobbyAPI, dashboardAPI, forumAPI } from '../services/api';
import { X, Bell, BarChart3, Pin, PinOff } from 'lucide-react';
import { toast } from 'react-toastify';
import Joyride from 'react-joyride';

// Define types locally since they're not directly exported from react-joyride
interface Step {
  target: string | HTMLElement;
  content: React.ReactNode;
  title?: React.ReactNode;
  placement?: 'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end' | 'right' | 'right-start' | 'right-end' | 'center' | 'auto';
  disableBeacon?: boolean;
  disableScrolling?: boolean;
  [key: string]: any;
}

interface CallBackProps {
  action: string;
  controlled: boolean;
  index: number;
  lifecycle: string;
  origin: string | null;
  size: number;
  status: string;
  step: Step;
  type: string;
}

const STATUS = {
  IDLE: 'idle',
  READY: 'ready',
  WAITING: 'waiting',
  RUNNING: 'running',
  PAUSED: 'paused',
  SKIPPED: 'skipped',
  FINISHED: 'finished',
  ERROR: 'error',
} as const;
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
  timestamp_iso?: string;
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
  const { run, setRun } = useOnboarding();
  const [stepIndex, setStepIndex] = useState(0);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  // Reset step index when tour starts
  useEffect(() => {
    if (run && stepIndex === 0) {
      setStepIndex(0);
    }
  }, [run]);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rightSidebarRef = useRef<HTMLElement>(null);
  const [hasNewChatMessages, setHasNewChatMessages] = useState(false);
  const rightSidebarOpenRef = useRef<boolean>(false);

  // Helper functions for last read time
  const getLastReadTime = (): number | null => {
    const stored = localStorage.getItem('lobbyChatLastReadTime');
    return stored ? parseInt(stored, 10) : null;
  };

  const setLastReadTime = (timestamp: number) => {
    localStorage.setItem('lobbyChatLastReadTime', timestamp.toString());
  };

  // Activities state
  const [activities, setActivities] = useState<Activity[]>([]);

  // Users online state
  const [usersOnline, setUsersOnline] = useState<UserOnline[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadForumPosts, setUnreadForumPosts] = useState(0);
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

  // Update ref when sidebar state changes
  useEffect(() => {
    rightSidebarOpenRef.current = rightSidebarOpen;
  }, [rightSidebarOpen]);

  // Load chat messages and poll continuously
  useEffect(() => {
    const loadChatMessages = async (isInitialLoad = false) => {
      try {
        const data = await lobbyAPI.getChatMessages();
        setChatMessages(data.messages || []);
        
        // Always check for new messages, but only update last read time if sidebar is open
        // Use ref to get current value (not closure value)
        const currentSidebarOpen = rightSidebarOpenRef.current;
        if (currentSidebarOpen) {
          setLastReadTime(Date.now());
          setHasNewChatMessages(false);
        } else {
          // Check if there are new messages
          const lastRead = getLastReadTime();
          if (!lastRead) {
            // No last read time stored yet, set initial baseline
            if (isInitialLoad && data.messages && data.messages.length > 0) {
              // Set baseline to the latest message's timestamp (messages are reversed for display, so newest is at the end)
              const latestMessage = data.messages[data.messages.length - 1];
              const timestampStr = latestMessage.timestamp_iso;
              if (timestampStr) {
                const messageTime = new Date(timestampStr).getTime();
                if (!isNaN(messageTime)) {
                  setLastReadTime(messageTime);
                } else {
                  setLastReadTime(Date.now());
                }
              } else {
                // timestamp_iso not available, use current time as baseline
                setLastReadTime(Date.now());
              }
            } else if (isInitialLoad) {
              // No messages yet, set to now
              setLastReadTime(Date.now());
            }
            setHasNewChatMessages(false);
          } else if (data.messages && data.messages.length > 0) {
            // Messages are reversed for display (oldest first), so the newest is at the end
            const latestMessage = data.messages[data.messages.length - 1];
            // Prefer timestamp_iso if available, otherwise skip if only human-readable timestamp exists
            const timestampStr = latestMessage.timestamp_iso;
            if (timestampStr) {
              const messageTime = new Date(timestampStr).getTime();
              if (!isNaN(messageTime)) {
                if (messageTime > lastRead) {
                  setHasNewChatMessages(true);
                } else {
                  setHasNewChatMessages(false);
                }
              } else {
                setHasNewChatMessages(false);
              }
            } else {
              // timestamp_iso not available - skip badge check
              setHasNewChatMessages(false);
            }
          } else {
            setHasNewChatMessages(false);
          }
        }
      } catch (error: any) {
        console.error('Error loading chat messages:', error);
      }
    };

    // Initial load
    loadChatMessages(true);

    // Poll for new messages every 5 seconds - always poll regardless of sidebar state
    chatPollingIntervalRef.current = setInterval(async () => {
      try {
        const timestampData = await lobbyAPI.getLastMessageTimestamp();
        if (timestampData.new_message === 'yes') {
          // Load messages and check for new ones
          await loadChatMessages(false);
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
  }, []); // Empty deps - poll continuously regardless of sidebar state

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

  // Load unread forum posts count
  useEffect(() => {
    const loadUnreadForumPosts = async () => {
      if (!isAuthenticated) {
        setUnreadForumPosts(0);
        return;
      }
      try {
        const data = await forumAPI.getUnreadCount();
        setUnreadForumPosts(data.unread_count || 0);
      } catch (error: any) {
        // Silently handle errors
        if (error?.response?.status !== 404) {
          console.error('Error loading unread forum posts:', error);
        }
      }
    };

    loadUnreadForumPosts();
    const interval = setInterval(loadUnreadForumPosts, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [isAuthenticated]);

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

  // Track when sidebar was opened to prevent auto-scroll to bottom immediately after
  const sidebarOpenedTimeRef = useRef<number>(0);
  const shouldAutoScrollRef = useRef<boolean>(false);

  // Scroll right sidebar to top when it opens
  useEffect(() => {
    if (rightSidebarOpen && rightSidebarRef.current) {
      // Record when sidebar opened and disable auto-scroll
      sidebarOpenedTimeRef.current = Date.now();
      shouldAutoScrollRef.current = false;
      // Small delay to ensure the sidebar is rendered
      setTimeout(() => {
        rightSidebarRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        // Re-enable auto-scroll after sidebar has been scrolled to top (allow 2 seconds)
        setTimeout(() => {
          shouldAutoScrollRef.current = true;
        }, 2000);
      }, 100);
    } else if (!rightSidebarOpen) {
      // Disable auto-scroll when sidebar closes
      shouldAutoScrollRef.current = false;
    }
  }, [rightSidebarOpen]);

  // Scroll to bottom when messages change, but only if sidebar has been open and auto-scroll is enabled
  useEffect(() => {
    // Only auto-scroll if sidebar is open and auto-scroll is enabled
    if (!rightSidebarOpen || !shouldAutoScrollRef.current) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, rightSidebarOpen]);

  // Update last read time when right sidebar opens
  useEffect(() => {
    if (rightSidebarOpen) {
      setLastReadTime(Date.now());
      setHasNewChatMessages(false);
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

  // Onboarding steps
  const baseSteps: Step[] = [
    {
      target: 'body',
      content: 'Welcome to Boojum Games! Let\'s take a quick tour to help you get started.',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-onboarding="navigation-menu"]',
      content: 'This is the main navigation menu. Click here to access all games, challenges, and features.',
      placement: 'right',
    },
    {
      target: '[data-onboarding="live-games"]',
      content: 'Live Games shows all active game rooms where you can join other players in real-time games.',
      placement: 'right',
      disableScrolling: false,
    },
    {
      target: '[data-onboarding="daily-challenges"]',
      content: 'Daily Challenges include Mini-Games, Doodledum, Everyday Board, and Timeless Board. These are updated daily or can be played anytime!',
      placement: 'right',
      disableScrolling: false,
    },
    {
      target: '[data-onboarding="tournament"]',
      content: 'Participate in biweekly tournaments and team tournaments to compete with other players and climb the leaderboards!',
      placement: 'right',
      disableScrolling: false,
    },
  ];

  const notificationStep: Step = {
    target: '[data-onboarding="notifications"]',
    content: 'Check your notifications here to stay updated on game activity and messages.',
    placement: 'bottom',
    disableScrolling: false,
  };

  const remainingSteps: Step[] = [
    {
      target: '[data-onboarding="profile-menu"]',
      content: 'Click here to open the right sidebar where you can access your dashboard, profile, and chat with other players.',
      placement: 'left',
      disableScrolling: false,
    },
    {
      target: '[data-onboarding="lobby-chat"]',
      content: 'This is the lobby chat where you can communicate with other players. You need to be logged in to send messages.',
      placement: 'left',
      disableScrolling: false,
    },
    {
      target: '[data-onboarding="dashboard-link"]',
      content: 'Visit your dashboard to manage your account settings, saved boards, and preferences.',
      placement: 'left',
      disableScrolling: false,
    },
  ];

  const steps: Step[] = isAuthenticated 
    ? [...baseSteps, notificationStep, ...remainingSteps]
    : [...baseSteps, ...remainingSteps];

  // Handle Joyride callback
  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index, action } = data;
    
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      setStepIndex(0);
    } else if (type === 'step:after') {
      // Open left sidebar after navigation menu step (step 1)
      if (index === 1 && !leftSidebarOpen) {
        setLeftSidebarOpen(true);
        // Wait for sidebar to render before showing next steps
        setTimeout(() => {
          setStepIndex(index + 1);
        }, 300);
        return;
      }
      
      // Keep left sidebar open for live games, daily challenges, and tournament steps (2, 3, 4)
      if (index >= 2 && index <= 4 && !leftSidebarOpen) {
        setLeftSidebarOpen(true);
      }
      
      // Close left sidebar and open right sidebar after profile menu step
      // For authenticated: profile menu is step 6 (index 6), for guests it's step 5 (index 5)
      // After adding live games, daily challenges, and tournament steps
      const profileMenuStepIndex = isAuthenticated ? 6 : 5;
      if (index === profileMenuStepIndex) {
        if (leftSidebarOpen) {
          setLeftSidebarOpen(false);
        }
        if (!rightSidebarOpen) {
          setRightSidebarOpen(true);
        }
        // Wait for sidebar to render, then advance to next step
        setTimeout(() => {
          setStepIndex(index + 1);
        }, 600);
        return; // Don't advance immediately
      }
      
      // For other steps, advance normally
      setStepIndex(index + 1);
    } else if (type === 'step:before') {
      // Ensure left sidebar is open for steps 2-4 (live games, daily challenges, tournament)
      if (index >= 2 && index <= 4 && !leftSidebarOpen) {
        setLeftSidebarOpen(true);
      }
      
      // Close left sidebar before showing profile menu step
      // For authenticated: profile menu is step 6 (index 6), for guests it's step 5 (index 5)
      const profileMenuStepIndex = isAuthenticated ? 6 : 5;
      if (index === profileMenuStepIndex && leftSidebarOpen) {
        setLeftSidebarOpen(false);
      }
    } else if (action === 'prev') {
      // Handle back button - update step index
      setStepIndex(index);
    } else if (action === 'next' || action === 'start') {
      // Handle next/start - advance step index
      setStepIndex(index + 1);
    }
  };

  return (
    <div className="layout-container">
      {/* Top Bar */}
      <nav className="top-bar">
        <div className="top-bar-left">
          <button
            className={`burger-button ${leftSidebarOpen ? 'active' : ''}`}
            onClick={handleLeftSidebarToggle}
            aria-label="Toggle sidebar"
            data-onboarding="navigation-menu"
          >
            <div className="custom-burger-icon">
              <span className="burger-line burger-line-pink"></span>
              <span className="burger-line burger-line-yellow"></span>
              <span className="burger-line burger-line-green"></span>
            </div>
          </button>
        </div>
        <div className="top-bar-right">
          {/* Poll Button */}
          {poll && (
            <button
              className="poll-button"
              onClick={() => setPollModalOpen(!pollModalOpen)}
              aria-label={pollModalOpen ? "Close poll" : "Open poll"}
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
                data-onboarding="notifications"
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
            data-onboarding="profile-menu"
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
            {hasNewChatMessages && (
              <img src="/images/chat.png" alt="Chat" className="chat-badge" />
            )}
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
                data-onboarding="live-games"
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
          <div className="nav-section" data-onboarding="daily-challenges">
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
          {isAuthenticated && user?.is_premium && (
            <div className="nav-section">
              {leftSidebarOpen && <div className="nav-section-title">Premium</div>}
              <div className="nav-links-grid">
                <Link
                  to="/daily-boards/archive"
                  className={`nav-link ${location.pathname.startsWith('/daily-boards/archive') ? 'active' : ''}`}
                  onClick={() => {
                    if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                  }}
                >
                  {leftSidebarOpen && <span>Daily Board Archive</span>}
                </Link>
            <Link
              to="/timeless-boards/archive?level=10"
              className={`nav-link ${location.pathname.startsWith('/timeless-boards/archive') ? 'active' : ''}`}
              onClick={() => {
                if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
              }}
            >
              {leftSidebarOpen && <span>Timeless Board Archive</span>}
            </Link>
            <Link
              to="/minigames?archive=true"
              className={`nav-link ${searchParams.get('archive') === 'true' ? 'active' : ''}`}
              onClick={() => {
                if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
              }}
            >
              {leftSidebarOpen && <span>Minigames Archive</span>}
            </Link>
              </div>
            </div>
          )}
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
              onClick={async () => {
                if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                // Refresh unread count when navigating to forum
                if (isAuthenticated) {
                  try {
                    const data = await forumAPI.getUnreadCount();
                    setUnreadForumPosts(data.unread_count || 0);
                  } catch (error) {
                    // Silently handle errors
                  }
                }
              }}
            >
              {leftSidebarOpen && (
                <span style={{ position: 'relative' }}>
                  Forum
                  {unreadForumPosts > 0 && (
                    <span className="forum-badge">{unreadForumPosts}</span>
                  )}
                </span>
              )}
            </Link>
            {!authLoading && user?.is_superuser && (
              <Link
                to="/admin"
                className={`nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
                onClick={() => {
                  if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
                }}
              >
                {leftSidebarOpen && <span>Admin</span>}
              </Link>
            )}
          </div>
          <div className="nav-section" data-onboarding="tournament">
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
            <Link
              to="/team-tournament"
              className={`nav-link ${location.pathname.startsWith('/team-tournament') && !location.pathname.startsWith('/team-tournament/test') ? 'active' : ''}`}
              onClick={() => {
                if (!isDesktop && !leftSidebarPinned) setLeftSidebarOpen(false);
              }}
            >
              {leftSidebarOpen && <span>Team Tournament</span>}
            </Link>
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
              data-onboarding="dashboard-link"
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
        <div className="sidebar-chat" data-onboarding="lobby-chat">
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

      {/* Onboarding Tour */}
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        showProgress
        showSkipButton
        callback={handleJoyrideCallback}
        scrollDuration={600}
        scrollOffset={20}
        scrollToFirstStep={false}
        styles={{
          options: {
            primaryColor: '#fbbf24', // yellow-400
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: 8,
          },
          buttonNext: {
            backgroundColor: '#fbbf24',
            color: '#000',
            fontSize: '14px',
            padding: '8px 16px',
          },
          buttonBack: {
            color: '#fbbf24',
            marginRight: '10px',
          },
          buttonSkip: {
            color: '#9ca3af',
          },
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip tour',
        }}
      />
    </div>
  );
};

export default Layout;

