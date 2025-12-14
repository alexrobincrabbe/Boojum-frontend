import { useState } from 'react';
import { toast } from 'react-toastify';

const NotificationsTab = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const handleToggle = () => {
    setNotificationsEnabled(!notificationsEnabled);
    // TODO: Call API to update notification settings when endpoint is available
    toast.success('Notification settings updated');
  };

  return (
    <div className="tab-content">
      <div className="notifications-content">
        <label className="switch">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={handleToggle}
          />
          <span className="slider"></span>
        </label>
        <span id="push-label">
          {notificationsEnabled ? 'Notifications On' : 'Notifications Off'}
        </span>
      </div>
    </div>
  );
};

export default NotificationsTab;


