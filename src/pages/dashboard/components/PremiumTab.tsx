import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { premiumAPI } from '../../../services/api';
import { toast } from 'react-toastify';
import './PremiumTab.css';

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
}

const PremiumTab = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  // Initialize premium status from user context or localStorage to prevent layout shift
  const getInitialPremiumStatus = (): boolean => {
    if (user?.is_premium !== undefined) {
      return user.is_premium;
    }
    // Fallback to localStorage if user context not loaded yet
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.is_premium !== undefined) {
          return parsedUser.is_premium;
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }
    return false;
  };
  const [premiumStatus, setPremiumStatus] = useState(getInitialPremiumStatus());
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null>(null);
  const [donationAmount, setDonationAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Custom room state
  const [customRoom, setCustomRoom] = useState<CustomRoom | null>(null);
  const [customRoomLoading, setCustomRoomLoading] = useState(false);
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
  });

  useEffect(() => {
    // Check for success/cancelled parameters from Stripe redirect
    const premiumParam = searchParams.get('premium');
    const donationParam = searchParams.get('donation');
    
    if (premiumParam === 'success') {
      setSuccess('🎉 Your premium subscription is now active! Thank you for subscribing.');
      // Remove the parameter from URL
      searchParams.delete('premium');
      setSearchParams(searchParams, { replace: true });
      // Set premium status immediately to prevent layout shift
      setPremiumStatus(true);
      // Refresh premium status to get subscription details
      loadPremiumStatus();
    } else if (premiumParam === 'cancelled') {
      setError('Subscription was cancelled. No charges were made.');
      searchParams.delete('premium');
      setSearchParams(searchParams, { replace: true });
    }
    
    if (donationParam === 'success') {
      setSuccess('Thank you for your donation! Your support helps us keep Boojum Games running.');
      searchParams.delete('donation');
      setSearchParams(searchParams, { replace: true });
    } else if (donationParam === 'cancelled') {
      setError('Donation was cancelled. No charges were made.');
      searchParams.delete('donation');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const loadPremiumStatus = async () => {
    try {
      const status = await premiumAPI.getPremiumStatus();
      console.log('Premium status response:', status);
      setPremiumStatus(status.is_premium);
      if (status.subscription) {
        console.log('Subscription info:', status.subscription);
        setSubscriptionInfo(status.subscription);
      } else {
        console.log('No subscription info in response');
      }
      // Update user context if available (to keep it in sync)
      if (status.is_premium !== user?.is_premium) {
        // The user context will be updated when getUserInfo is called elsewhere
        // For now, we just update local state
      }
    } catch (error) {
      console.error('Error loading premium status:', error);
    }
  };

  useEffect(() => {
    // Initialize from user context or localStorage to prevent layout shift
    const initializePremiumStatus = () => {
      if (user?.is_premium !== undefined) {
        setPremiumStatus(user.is_premium);
      } else {
        // Fallback to localStorage if user context not loaded yet
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            if (parsedUser.is_premium !== undefined) {
              setPremiumStatus(parsedUser.is_premium);
            }
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      }
    };
    
    initializePremiumStatus();
    // Load premium status on mount to get subscription details
    loadPremiumStatus();
  }, [user]);

  // Load custom room if premium
  useEffect(() => {
    if (premiumStatus) {
      loadCustomRoom();
    }
  }, [premiumStatus]);

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

  const handleSubscribe = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { checkout_url } = await premiumAPI.createSubscriptionCheckout();
      // Redirect to Stripe Checkout
      window.location.href = checkout_url;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create subscription. Please try again.');
      setLoading(false);
    }
  };

  const handleDonate = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    const amount = customAmount ? parseFloat(customAmount) : donationAmount;
    
    if (isNaN(amount) || amount < 1) {
      setError('Please enter a valid donation amount (minimum $1)');
      setLoading(false);
      return;
    }

    try {
      const { checkout_url } = await premiumAPI.createDonationCheckout(amount);
      // Redirect to Stripe Checkout
      window.location.href = checkout_url;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create donation. Please try again.');
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const { portal_url } = await premiumAPI.createCustomerPortal();
      // Redirect to Stripe Customer Portal
      window.location.href = portal_url;
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load subscription management. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="premium-tab">
      <div className="premium-content">
        <h2 className="premium-title">Premium & Donations</h2>
        
        {/* Premium Subscription Section */}
        <div className="premium-section">
          <h3 className="section-title">Premium Subscription</h3>
          <div className="premium-status">
            <p className="status-label">Current Status:</p>
            <span className={`status-badge ${premiumStatus ? 'premium-active' : 'premium-inactive'}`}>
              {premiumStatus ? 'Premium Active' : 'Not Premium'}
            </span>
          </div>
          
          {!premiumStatus && (
            <div className="premium-benefits">
              <p className="benefits-title">Premium Benefits:</p>
              <ul className="benefits-list">
                <li>Unlimited saved boards</li>
                <li>Priority support</li>
                <li>Exclusive premium features</li>
                <li>Ad-free experience</li>
              </ul>
              <button
                className="premium-button subscribe-button"
                onClick={handleSubscribe}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Subscribe to Premium'}
              </button>
            </div>
          )}
          
          {premiumStatus && (
            <div className="premium-active-message">
              <p>Thank you for being a premium member! 🎉</p>
              
              {subscriptionInfo && subscriptionInfo.current_period_end ? (
                <div className="subscription-details">
                  {subscriptionInfo.cancel_at_period_end ? (
                    <p className="subscription-warning">
                      ⚠️ Your subscription will expire on{' '}
                      <strong>{new Date(subscriptionInfo.current_period_end).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</strong>
                    </p>
                  ) : (
                    <p className="subscription-info">
                      Your subscription renews on{' '}
                      <strong>{new Date(subscriptionInfo.current_period_end).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <div className="subscription-details">
                  <p className="subscription-info">
                    Subscription details are being loaded...
                  </p>
                </div>
              )}
              
              <button
                className="premium-button manage-subscription-button"
                onClick={handleManageSubscription}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Manage Subscription'}
              </button>
            </div>
          )}
        </div>

        {/* Custom Room Section - Only for premium users */}
        {premiumStatus && (
          <div className="premium-section">
            <h3 className="section-title">Create Custom Room</h3>
            <p className="section-description">
              Create your own custom game room with personalized settings. Each premium user can create exactly one custom room.
            </p>
            
            {customRoomLoading ? (
              <div>Loading custom room...</div>
            ) : (
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
                    <input
                      id="word-level"
                      type="number"
                      min="1"
                      max="10"
                      value={customRoomFormData.word_level}
                      onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, word_level: parseInt(e.target.value) || 10 })}
                      required
                    />
                    <small>1 = most common words, 10 = all words (default)</small>
                  </div>

                  <div className="form-group">
                    <label htmlFor="language">Language *</label>
                    <select
                      id="language"
                      value={customRoomFormData.language}
                      onChange={(e) => setCustomRoomFormData({ ...customRoomFormData, language: e.target.value })}
                      required
                    >
                      <option value="en">English</option>
                    </select>
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
                      />
                      <span>Only Special Boards (exclusively use special boards)</span>
                    </label>
                  </div>
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
                  className="premium-button"
                  disabled={loading || customRoomLoading}
                >
                  {loading ? 'Saving...' : customRoom ? 'Update Custom Room' : 'Create Custom Room'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Donation Section */}
        <div className="premium-section">
          <h3 className="section-title">Support Boojum Games</h3>
          <p className="donation-description">
            Help us keep Boojum Games running and improving! Your donations help us maintain servers, 
            develop new features, and provide the best gaming experience.
          </p>
          
          <div className="donation-options">
            <div className="donation-amounts">
              {[5, 10, 25, 50].map((amount) => (
                <button
                  key={amount}
                  className={`donation-amount-button ${donationAmount === amount ? 'selected' : ''}`}
                  onClick={() => {
                    setDonationAmount(amount);
                    setCustomAmount('');
                  }}
                >
                  ${amount}
                </button>
              ))}
            </div>
            
            <div className="custom-amount">
              <label htmlFor="custom-amount">Custom Amount:</label>
              <div className="custom-amount-input">
                <span className="currency-symbol">$</span>
                <input
                  id="custom-amount"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    if (e.target.value) {
                      setDonationAmount(0);
                    }
                  }}
                />
              </div>
            </div>
            
            <button
              className="premium-button donate-button"
              onClick={handleDonate}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Donate $${customAmount || donationAmount}`}
            </button>
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="premium-message error-message">
            {error}
          </div>
        )}
        {success && (
          <div className="premium-message success-message">
            {success}
          </div>
        )}
      </div>
    </div>
  );
};

export default PremiumTab;

