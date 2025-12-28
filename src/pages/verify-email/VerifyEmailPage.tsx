import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import './VerifyEmailPage.css';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const key = searchParams.get('key');
    
    if (!key) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email and try again.');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await authAPI.verifyEmail(key);
        // Auto-login user
        localStorage.setItem('access_token', response.access);
        localStorage.setItem('refresh_token', response.refresh);
        localStorage.setItem('user', JSON.stringify(response.user));
        setStatus('success');
        setMessage('Email verified successfully! Redirecting...');
        
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } catch (err: any) {
        setStatus('error');
        const errorMessage = err.response?.data?.error || err.response?.data?.detail || 'Email verification failed. Please try again.';
        setMessage(errorMessage);
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="verify-email-page">
      <div className="verify-email-card gradient-ring">
        {status === 'verifying' && (
          <>
            <h2 className="verify-email-title">Verifying Email</h2>
            <p className="verify-email-message">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <h2 className="verify-email-title success">Email Verified!</h2>
            <p className="verify-email-message success">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <h2 className="verify-email-title error">Verification Failed</h2>
            <p className="verify-email-message error">{message}</p>
            <button 
              onClick={() => navigate('/login')} 
              className="verify-email-button"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;

