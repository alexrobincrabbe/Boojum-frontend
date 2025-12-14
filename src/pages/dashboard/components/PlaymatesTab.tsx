import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { dashboardAPI } from '../../../services/api';

interface Buddy {
  id: number;
  display_name: string;
  chat_color: string;
  online: string;
  playing: string;
  time_ago: string;
}

interface Activity {
  username: string;
  chat_color: string;
  description: string;
  timestamp_ago: string;
}

const PlaymatesTab = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [suggestions, setSuggestions] = useState<{ id: number; display_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await dashboardAPI.getDashboardData();
        setBuddies(data.buddies || []);
        setActivities(data.activities || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Error loading dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        return;
      }
      setSearchLoading(true);
      try {
        const response = await dashboardAPI.searchUsers(searchQuery);
        setSuggestions(response.results || []);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleAddBuddy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    try {
      const response = await dashboardAPI.addBuddy(searchQuery);
      toast.success(response.message || 'Buddy added successfully');
      setSearchQuery('');
      setSuggestions([]);
      // Refresh buddies list
      const data = await dashboardAPI.getDashboardData();
      setBuddies(data.buddies || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error adding buddy');
    }
  };

  const handleRemoveBuddy = async (buddyId: number) => {
    try {
      const response = await dashboardAPI.removeBuddy(buddyId);
      toast.success(response.message || 'Buddy removed successfully');
      // Refresh buddies list
      const data = await dashboardAPI.getDashboardData();
      setBuddies(data.buddies || []);
      setActivities(data.activities || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error removing buddy');
    }
  };

  const handleSelectSuggestion = (displayName: string) => {
    setSearchQuery(displayName);
    setSuggestions([]);
  };

  if (loading) {
    return (
      <div className="tab-content">
        <div className="dashboard-loading">
          <img src="/images/loading.gif" alt="Loading..." className="loading-gif" />
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="playmates-content">
        <div className="playmates-section">
          <form onSubmit={handleAddBuddy} id="buddy-form" className="short-form">
            <label htmlFor="buddy-search">Search Playmates:</label>
            <input
              type="text"
              id="buddy-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find playmate"
            />
            <button type="submit" className="dashboard-button">
              Add
            </button>
          </form>
          <div id="suggestions-box">
            {searchLoading && (
              <div id="loading-message">Searching...</div>
            )}
            {!searchLoading && suggestions.length > 0 && (
              <div id="suggestions">
                {suggestions.map((user) => (
                  <div
                    key={user.id}
                    className="suggestion-item"
                    onClick={() => handleSelectSuggestion(user.display_name)}
                  >
                    {user.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="playmates-list">
            {buddies.length > 0 ? (
              <ul className="no-bullet-list">
                {buddies.map((buddy) => (
                  <li key={buddy.id}>
                    <button
                      className="remove-buddy-button"
                      onClick={() => handleRemoveBuddy(buddy.id)}
                    >
                      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <rect x="0" y="0" width="100" height="100" rx="20" ry="20" fill="purple" stroke="pink" strokeWidth="5" />
                        <g transform="translate(25,25)">
                          <line x1="0" y1="0" x2="50" y2="50" stroke="blue" strokeWidth="10" />
                          <line x1="0" y1="50" x2="50" y2="0" stroke="blue" strokeWidth="10" />
                        </g>
                      </svg>
                    </button>
                    <div className="buddy-list-name" style={{ color: buddy.chat_color }}>
                      {buddy.display_name}
                    </div>
                    <div className="buddy-list-item">
                      {buddy.playing ? (
                        <>
                          <span className="dot green-background"></span>
                          <span className="green last-seen online">{buddy.playing}</span>
                        </>
                      ) : buddy.online === 'yes' ? (
                        <>
                          <span className="dot green-background"></span>
                          <span className="green last-seen online">Online</span>
                        </>
                      ) : (
                        <>
                          <span className="dot grey-background"></span>
                          <span className="last-seen">Online: {buddy.time_ago}</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>You don't have any playmates yet.</p>
            )}
          </div>
        </div>
        <div className="playmates-section">
          <h3>Activities</h3>
          <div className="activities-list">
            {activities.length > 0 ? (
              <ul>
                {activities.map((activity, index) => (
                  <li key={index}>
                    <p>
                      <strong style={{ color: activity.chat_color }}>
                        {activity.username}
                      </strong>{' '}
                      <span dangerouslySetInnerHTML={{ __html: activity.description }} />
                    </p>
                    <small className="time-stamp">{activity.timestamp_ago}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No activities to display.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaymatesTab;


