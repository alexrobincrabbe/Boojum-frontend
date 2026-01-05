import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { premiumAPI } from '../../services/api';
import { toast } from 'react-toastify';
import { Loading } from '../../components/Loading';
import './CreateCustomRoomPage.css';

interface CustomRoom {
  id?: number;
  name: string;
  slug?: string;
  timer: number;
  intermission: number;
  bonus: boolean;
  one_shot: boolean;
  word_level: number;
  language: string;
  use_special_boards: boolean;
  only_special_boards: boolean;
  visibility: string;
  color: string;
  description: string;
  board_size?: number;
}

const CreateCustomRoomPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [customRoom, setCustomRoom] = useState<CustomRoom | null>(null);
  const [customRoomLoading, setCustomRoomLoading] = useState(true);
  const [customRoomFormData, setCustomRoomFormData] = useState<CustomRoom>({
    name: '',
    timer: 90,
    intermission: 45,
    bonus: false,
    one_shot: false,
    word_level: 10,
    language: 'en',
    use_special_boards: false,
    only_special_boards: false,
    visibility: 'public',
    color: '#5e4cb0',
    description: '',
    board_size: 4,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is premium
    const isPremium = user?.is_premium || false;
    if (isPremium) {
      loadCustomRoom();
    } else {
      setCustomRoomLoading(false);
    }
  }, [user]);

  const loadCustomRoom = async () => {
    try {
      setCustomRoomLoading(true);
      const data = await premiumAPI.getCustomRoom();
      if (data.room) {
        setCustomRoom(data.room);
        setCustomRoomFormData({
          name: data.room.name,
          timer: data.room.timer,
          intermission: data.room.intermission,
          bonus: data.room.bonus,
          one_shot: data.room.one_shot,
          word_level: data.room.word_level,
          language: data.room.language,
          use_special_boards: data.room.use_special_boards || false,
          only_special_boards: data.room.only_special_boards || false,
          visibility: data.room.visibility,
          color: data.room.color,
          description: data.room.description || '',
          board_size: data.room.board_size || 4,
        });
      } else {
        setCustomRoom(null);
      }
    } catch (error: any) {
      console.error('Error loading custom room:', error);
      if (error.response?.status !== 403) {
        toast.error('Failed to load custom room');
      }
    } finally {
      setCustomRoomLoading(false);
    }
  };

  const handleCustomRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await premiumAPI.createOrUpdateCustomRoom(customRoomFormData);
      setCustomRoom(data.room);
      setSuccess(data.message || 'Custom room saved successfully!');
      toast.success(data.message || 'Custom room saved successfully!');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to save custom room. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!user?.is_premium) {
    return (
      <div className="custom-room-page">
        <div className="custom-room-content">
          <h2 className="custom-room-title">Create Custom Room</h2>
          <div className="premium-required-message">
            <p>You need a premium subscription to create custom rooms.</p>
            <p>Please visit the Premium tab in your Dashboard to subscribe.</p>
          </div>
        </div>
      </div>
    );
  }

  if (customRoomLoading) {
    return (
      <div className="custom-room-page">
        <Loading minHeight="400px" />
      </div>
    );
  }

  return (
    <div className="custom-room-page">
      <div className="custom-room-content">
        <h2 className="custom-room-title">Create Custom Room</h2>
        <p className="section-description">
          Create your own custom game room with personalized settings. Each premium user can create exactly one custom room.
        </p>
        
        <form onSubmit={handleCustomRoomSubmit} className="custom-room-form">
          <div className="form-group">
            <label htmlFor="room-name">Room Name *</label>
            <input
              id="room-name"
              type="text"
              value={customRoomFormData.name}
              onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, name: e.target.value })}
              required
              maxLength={50}
              placeholder="Enter room name"
            />
          </div>

          <div className="form-row">
            <div className="form-group custom-room-timer-group">
              <label htmlFor="custom-room-timer" className="custom-room-label">Time Limit (seconds) *</label>
              <input
                id="custom-room-timer"
                className="custom-room-timer-input"
                type="number"
                min="20"
                max="600"
                value={customRoomFormData.timer}
                onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, timer: parseInt(e.target.value) || 90 })}
                required
              />
              <small className="custom-room-help-text">Minimum: 20s, Maximum: 600s (10 minutes)</small>
            </div>

            <div className="form-group custom-room-intermission-group">
              <label htmlFor="custom-room-intermission" className="custom-room-label">Intermission (seconds) *</label>
              <input
                id="custom-room-intermission"
                className="custom-room-intermission-input"
                type="number"
                min="10"
                max="180"
                value={customRoomFormData.intermission}
                onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, intermission: parseInt(e.target.value) || 45 })}
                required
              />
              <small className="custom-room-help-text">Minimum: 10s, Maximum: 180s (3 minutes)</small>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="word-level">Word Level *</label>
              <select
                id="word-level"
                value={customRoomFormData.word_level === 4 ? 'curious' : customRoomFormData.word_level === 7 ? 'curiouser' : 'rabbit hole'}
                onChange={(e) => {
                  const levelMap: Record<string, number> = {
                    'curious': 4,
                    'curiouser': 7,
                    'rabbit hole': 10,
                  };
                  setCustomRoomFormData({ ...customRoomFormData, word_level: levelMap[e.target.value] || 10 });
                }}
                required={customRoomFormData.language === 'en'}
                disabled={customRoomFormData.language !== 'en'}
              >
                <option value="curious">Curious</option>
                <option value="curiouser">Curiouser</option>
                <option value="rabbit hole">Rabbit Hole</option>
              </select>
              <small>
                {customRoomFormData.language === 'en' 
                  ? 'Curious = common words, Curiouser = more words, Rabbit Hole = all words'
                  : 'Word level is only available for English'}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="language">Language *</label>
              <select
                id="language"
                value={customRoomFormData.language}
                onChange={(e) => {
                  const newLanguage = e.target.value;
                  setCustomRoomFormData({ 
                    ...customRoomFormData, 
                    language: newLanguage,
                    // Reset word_level to default when switching to non-English
                    word_level: newLanguage === 'en' ? customRoomFormData.word_level : 10,
                    // Reset special boards to exclude when switching to non-English
                    use_special_boards: newLanguage === 'en' ? customRoomFormData.use_special_boards : false,
                    only_special_boards: newLanguage === 'en' ? customRoomFormData.only_special_boards : false,
                  });
                }}
                required
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="board-size">Board Size *</label>
              <select
                id="board-size"
                value={customRoomFormData.board_size || 4}
                onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, board_size: parseInt(e.target.value) || 4 })}
                required
              >
                <option value="4">4x4 (Standard)</option>
                <option value="5">5x5 (Big Board)</option>
              </select>
              <small>Choose the size of the game board</small>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="color">Room Color *</label>
            <select
              id="color"
              value={customRoomFormData.color}
              onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, color: e.target.value })}
              required
            >
              <option value="#33c15b">Green</option>
              <option value="#eb5497">Pink</option>
              <option value="#f5ce45">Yellow</option>
              <option value="#5e4cb0">Purple</option>
              <option value="grey">Grey</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="visibility">Visibility *</label>
            <select
              id="visibility"
              value={customRoomFormData.visibility}
              onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, visibility: e.target.value })}
              required
            >
              <option value="public">Public - Everyone can see</option>
              <option value="playmates_only">Playmates Only - Only your playmates can see</option>
            </select>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={customRoomFormData.bonus}
                onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, bonus: e.target.checked })}
              />
              Use Bonus Tiles
            </label>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={customRoomFormData.one_shot}
                onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, one_shot: e.target.checked })}
              />
              One Shot Room
            </label>
          </div>

          <div className="form-group custom-room-special-boards-group">
            <label className="custom-room-special-boards-label">Special Boards</label>
            <div className="custom-room-special-boards-options">
              <label className="custom-room-radio-label">
                <input
                  type="radio"
                  name="special_boards"
                  className="custom-room-radio-input"
                  checked={!customRoomFormData.use_special_boards && !customRoomFormData.only_special_boards}
                  onChange={() => setCustomRoomFormData({ ...customRoomFormData, use_special_boards: false, only_special_boards: false })}
                  disabled={customRoomFormData.language !== 'en'}
                />
                <span>Exclude Special Boards (default)</span>
              </label>
              <label className="custom-room-radio-label">
                <input
                  type="radio"
                  name="special_boards"
                  className="custom-room-radio-input"
                  checked={customRoomFormData.use_special_boards && !customRoomFormData.only_special_boards}
                  onChange={() => setCustomRoomFormData({ ...customRoomFormData, use_special_boards: true, only_special_boards: false })}
                  disabled={customRoomFormData.language !== 'en'}
                />
                <span>Include Special Boards (mix with regular boards)</span>
              </label>
              <label className="custom-room-radio-label">
                <input
                  type="radio"
                  name="special_boards"
                  className="custom-room-radio-input"
                  checked={customRoomFormData.only_special_boards}
                  onChange={() => setCustomRoomFormData({ ...customRoomFormData, use_special_boards: true, only_special_boards: true })}
                  disabled={customRoomFormData.language !== 'en'}
                />
                <span>Only Special Boards (exclusively use special boards)</span>
              </label>
            </div>
            {customRoomFormData.language !== 'en' && (
              <small className="custom-room-help-text">Special boards are only available for English</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={customRoomFormData.description}
              onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, description: e.target.value })}
              maxLength={400}
              rows={3}
              placeholder="Optional room description"
            />
          </div>

          <button
            type="submit"
            className="custom-room-button"
            disabled={loading || customRoomLoading}
          >
            {loading ? 'Saving...' : customRoom ? 'Update Custom Room' : 'Create Custom Room'}
          </button>
        </form>

        {/* Error and Success Messages */}
        {error && (
          <div className="custom-room-message error-message">
            {error}
          </div>
        )}
        {success && (
          <div className="custom-room-message success-message">
            {success}
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateCustomRoomPage;
