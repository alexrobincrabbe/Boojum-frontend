import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { dashboardAPI } from '../../../services/api';
import { useBoardTheme } from '../../../contexts/BoardThemeContext';
import { BoardPreview } from './BoardPreview';
import './GameSettingsTab.css';

const GameSettingsTab = () => {
  const [profanityFilter, setProfanityFilter] = useState(true); // Default to true
  const [loading, setLoading] = useState(true);
  const isInitialMount = useRef(true);
  const initialProfanityFilter = useRef(true); // Default to true
  
  const { darkMode, colorsOff, toggleDarkMode, toggleColors } = useBoardTheme();
  
  // Wrapper functions to add toast messages
  const handleToggleDarkMode = () => {
    const newMode = !darkMode;
    toggleDarkMode();
    toast.success(`Board theme switched to ${newMode ? 'dark' : 'light'} mode`);
  };
  
  const handleToggleColors = () => {
    const newColorsOff = !colorsOff;
    toggleColors();
    toast.success(`Highlight colors ${newColorsOff ? 'disabled (grey mode)' : 'enabled (color mode)'}`);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Only fetch profanity filter if user is authenticated
        const token = localStorage.getItem('access_token');
        if (token) {
          const data = await dashboardAPI.getDashboardData();
          const fetchedFilter = data.profanity_filter ?? true;
          setProfanityFilter(fetchedFilter);
          initialProfanityFilter.current = fetchedFilter;
          // Store in localStorage so Chat component can read it
          localStorage.setItem('profanityFilter', fetchedFilter.toString());
        } else {
          // For guests, use localStorage or default to true
          const stored = localStorage.getItem('profanityFilter');
          const filterValue = stored !== null ? stored === 'true' : true; // Default to true if not set
          setProfanityFilter(filterValue);
          initialProfanityFilter.current = filterValue;
        }
        isInitialMount.current = false;
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // For guests, just use localStorage or default to true
        const stored = localStorage.getItem('profanityFilter');
        const filterValue = stored !== null ? stored === 'true' : true; // Default to true if not set
        setProfanityFilter(filterValue);
        initialProfanityFilter.current = filterValue;
        isInitialMount.current = false;
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Auto-save when profanity filter changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current || profanityFilter === initialProfanityFilter.current) {
      return;
    }
    
    const saveSettings = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        // Authenticated user - save to backend
        try {
          const data = await dashboardAPI.getDashboardData();
          const chatColor = data.chat_color || '#E38614';
          const response = await dashboardAPI.updateChatSettings(chatColor, profanityFilter);
          // Use the value returned from backend to ensure consistency
          const updatedFilter = response?.profanity_filter ?? profanityFilter;
          // Update both the ref and state to keep them in sync
          initialProfanityFilter.current = updatedFilter;
          // Always update state with the backend value to ensure UI consistency
          setProfanityFilter(updatedFilter);
          // Store in localStorage so Chat component can read it
          localStorage.setItem('profanityFilter', updatedFilter.toString());
          toast.success(`Profanity filter ${updatedFilter ? 'enabled' : 'disabled'}`);
        } catch (error: any) {
          toast.error(error.response?.data?.error || 'Error updating profanity filter');
          // Revert to previous value on error
          setProfanityFilter(initialProfanityFilter.current);
        }
      } else {
        // Guest - save to localStorage
        localStorage.setItem('profanityFilter', profanityFilter.toString());
        toast.success(`Profanity filter ${profanityFilter ? 'enabled' : 'disabled'}`);
      }
    };

    saveSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profanityFilter]);

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
      <div className="game-settings-content">
        <div className="game-settings-section">
          <h3>Chat Settings</h3>
          <label htmlFor="profanity-filter" className="switch-label">
            <span>Profanity Filter</span>
            <label className="switch">
              <input
                type="checkbox"
                id="profanity-filter"
                checked={profanityFilter}
                onChange={(e) => setProfanityFilter(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </label>
          <p className="setting-description">
            Filter profanity from chat messages.
          </p>
        </div>

        <div className="board-settings-container">
          <div className="board-settings-controls">
            <div className="game-settings-section">
              <h3>Board Theme</h3>
              <label htmlFor="theme-toggle" className="switch-label">
                <span>Light Mode</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    id="theme-toggle"
                    checked={darkMode === false}
                    onChange={handleToggleDarkMode}
                  />
                  <span className="slider"></span>
                </label>
              </label>
              <p className="setting-description">
                Switch between dark and light board mode. Changes board background, text color, tiles colors, and border.
              </p>
            </div>

            <div className="game-settings-section">
              <h3>Highlight Colors</h3>
              <label htmlFor="color-toggle" className="switch-label">
                <span>Grey Mode</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    id="color-toggle"
                    checked={colorsOff}
                    onChange={handleToggleColors}
                  />
                  <span className="slider"></span>
                </label>
              </label>
              <p className="setting-description">
                When enabled, shows only grey highlights instead of pink and yellow. Green highlights are still shown.
              </p>
            </div>
          </div>
          <div className="board-preview-wrapper-container">
            <BoardPreview />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameSettingsTab;

