import { useLocation, Link } from 'react-router-dom';
import './VerifyEmailSentPage.css';

const VerifyEmailSentPage = () => {
  const location = useLocation();
  const email = location.state?.email || 'your email';

  return (
    <div className="verify-email-page">
      <div className="verify-email-card gradient-ring">
        <h2 className="verify-email-title">Check Your Email</h2>
        <p className="verify-email-subtitle">
          We've sent a verification link to <strong>{email}</strong>
        </p>
        
        <div className="verify-email-content">
          <p>
            Click the link in the email to verify your account and complete your registration.
          </p>
          
          <div className="verify-email-tips">
            <p><strong>Didn't receive the email?</strong></p>
            <ul>
              <li>Check your spam or junk folder</li>
              <li>Make sure you entered the correct email address</li>
              <li>Wait a few minutes and check again</li>
            </ul>
          </div>
          
          <p className="verify-email-contact">
            Still having trouble? Contact us at{' '}
            <a href="mailto:boojumgames@gmail.com" className="verify-email-link">
              boojumgames@gmail.com
            </a>
          </p>
        </div>

        <div className="verify-email-footer">
          <Link to="/login" className="verify-email-link">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailSentPage;

