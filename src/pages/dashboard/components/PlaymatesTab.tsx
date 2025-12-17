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

interface PlaymatesBundle {
  buddies?: Buddy[];
}

const PlaymatesTab = ({ bundle }: { bundle?: PlaymatesBundle | null }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [suggestions, setSuggestions] = useState<{ id: number; display_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const initFromBundle = () => {
      if (bundle) {
        setBuddies(bundle.buddies || []);
        setLoading(false);
        return true;
      }
      return false;
    };

    if (initFromBundle()) return;

    const fetchData = async () => {
      try {
        const data = await dashboardAPI.getDashboardData();
        setBuddies(data.buddies || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Error loading dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [bundle]);

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
      const data = await dashboardAPI.getDashboardBundle();
      setBuddies(data.playmates?.buddies || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error adding buddy');
    }
  };

  const handleRemoveBuddy = async (buddyId: number) => {
    try {
      const response = await dashboardAPI.removeBuddy(buddyId);
      toast.success(response.message || 'Buddy removed successfully');
      // Refresh buddies list
      const data = await dashboardAPI.getDashboardBundle();
      setBuddies(data.playmates?.buddies || []);
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
                      style={{
                        border: '1px solid #eb5497',
                        borderRadius: '4px',
                        width: '28px',
                        height: '28px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        lineHeight: '1',
                      }}
                    >
                      <span
                        style={{
                          color: '#eb5497',
                          fontSize: '1.4rem',
                          fontWeight: 700,
                          lineHeight: '1',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        &times;
                      </span>
                    </button>
                    <div className="buddy-list-name" style={{ color: buddy.chat_color }}>
                      {buddy.display_name}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>You don't have any playmates yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaymatesTab;


