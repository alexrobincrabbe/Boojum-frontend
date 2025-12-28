import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './RegisterPage.css';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== password2) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await register(username, email, password, password2);
      // Registration successful - redirect to email verification page
      navigate('/verify-email-sent', { state: { email } });
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

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      // If username is required, navigate to username selection page
      if (result && 'username_required' in result && result.username_required) {
        // Store registration data in sessionStorage temporarily
        sessionStorage.setItem('google_registration', JSON.stringify(result));
        navigate('/google-username');
      } else {
        // User already exists, login complete
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Google login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-card gradient-ring">
        <h2 className="register-title">Sign up</h2>
        <p className="register-subtitle">Create your Boojum account</p>

        <form className="register-form" onSubmit={handleSubmit}>
          {error && <div className="register-error">{error}</div>}

          <label className="register-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            className="register-input"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={15}
          />

          <label className="register-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="register-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="register-label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="register-input"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <label className="register-label" htmlFor="password2">
            Confirm Password
          </label>
          <input
            id="password2"
            name="password2"
            type="password"
            required
            className="register-input"
            placeholder="Confirm Password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />

          <button type="submit" disabled={loading} className="register-button">
            {loading ? 'Creating account...' : 'Sign up'}
          </button>

          <div className="google-divider">
            <span>or</span>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="google-button"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <g fill="none" fillRule="evenodd">
                <path d="M17.64 9.2045c0-.6371-.0573-1.2516-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7955 2.7164v2.2581h2.9087c1.7023-1.5678 2.6832-3.874 2.6832-6.6149z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2582c-.806.5664-1.8373.9-3.0477.9-2.34 0-4.32-1.58-5.0318-3.7045H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
                <path d="M3.9682 10.5573c-.2-.6-.3145-1.2409-.3145-1.9091 0-.6682.1145-1.3091.3145-1.9091V4.4068H.9573C.3482 5.6068 0 7.0636 0 8.6482c0 1.5845.3482 3.0414.9573 4.2409l3.0109-2.3318z" fill="#FBBC05"/>
                <path d="M9 3.5795c1.3214 0 2.5082.4541 3.4409 1.3459l2.5814-2.5818C13.4632.8918 11.4264 0 9 0 5.4818 0 2.4382 2.0168.9573 4.4068L3.9682 7.7386C4.68 5.6141 6.66 3.5795 9 3.5795z" fill="#EA4335"/>
              </g>
            </svg>
            Continue with Google
          </button>

          <div className="register-footer">
            <span>Already have an account?</span>{' '}
            <Link to="/login" className="register-link">
              Sign in here
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
