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
    console.log('[NotificationsTab] useEffect triggered', {
      bundle,
      isInitialMount: isInitialMount.current,
      currentNotificationsEnabled: notificationsEnabled
    });

    const initFromBundle = () => {
      if (bundle && typeof bundle.push_notifications_enabled !== 'undefined') {
        const fetchedValue = bundle.push_notifications_enabled;
        console.log('[NotificationsTab] Initializing from bundle:', fetchedValue);
        
        // Only update if this is the initial mount
        if (isInitialMount.current) {
          setNotificationsEnabled(fetchedValue);
          initialNotificationsEnabled.current = fetchedValue;
          isInitialMount.current = false;
          setLoading(false);
        }
        return true;
      }
      return false;
    };

    if (initFromBundle()) {
      return; // Exit early on initial mount after setting from bundle
    }

    // Only fetch if bundle wasn't available and this is initial mount
    if (!isInitialMount.current) {
      return;
    }

    const fetchData = async () => {
      console.log('[NotificationsTab] Fetching push notifications status from API...');
      try {
        const data = await dashboardAPI.getPushNotificationsStatus();
        console.log('[NotificationsTab] API response:', data);
        const fetchedValue = data.push_notifications_enabled ?? false;
        console.log('[NotificationsTab] Setting notificationsEnabled to:', fetchedValue);
        setNotificationsEnabled(fetchedValue);
        initialNotificationsEnabled.current = fetchedValue;
        isInitialMount.current = false;
      } catch (error: any) {
        console.error('[NotificationsTab] Error fetching push notifications status:', error);
        console.error('[NotificationsTab] Error response:', error.response);
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


  // Helper function to convert VAPID key
  const urlBase64ToUint8Array = (base64String: string): BufferSource => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const handleToggle = async () => {
    console.log('[NotificationsTab] Toggle clicked', {
      currentValue: notificationsEnabled,
      newValue: !notificationsEnabled,
      isInitialMount: isInitialMount.current,
      initialValue: initialNotificationsEnabled.current
    });
    
    if (notificationsEnabled === null) return;

    const newValue = !notificationsEnabled;

    // If enabling, we need to request permission and create subscription
    if (newValue) {
      try {
        // Check if browser supports notifications
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          toast.error('Push notifications are not supported in this browser');
          return;
        }

        // Register service worker
        // Try /sw.js first (Vite public directory), fallback to /static/sw.js (Django)
        let registration;
        try {
          registration = await navigator.serviceWorker.register('/sw.js');
          console.log('[NotificationsTab] Service worker registered from /sw.js');
        } catch (error) {
          console.log('[NotificationsTab] Failed to register from /sw.js, trying /static/sw.js');
          registration = await navigator.serviceWorker.register('/static/sw.js');
          console.log('[NotificationsTab] Service worker registered from /static/sw.js');
        }

        // Request browser permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Notification permission denied');
          return;
        }

        // Get VAPID public key
        const vapidPublicKey = await dashboardAPI.getVapidPublicKey();
        console.log('[NotificationsTab] Got VAPID key');

        // Create subscription
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        console.log('[NotificationsTab] Subscription created:', subscription);

        // Save subscription to backend
        const subscriptionJson = subscription.toJSON();
        if (!subscriptionJson.endpoint) {
          throw new Error('Subscription endpoint is missing');
        }
        await dashboardAPI.savePushSubscription({
          endpoint: subscriptionJson.endpoint,
          expirationTime: subscriptionJson.expirationTime ?? null,
          keys: {
            p256dh: subscriptionJson.keys?.p256dh || '',
            auth: subscriptionJson.keys?.auth || '',
          },
        });
        console.log('[NotificationsTab] Subscription saved to backend');

        // Update state
        setNotificationsEnabled(true);
        initialNotificationsEnabled.current = true;
        toast.success('Notifications enabled successfully');
      } catch (error: any) {
        console.error('[NotificationsTab] Error enabling notifications:', error);
        toast.error(error.message || 'Failed to enable notifications');
      }
    } else {
      // If disabling, unsubscribe and remove from backend
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          // Unsubscribe locally
          await subscription.unsubscribe();
          
          // Remove from backend
          const subscriptionJson = subscription.toJSON();
          if (!subscriptionJson.endpoint) {
            throw new Error('Subscription endpoint is missing');
          }
          await dashboardAPI.removePushSubscription({
            endpoint: subscriptionJson.endpoint,
            expirationTime: subscriptionJson.expirationTime ?? null,
            keys: {
              p256dh: subscriptionJson.keys?.p256dh || '',
              auth: subscriptionJson.keys?.auth || '',
            },
          });
        }

        // Update backend status
        await dashboardAPI.updatePushNotificationsStatus(false);
        
        // Update state
        setNotificationsEnabled(false);
        initialNotificationsEnabled.current = false;
        toast.success('Notifications disabled');
      } catch (error: any) {
        console.error('[NotificationsTab] Error disabling notifications:', error);
        toast.error(error.message || 'Failed to disable notifications');
      }
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


