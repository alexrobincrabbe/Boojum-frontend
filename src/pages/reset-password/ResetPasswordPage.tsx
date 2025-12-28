import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../../services/api';
import './ResetPasswordPage.css';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);

  const uidb64 = searchParams.get('uidb64');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!uidb64 || !token) {
      setError('Invalid reset link. Please request a new password reset.');
      setValidating(false);
    } else {
      setValidating(false);
    }
  }, [uidb64, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== newPassword2) {
      setError('Passwords do not match');
      return;
    }

    if (!uidb64 || !token) {
      setError('Invalid reset link');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.resetPassword(uidb64, token, newPassword, newPassword2);
      // Auto-login with new password
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      localStorage.setItem('user', JSON.stringify(response.user));
      navigate('/');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || 'Password reset failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-card gradient-ring">
          <p className="reset-password-loading">Validating reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-page">
      <div className="reset-password-card gradient-ring">
        <h2 className="reset-password-title">Reset Password</h2>
        <p className="reset-password-subtitle">
          Enter your new password below.
        </p>

        <form className="reset-password-form" onSubmit={handleSubmit}>
          {error && <div className="reset-password-error">{error}</div>}

          <label className="reset-password-label" htmlFor="newPassword">
            New Password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            className="reset-password-input"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <label className="reset-password-label" htmlFor="newPassword2">
            Confirm New Password
          </label>
          <input
            id="newPassword2"
            name="newPassword2"
            type="password"
            required
            className="reset-password-input"
            placeholder="Confirm new password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
          />

          <button type="submit" disabled={loading} className="reset-password-button">
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>

          <div className="reset-password-footer">
            <Link to="/login" className="reset-password-link">
              Back to Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;

