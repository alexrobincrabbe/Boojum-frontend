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
                  className={`notification-item ${!notification.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-item-content">
                    {!notification.read && <span className="notification-dot" />}
                    <div className="notification-item-text">
                      <div className="notification-item-header">
                        <span className="notification-title">{notification.title}</span>
                      </div>
                      <div className="notification-message">{notification.message}</div>
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

