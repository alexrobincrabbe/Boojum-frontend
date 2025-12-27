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

  const renderNotificationMessage = (notification: Notification) => {
    // For comment/reply notifications, extract username and display with color
    if (notification.notification_type === 'doodle_comment' || notification.notification_type === 'doodle_reply' || notification.notification_type === 'doodle_solved') {
      if (notification.commenter_username) {
        const messageParts = notification.message.split(notification.commenter_username);
        const beforeUsername = messageParts[0];
        const afterUsername = messageParts.slice(1).join(notification.commenter_username);
        
        return (
          <>
            {beforeUsername}
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
                {notification.commenter_username}
              </a>
            ) : (
              <span
                className="notification-username"
                style={{ color: notification.commenter_chat_color || '#71bbe9' }}
              >
                {notification.commenter_username}
              </span>
            )}
            {afterUsername}
          </>
        );
      }
    }
    
    // For other notifications, just display the message
    return <>{notification.message}</>;
  };

  if (!isOpen) return null;

  return (
    <div className="notification-dropdown-overlay" onClick={onClose}>
      <div className="notification-dropdown" onClick={(e) => e.stopPropagation()}>
        <div className="notification-dropdown-header">
          <h3>Notifications</h3>
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

