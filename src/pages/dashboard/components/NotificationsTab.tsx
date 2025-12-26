import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { dashboardAPI } from '../../../services/api';
import { Loading } from '../../../components/Loading';

interface NotificationsTabProps {
  bundle?: {
    push_notifications_enabled?: boolean;
  } | null;
}

const NotificationsTab = ({ bundle }: NotificationsTabProps) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitialMount = useRef(true);
  const initialNotificationsEnabled = useRef<boolean | null>(null);

  useEffect(() => {
    const initFromBundle = () => {
      if (bundle && typeof bundle.push_notifications_enabled !== 'undefined') {
        const fetchedValue = bundle.push_notifications_enabled;
        setNotificationsEnabled(fetchedValue);
        initialNotificationsEnabled.current = fetchedValue;
        isInitialMount.current = false;
        setLoading(false);
        return true;
      }
      return false;
    };

    if (initFromBundle()) return;

    const fetchData = async () => {
      try {
        const data = await dashboardAPI.getDashboardData();
        const fetchedValue = data.push_notifications_enabled ?? false;
        setNotificationsEnabled(fetchedValue);
        initialNotificationsEnabled.current = fetchedValue;
        isInitialMount.current = false;
      } catch (error: any) {
        console.error('Error fetching dashboard data:', error);
        // Default to false if fetch fails
        setNotificationsEnabled(false);
        initialNotificationsEnabled.current = false;
        isInitialMount.current = false;
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [bundle]);

  // Auto-save when notification setting changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current || notificationsEnabled === null || notificationsEnabled === initialNotificationsEnabled.current) {
      return;
    }
    
    const saveSettings = async () => {
      try {
        // TODO: Call API to update notification settings when endpoint is available
        // For now, just update local state
        initialNotificationsEnabled.current = notificationsEnabled;
        toast.success(`Notifications ${notificationsEnabled ? 'enabled' : 'disabled'}`);
      } catch (error: any) {
        toast.error(error.response?.data?.error || 'Error updating notification settings');
        // Revert on error
        setNotificationsEnabled(initialNotificationsEnabled.current);
      }
    };

    saveSettings();
  }, [notificationsEnabled]);

  const handleToggle = () => {
    if (notificationsEnabled !== null) {
      setNotificationsEnabled(!notificationsEnabled);
    }
  };

  if (loading) {
    return (
      <div className="tab-content">
        <Loading minHeight="400px" />
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="notifications-content">
        <label className="switch">
          <input
            type="checkbox"
            checked={notificationsEnabled ?? false}
            onChange={handleToggle}
            disabled={notificationsEnabled === null}
          />
          <span className="slider"></span>
        </label>
        <span id="push-label">
          {notificationsEnabled === null ? 'Loading...' : (notificationsEnabled ? 'Notifications On' : 'Notifications Off')}
        </span>
      </div>
    </div>
  );
};

export default NotificationsTab;


