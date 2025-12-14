import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import NotificationsTab from './components/NotificationsTab';
import AccountTab from './components/AccountTab';
import ChatSettingsTab from './components/ChatSettingsTab';
import PlaymatesTab from './components/PlaymatesTab';
import GameSettingsTab from './components/GameSettingsTab';
import './DashboardPage.css';

type TabType = 'notifications' | 'account' | 'chat' | 'playmates' | 'game';

const DashboardPage = () => {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('game');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleTabChange = (tabId: TabType) => {
    if (tabId !== activeTab) {
      setIsLoading(true);
      setActiveTab(tabId);
      // Small delay to show loading animation
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>DASHBOARD</h1>
      </div>
      
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
        {isLoading ? (
          <div className="dashboard-loading">
            <img src="/images/loading.gif" alt="Loading..." className="loading-gif" />
          </div>
        ) : (
          <>
            {activeTab === 'game' && <GameSettingsTab />}
            {activeTab === 'notifications' && <NotificationsTab />}
            {activeTab === 'account' && <AccountTab />}
            {activeTab === 'chat' && <ChatSettingsTab />}
            {activeTab === 'playmates' && <PlaymatesTab />}
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;


