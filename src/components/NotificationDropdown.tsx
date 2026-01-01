import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import './NotificationDropdown.css';

interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  created_at: string;
  related_id: number | null;
  commenter_username?: string;
  commenter_profile_url?: string;
  commenter_chat_color?: string;
}

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  unreadCount: number;
  onNotificationsRead: () => void;
}

const NotificationDropdown = ({ isOpen, onClose, unreadCount, onNotificationsRead }: NotificationDropdownProps) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const prevIsOpenRef = useRef(isOpen);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadNotifications();
    }
  }, [isOpen, isAuthenticated]);

  // Mark notifications as read when closing (only when transitioning from open to closed)
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen && unreadCount > 0 && isAuthenticated) {
      onNotificationsRead();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, unreadCount, isAuthenticated, onNotificationsRead]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await authAPI.getNotifications();
      setNotifications(data.notifications || []);
    } catch (error: any) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const handleClearNotifications = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown from closing
    if (notifications.length === 0) return;
    
    if (!window.confirm('Are you sure you want to delete all notifications? This cannot be undone.')) {
      return;
    }
    
    try {
      await authAPI.deleteAllNotifications();
      setNotifications([]);
      onNotificationsRead(); // Update unread count
      // Optionally show a success message
    } catch (error: any) {
      console.error('Error deleting notifications:', error);
      // Optionally show an error message
    }
  };

  const renderNotificationMessage = (notification: Notification) => {
    // For notifications with user info, extract name from message and display with color
    // This includes: doodle_comment, doodle_reply, doodle_solved, forum_reply, board_shared, tournament_match
    if (notification.commenter_username) {
      // The message contains the display_name (or username), so extract the first word
      // Messages typically have format: "{display_name/username} ..."
      const words = notification.message.split(' ');
      const nameInMessage = words[0]; // This is the display_name or username from the message
      const restOfMessage = words.slice(1).join(' ');
      
      return (
        <>
          {notification.commenter_profile_url ? (
            <a
              href={`/profile/${notification.commenter_profile_url}`}
              className="notification-username-link"
              style={{ color: notification.commenter_chat_color || '#71bbe9' }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${notification.commenter_profile_url}`);
                onClose();
              }}
            >
              {nameInMessage}
            </a>
          ) : (
            <span
              className="notification-username"
              style={{ color: notification.commenter_chat_color || '#71bbe9' }}
            >
              {nameInMessage}
            </span>
          )}
          {' '}{restOfMessage}
        </>
      );
    }
    
    // For notifications without user info, just display the message
    return <>{notification.message}</>;
  };

  if (!isOpen) return null;

  return (
    <div className="notification-dropdown-overlay" onClick={onClose}>
      <div className="notification-dropdown" onClick={(e) => e.stopPropagation()}>
        <div className="notification-dropdown-header">
          <h3>Notifications</h3>
          {notifications.length > 0 && (
            <button
              className="notification-clear-button"
              onClick={handleClearNotifications}
              title="Clear all notifications"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="notification-dropdown-content">
          {loading ? (
            <div className="notification-loading">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">No notifications</div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="notification-item"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-item-content">
                    {!notification.read && <span className="notification-dot" />}
                    {notification.read && <span className="notification-dot-spacer" />}
                    <div className="notification-item-text">
                      <div className="notification-message">
                        {renderNotificationMessage(notification)}
                      </div>
                      <div className="notification-date">
                        {new Date(notification.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationDropdown;

