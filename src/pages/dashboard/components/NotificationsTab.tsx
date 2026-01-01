import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { dashboardAPI } from '../../../services/api';
import { Loading } from '../../../components/Loading';

interface NotificationsTabProps {
  bundle?: {
    push_notifications_enabled?: boolean;
    push_notification_settings?: {
      tournament_opponent_played: boolean;
      doodles_enabled: boolean;
      forum_replies_enabled: boolean;
      shared_boards_enabled: boolean;
    };
  } | null;
}

const NotificationsTab = ({ bundle }: NotificationsTabProps) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean | null>(null);
  const [categorySettings, setCategorySettings] = useState({
    tournament_opponent_played: false,
    doodles_enabled: false,
    forum_replies_enabled: false,
    shared_boards_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const isInitialMount = useRef(true);
  const initialNotificationsEnabled = useRef<boolean | null>(null);
  const initialCategorySettings = useRef<typeof categorySettings | null>(null);

  useEffect(() => {
    console.log('[NotificationsTab] useEffect triggered', {
      bundle,
      isInitialMount: isInitialMount.current,
      currentNotificationsEnabled: notificationsEnabled
    });

    const initFromBundle = () => {
      if (bundle) {
        const fetchedEnabled = bundle.push_notifications_enabled;
        const fetchedCategories = bundle.push_notification_settings;
        
        if (typeof fetchedEnabled !== 'undefined') {
          console.log('[NotificationsTab] Initializing enabled from bundle:', fetchedEnabled);
          if (isInitialMount.current || fetchedEnabled !== notificationsEnabled) {
            setNotificationsEnabled(fetchedEnabled);
            initialNotificationsEnabled.current = fetchedEnabled;
          }
        }
        
        if (fetchedCategories) {
          console.log('[NotificationsTab] Initializing categories from bundle:', fetchedCategories);
          if (isInitialMount.current || JSON.stringify(fetchedCategories) !== JSON.stringify(categorySettings)) {
            setCategorySettings(fetchedCategories);
            initialCategorySettings.current = fetchedCategories;
          }
        }
        
        if (isInitialMount.current) {
          isInitialMount.current = false;
          setLoading(false);
        }
        return true;
      }
      return false;
    };

    if (initFromBundle()) {
      return;
    }

    // Only fetch if bundle wasn't available and this is initial mount
    if (!isInitialMount.current) {
      return;
    }

    const fetchData = async () => {
      console.log('[NotificationsTab] Fetching dashboard data...');
      try {
        const data = await dashboardAPI.getPushNotificationsStatus();
        const fetchedEnabled = data.push_notifications_enabled ?? false;
        const fetchedCategories = data.categories ?? {
          tournament_matches: false,
          doodles: false,
          forum_replies: false,
          shared_boards: false,
        };
        
        console.log('[NotificationsTab] Fetched enabled value:', fetchedEnabled);
        setNotificationsEnabled(fetchedEnabled);
        initialNotificationsEnabled.current = fetchedEnabled;
        
        const categoryState = {
          tournament_opponent_played: fetchedCategories.tournament_matches ?? false,
          doodles_enabled: fetchedCategories.doodles ?? false,
          forum_replies_enabled: fetchedCategories.forum_replies ?? false,
          shared_boards_enabled: fetchedCategories.shared_boards ?? false,
        };
        
        console.log('[NotificationsTab] Fetched category settings:', categoryState);
        setCategorySettings(categoryState);
        initialCategorySettings.current = categoryState;
      } catch (error: any) {
        console.error('[NotificationsTab] Error fetching dashboard data:', error);
        toast.error(error.response?.data?.error || 'Error fetching notification settings');
        setNotificationsEnabled(false);
        initialNotificationsEnabled.current = false;
        setCategorySettings({
          tournament_opponent_played: false,
          doodles_enabled: false,
          forum_replies_enabled: false,
          shared_boards_enabled: false,
        });
        initialCategorySettings.current = {
          tournament_opponent_played: false,
          doodles_enabled: false,
          forum_replies_enabled: false,
          shared_boards_enabled: false,
        };
      } finally {
        isInitialMount.current = false;
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
      initialValue: initialNotificationsEnabled.current,
      userAgent: navigator.userAgent,
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushManagerSupported: 'PushManager' in window,
    });
    
    if (notificationsEnabled === null) return;

    const newValue = !notificationsEnabled;

    // Optimistic UI update - update state immediately
    setNotificationsEnabled(newValue);

    // If enabling, we need to request permission and create subscription
    if (newValue) {
      try {
        // Check if browser supports notifications
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          console.error('[NotificationsTab] Push notifications not supported');
          setNotificationsEnabled(false); // Revert optimistic update
          toast.error('Push notifications are not supported in this browser');
          return;
        }

        // Register service worker
        // Try /sw.js first (Vite public directory), fallback to /static/sw.js (Django)
        let registration;
        try {
          registration = await navigator.serviceWorker.register('/sw.js');
          console.log('[NotificationsTab] Service worker registered from /sw.js');
        } catch (error: any) {
          console.log('[NotificationsTab] Failed to register from /sw.js, trying /static/sw.js', error);
          try {
            registration = await navigator.serviceWorker.register('/static/sw.js');
            console.log('[NotificationsTab] Service worker registered from /static/sw.js');
          } catch (error2: any) {
            console.error('[NotificationsTab] Failed to register service worker from both locations', error2);
            setNotificationsEnabled(false); // Revert optimistic update
            toast.error('Failed to register service worker. Please check your connection and try again.');
            return;
          }
        }

        // Request browser permission
        let permission;
        try {
          permission = await Notification.requestPermission();
          console.log('[NotificationsTab] Notification permission:', permission);
        } catch (error: any) {
          console.error('[NotificationsTab] Error requesting notification permission', error);
          setNotificationsEnabled(false); // Revert optimistic update
          toast.error('Failed to request notification permission: ' + (error.message || 'Unknown error'));
          return;
        }
        
        if (permission !== 'granted') {
          console.warn('[NotificationsTab] Notification permission denied:', permission);
          setNotificationsEnabled(false); // Revert optimistic update
          toast.error('Notification permission denied. Please enable notifications in your browser settings.');
          return;
        }

        // Get VAPID public key
        let vapidPublicKey;
        try {
          vapidPublicKey = await dashboardAPI.getVapidPublicKey();
          console.log('[NotificationsTab] Got VAPID key');
        } catch (error: any) {
          console.error('[NotificationsTab] Error getting VAPID key', error);
          setNotificationsEnabled(false); // Revert optimistic update
          toast.error('Failed to get VAPID key: ' + (error.response?.data?.error || error.message || 'Unknown error'));
          return;
        }

        // Create subscription
        let subscription;
        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
          console.log('[NotificationsTab] Subscription created:', subscription);
        } catch (error: any) {
          console.error('[NotificationsTab] Error creating subscription', error);
          setNotificationsEnabled(false); // Revert optimistic update
          toast.error('Failed to create push subscription: ' + (error.message || 'Unknown error'));
          return;
        }

        // Save subscription to backend
        const subscriptionJson = subscription.toJSON();
        if (!subscriptionJson.endpoint) {
          console.error('[NotificationsTab] Subscription endpoint is missing');
          setNotificationsEnabled(false); // Revert optimistic update
          toast.error('Subscription endpoint is missing');
          return;
        }
        
        try {
          await dashboardAPI.savePushSubscription({
            endpoint: subscriptionJson.endpoint,
            expirationTime: subscriptionJson.expirationTime ?? null,
            keys: {
              p256dh: subscriptionJson.keys?.p256dh || '',
              auth: subscriptionJson.keys?.auth || '',
            },
          });
          console.log('[NotificationsTab] Subscription saved to backend');
        } catch (error: any) {
          console.error('[NotificationsTab] Error saving subscription to backend', error);
          setNotificationsEnabled(false); // Revert optimistic update
          toast.error('Failed to save subscription: ' + (error.response?.data?.error || error.message || 'Unknown error'));
          return;
        }
        
        // Automatically enable all categories when main switch is turned on
        const updatedCategories = {
          tournament_opponent_played: true,
          doodles_enabled: true,
          forum_replies_enabled: true,
          shared_boards_enabled: true,
        };
        setCategorySettings(updatedCategories);
        initialCategorySettings.current = updatedCategories;
        
        try {
          await dashboardAPI.updatePushNotificationCategories({
            tournament_matches: true,
            doodles: true,
            forum_replies: true,
            shared_boards: true,
          });
        } catch (error: any) {
          console.error('[NotificationsTab] Error updating categories (non-critical)', error);
          // Don't revert the main toggle if category update fails
        }
        
        // Confirm state
        initialNotificationsEnabled.current = true;
        toast.success('Notifications enabled successfully');
      } catch (error: any) {
        console.error('[NotificationsTab] Unexpected error enabling notifications', error);
        setNotificationsEnabled(false); // Revert optimistic update
        toast.error('Failed to enable notifications: ' + (error.message || 'Unknown error'));
      }
    } else {
      // If disabling, unsubscribe and remove from backend
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          try {
            // Unsubscribe locally
            await subscription.unsubscribe();
            
            // Remove from backend
            const subscriptionJson = subscription.toJSON();
            if (subscriptionJson.endpoint) {
              await dashboardAPI.removePushSubscription({
                endpoint: subscriptionJson.endpoint,
                expirationTime: subscriptionJson.expirationTime ?? null,
                keys: {
                  p256dh: subscriptionJson.keys?.p256dh || '',
                  auth: subscriptionJson.keys?.auth || '',
                },
              });
            }
          } catch (error: any) {
            console.error('[NotificationsTab] Error removing subscription (non-critical)', error);
            // Continue even if unsubscribe fails
          }
        }

        // Update backend status
        try {
          await dashboardAPI.updatePushNotificationsStatus(false);
        } catch (error: any) {
          console.error('[NotificationsTab] Error updating backend status', error);
          setNotificationsEnabled(true); // Revert optimistic update
          toast.error('Failed to update notification status: ' + (error.response?.data?.error || error.message || 'Unknown error'));
          return;
        }
        
        // Disable all categories when main switch is turned off
        const updatedCategories = {
          tournament_opponent_played: false,
          doodles_enabled: false,
          forum_replies_enabled: false,
          shared_boards_enabled: false,
        };
        setCategorySettings(updatedCategories);
        initialCategorySettings.current = updatedCategories;
        
        // Confirm state
        initialNotificationsEnabled.current = false;
        toast.success('Notifications disabled');
      } catch (error: any) {
        console.error('[NotificationsTab] Error disabling notifications', error);
        setNotificationsEnabled(true); // Revert optimistic update
        toast.error('Failed to disable notifications: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const handleCategoryToggle = async (category: keyof typeof categorySettings) => {
    if (notificationsEnabled === null || !notificationsEnabled) {
      return; // Do nothing if main notifications are off or loading
    }

    const newCategorySettings = {
      ...categorySettings,
      [category]: !categorySettings[category],
    };
    setCategorySettings(newCategorySettings); // Optimistic UI update

    try {
      const categoryMapping = {
        tournament_opponent_played: 'tournament_matches',
        doodles_enabled: 'doodles',
        forum_replies_enabled: 'forum_replies',
        shared_boards_enabled: 'shared_boards',
      } as const;
      
      const response = await dashboardAPI.updatePushNotificationCategories({
        [categoryMapping[category]]: newCategorySettings[category],
      });
      toast.success(response.message || `Notification for ${category.replace(/_/g, ' ')} updated!`);
      initialCategorySettings.current = newCategorySettings;
    } catch (error: any) {
      console.error(`[NotificationsTab] Error updating category ${category}:`, error);
      toast.error(error.response?.data?.error || `Error updating ${category.replace(/_/g, ' ')} notifications.`);
      setCategorySettings(initialCategorySettings.current || {
        tournament_opponent_played: false,
        doodles_enabled: false,
        forum_replies_enabled: false,
        shared_boards_enabled: false,
      }); // Revert on error
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
            onClick={(e) => {
              // Prevent double-firing on some browsers
              e.stopPropagation();
            }}
            disabled={notificationsEnabled === null}
          />
          <span className="slider"></span>
        </label>
        <span id="push-label">
          {notificationsEnabled === null ? 'Loading...' : (notificationsEnabled ? 'Notifications On' : 'Notifications Off')}
        </span>
      </div>

      <div className="notification-categories-section">
        <h3>Category Specific Notifications</h3>
        <div className="category-setting">
          <label className="switch">
            <input
              type="checkbox"
              checked={categorySettings.tournament_opponent_played}
              onChange={() => handleCategoryToggle('tournament_opponent_played')}
              disabled={!notificationsEnabled}
            />
            <span className="slider"></span>
          </label>
          <span>Tournament Matches</span>
        </div>
        <div className="category-setting">
          <label className="switch">
            <input
              type="checkbox"
              checked={categorySettings.doodles_enabled}
              onChange={() => handleCategoryToggle('doodles_enabled')}
              disabled={!notificationsEnabled}
            />
            <span className="slider"></span>
          </label>
          <span>Doodle Notifications (Comments, Replies, Solved)</span>
        </div>
        <div className="category-setting">
          <label className="switch">
            <input
              type="checkbox"
              checked={categorySettings.forum_replies_enabled}
              onChange={() => handleCategoryToggle('forum_replies_enabled')}
              disabled={!notificationsEnabled}
            />
            <span className="slider"></span>
          </label>
          <span>Forum Replies</span>
        </div>
        <div className="category-setting">
          <label className="switch">
            <input
              type="checkbox"
              checked={categorySettings.shared_boards_enabled}
              onChange={() => handleCategoryToggle('shared_boards_enabled')}
              disabled={!notificationsEnabled}
            />
            <span className="slider"></span>
          </label>
          <span>Shared Boards</span>
        </div>
      </div>
    </div>
  );
};

export default NotificationsTab;


