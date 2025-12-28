import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './GoogleUsernamePage.css';

interface GoogleUsernamePageProps {
  email: string;
  googleId: string;
  googleName: string;
  accessToken: string;
}

const GoogleUsernamePage = ({ email, googleId, googleName: _googleName, accessToken }: GoogleUsernamePageProps) => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { completeGoogleRegistration } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    if (username.length > 15) {
      setError('Username must be 15 characters or less');
      return;
    }

    // Basic validation - alphanumeric, underscore, hyphen
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens');
      return;
    }

    setLoading(true);

    try {
      await completeGoogleRegistration(username, email, googleId, accessToken);
      // Clear registration data from sessionStorage
      sessionStorage.removeItem('google_registration');
      navigate('/');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.detail;
      if (Array.isArray(errorMessage)) {
        setError(errorMessage.join(', '));
      } else {
        setError(errorMessage || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="google-username-page">
      <div className="google-username-card gradient-ring">
        <h2 className="google-username-title">Choose Your Username</h2>
        <p className="google-username-subtitle">
          Welcome! Please choose a username for your Boojum account.
        </p>

        <form className="google-username-form" onSubmit={handleSubmit}>
          {error && <div className="google-username-error">{error}</div>}

          <label className="google-username-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            className="google-username-input"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={15}
            autoFocus
          />
          <div className="google-username-hint">
            Username must be 15 characters or less and can only contain letters, numbers, underscores, and hyphens.
          </div>

          <button type="submit" disabled={loading} className="google-username-button">
            {loading ? 'Creating account...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default GoogleUsernamePage;

