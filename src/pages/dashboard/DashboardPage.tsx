import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';
import NotificationsTab from './components/NotificationsTab';
import AccountTab from './components/AccountTab';
import ChatSettingsTab from './components/ChatSettingsTab';
import PlaymatesTab from './components/PlaymatesTab';
import GameSettingsTab from './components/GameSettingsTab';
import SavedBoardsTab from './components/SavedBoardsTab';
import PremiumTab from './components/PremiumTab';
import { dashboardAPI } from '../../services/api';
import { Loading } from '../../components/Loading';
import './DashboardPage.css';

type TabType = 'notifications' | 'account' | 'chat' | 'playmates' | 'game' | 'saved-boards' | 'premium';

const DashboardPage = () => {
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(isAuthenticated ? 'saved-boards' : 'game');
  const [bundle, setBundle] = useState<any | null>(null);
  const [bundleLoading, setBundleLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(user);

  // Check if user is superuser - use currentUser state which gets refreshed
  const isSuperuser = currentUser?.is_superuser === true;
  
  // Update currentUser when user prop changes
  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    }
  }, [user]);

  // All tabs for authenticated users, only game settings for guests
  const allTabs = [
    { id: 'saved-boards' as TabType, label: 'Saved Boards', guest: false, superuser: false },
    { id: 'game' as TabType, label: 'Game Settings', guest: true, superuser: false },
    { id: 'notifications' as TabType, label: 'Push Notifications', guest: false, superuser: false },
    { id: 'account' as TabType, label: 'Account Details', guest: false, superuser: false },
    { id: 'chat' as TabType, label: 'Chat Settings', guest: false, superuser: false },
    { id: 'playmates' as TabType, label: 'Playmates', guest: false, superuser: false },
    { id: 'premium' as TabType, label: 'Premium', guest: false, superuser: true },
  ];

  const tabs = isAuthenticated 
    ? allTabs.filter(tab => !tab.superuser || isSuperuser)
    : allTabs.filter(tab => tab.guest);

  useEffect(() => {
    const loadBundle = async () => {
      try {
        const data = await dashboardAPI.getDashboardBundle();
        setBundle(data);
      } catch (error) {
        console.error('Error loading dashboard bundle', error);
      } finally {
        setBundleLoading(false);
      }
    };
    
    // Refresh user info to ensure is_superuser is up to date
    const refreshUserInfo = async () => {
      if (isAuthenticated) {
        try {
          const userInfo = await authAPI.getUserInfo();
          // Update localStorage with fresh user info
          localStorage.setItem('user', JSON.stringify(userInfo));
          // Update component state
          setCurrentUser(userInfo);
        } catch (error) {
          console.error('Error refreshing user info', error);
        }
      }
    };
    
    // Check URL parameters to open premium tab
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('tab') === 'premium') {
      setActiveTab('premium');
    }
    
    loadBundle();
    refreshUserInfo();
  }, [isAuthenticated]);

  const handleTabChange = (tabId: TabType) => {
    if (tabId !== activeTab) {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`dashboard-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="dashboard-content">
        {bundleLoading ? (
          <Loading minHeight="400px" />
        ) : (
          <>
            {activeTab === 'game' && (
              <GameSettingsTab
                bundle={bundle?.game_settings}
                isAuthenticated={isAuthenticated}
              />
            )}
            {isAuthenticated && activeTab === 'notifications' && (
              <NotificationsTab bundle={bundle?.notifications} />
            )}
            {isAuthenticated && activeTab === 'account' && (
              <AccountTab bundle={bundle?.account} />
            )}
            {isAuthenticated && activeTab === 'chat' && (
              <ChatSettingsTab bundle={bundle?.game_settings} />
            )}
            {isAuthenticated && activeTab === 'playmates' && (
              <PlaymatesTab bundle={bundle?.playmates} />
            )}
            {isAuthenticated && activeTab === 'saved-boards' && (
              <SavedBoardsTab />
            )}
            {isAuthenticated && isSuperuser && activeTab === 'premium' && (
              <PremiumTab />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;


