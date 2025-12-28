import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { premiumAPI } from '../../../services/api';
import './PremiumTab.css';

const PremiumTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState(false);
  const [donationAmount, setDonationAmount] = useState(5);
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Check for success/cancelled parameters from Stripe redirect
    const premiumParam = searchParams.get('premium');
    const donationParam = searchParams.get('donation');
    
    if (premiumParam === 'success') {
      setSuccess('🎉 Your premium subscription is now active! Thank you for subscribing.');
      // Remove the parameter from URL
      searchParams.delete('premium');
      setSearchParams(searchParams, { replace: true });
      // Refresh premium status
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
      setPremiumStatus(status.is_premium);
    } catch (error) {
      console.error('Error loading premium status:', error);
    }
  };

  useEffect(() => {
    // Load premium status on mount
    loadPremiumStatus();
  }, []);

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

