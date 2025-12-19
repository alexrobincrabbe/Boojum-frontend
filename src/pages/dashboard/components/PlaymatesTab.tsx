import { useState, useEffect } from 'react';
import { Loading } from '../../../components/Loading';
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
  filter_online_playmates_only?: boolean;
}

const PlaymatesTab = ({ bundle }: { bundle?: PlaymatesBundle | null }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [suggestions, setSuggestions] = useState<{ id: number; display_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filterOnlinePlaymatesOnly, setFilterOnlinePlaymatesOnly] = useState(false);

  useEffect(() => {
    const initFromBundle = () => {
      if (bundle) {
        setBuddies(bundle.buddies || []);
        setFilterOnlinePlaymatesOnly(bundle.filter_online_playmates_only || false);
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
      } catch (error: any) {
        // Silently handle 401 errors (unauthorized) - user shouldn't see this tab anyway
        if (error.response?.status === 401) {
          setLoading(false);
          return;
        }
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

  const handleFilterToggle = async (checked: boolean) => {
    try {
      await dashboardAPI.updatePlaymatesFilter(checked);
      setFilterOnlinePlaymatesOnly(checked);
      toast.success('Filter setting updated');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error updating filter setting');
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
      <div className="playmates-content">
        <div className="playmates-section">
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: 'rgba(19, 19, 42, 0.5)', borderRadius: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={filterOnlinePlaymatesOnly}
                onChange={(e) => handleFilterToggle(e.target.checked)}
                style={{ display: 'none' }}
              />
              <span
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '50px',
                  height: '24px',
                  backgroundColor: filterOnlinePlaymatesOnly ? '#33A17E' : '#ccc',
                  borderRadius: '12px',
                  transition: 'background-color 0.3s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: filterOnlinePlaymatesOnly ? '26px' : '2px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    transition: 'left 0.3s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </span>
              <span style={{ color: '#fff', fontSize: '0.9rem' }}>
                Filter online users to show only playmates
              </span>
            </label>
          </div>
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


