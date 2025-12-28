import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GoogleUsernamePage from './GoogleUsernamePage';

const GoogleUsernamePageWrapper = () => {
  const navigate = useNavigate();

  // Get registration data from sessionStorage
  const registrationDataStr = sessionStorage.getItem('google_registration');
  
  useEffect(() => {
    if (!registrationDataStr) {
      // No registration data, redirect to login
      navigate('/login');
      return;
    }

    try {
      const registrationData = JSON.parse(registrationDataStr);
      
      if (!registrationData.username_required || !registrationData.email || !registrationData.google_id || !registrationData.access_token) {
        // Invalid data, redirect to login
        navigate('/login');
      }
    } catch (error) {
      // Error parsing data, redirect to login
      navigate('/login');
    }
  }, [navigate, registrationDataStr]);

  if (!registrationDataStr) {
    return null;
  }

  try {
    const registrationData = JSON.parse(registrationDataStr);
    
    if (!registrationData.username_required || !registrationData.email || !registrationData.google_id || !registrationData.access_token) {
      return null;
    }

    return (
      <GoogleUsernamePage
        email={registrationData.email}
        googleId={registrationData.google_id}
        googleName={registrationData.google_name || ''}
        accessToken={registrationData.access_token}
      />
    );
  } catch (error) {
    return null;
  }
};

export default GoogleUsernamePageWrapper;

