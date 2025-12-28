import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../services/api';
import './ForgotPasswordPage.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      await authAPI.requestPasswordReset(email);
      setSuccess(true);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || 'Failed to send password reset email. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-card gradient-ring">
        <h2 className="forgot-password-title">Reset Password</h2>
        <p className="forgot-password-subtitle">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {success ? (
          <div className="forgot-password-success">
            <p>Password reset email sent!</p>
            <p>Please check your email for instructions to reset your password.</p>
            <p className="forgot-password-tips">
              <strong>Didn't receive the email?</strong>
              <br />
              Check your spam folder or try again in a few minutes.
            </p>
            <Link to="/login" className="forgot-password-link">
              Back to Login
            </Link>
          </div>
        ) : (
          <form className="forgot-password-form" onSubmit={handleSubmit}>
            {error && <div className="forgot-password-error">{error}</div>}

            <label className="forgot-password-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="forgot-password-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button type="submit" disabled={loading} className="forgot-password-button">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="forgot-password-footer">
              <Link to="/login" className="forgot-password-link">
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

