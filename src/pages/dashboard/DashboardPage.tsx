import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationsTab from './components/NotificationsTab';
import AccountTab from './components/AccountTab';
import ChatSettingsTab from './components/ChatSettingsTab';
import PlaymatesTab from './components/PlaymatesTab';
import GameSettingsTab from './components/GameSettingsTab';
import { dashboardAPI } from '../../services/api';
import './DashboardPage.css';

type TabType = 'notifications' | 'account' | 'chat' | 'playmates' | 'game';

const DashboardPage = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('game');
  const [bundle, setBundle] = useState<any | null>(null);
  const [bundleLoading, setBundleLoading] = useState(true);

  // All tabs for authenticated users, only game settings for guests
  const allTabs = [
    { id: 'game' as TabType, label: 'Game Settings', guest: true },
    { id: 'notifications' as TabType, label: 'Push Notifications', guest: false },
    { id: 'account' as TabType, label: 'Account Details', guest: false },
    { id: 'chat' as TabType, label: 'Chat Settings', guest: false },
    { id: 'playmates' as TabType, label: 'Playmates', guest: false },
  ];

  const tabs = isAuthenticated 
    ? allTabs 
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
    loadBundle();
  }, []);

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
          <div className="dashboard-loading">
            <img src="/images/loading.gif" alt="Loading..." className="loading-gif" />
          </div>
        ) : (
          <>
            <div style={{ display: activeTab === 'game' ? 'block' : 'none' }}>
              <GameSettingsTab
                bundle={bundle?.game_settings}
                isAuthenticated={isAuthenticated}
              />
            </div>
            <div style={{ display: activeTab === 'notifications' ? 'block' : 'none' }}>
              <NotificationsTab />
            </div>
            <div style={{ display: activeTab === 'account' ? 'block' : 'none' }}>
              <AccountTab bundle={bundle?.account} />
            </div>
            <div style={{ display: activeTab === 'chat' ? 'block' : 'none' }}>
              <ChatSettingsTab bundle={bundle?.game_settings} />
            </div>
            <div style={{ display: activeTab === 'playmates' ? 'block' : 'none' }}>
              <PlaymatesTab bundle={bundle?.playmates} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;


