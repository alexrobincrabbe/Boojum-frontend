import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authAPI } from '../services/api';

interface User {
  id: number;
  username: string;
  email: string;
  is_superuser?: boolean;
  is_premium?: boolean;
}

interface GoogleRegistrationData {
  username_required: boolean;
  email: string;
  google_id: string;
  google_name: string;
  access_token: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, password2: string) => Promise<void>;
  loginWithGoogle: () => Promise<GoogleRegistrationData | void>;
  completeGoogleRegistration: (username: string, email: string, googleId: string, accessToken: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const storedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('access_token');

      if (storedUser && accessToken) {
        try {
          // Verify token is still valid by fetching user info
          const userInfo = await authAPI.getUserInfo();
          setUser(userInfo);
        } catch (error) {
          // Token invalid, clear storage
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authAPI.login(username, password);
    localStorage.setItem('access_token', response.access);
    localStorage.setItem('refresh_token', response.refresh);
    // Fetch full user info to get is_superuser and other fields
    try {
      const userInfo = await authAPI.getUserInfo();
      localStorage.setItem('user', JSON.stringify(userInfo));
      setUser(userInfo);
    } catch (error) {
      // Fallback to response.user if getUserInfo fails
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
    }
  };

  const register = async (username: string, email: string, password: string, password2: string) => {
    const response = await authAPI.register(username, email, password, password2);
    // Registration now requires email verification - don't auto-login
    return response;
  };

  const loginWithGoogle = async (): Promise<GoogleRegistrationData | void> => {
    // Load Google Identity Services script
    return new Promise<GoogleRegistrationData | void>((resolve, reject) => {
      // Check if script is already loaded
      if (window.google?.accounts?.oauth2) {
        handleGoogleSignIn(resolve, reject);
        return;
      }

      // Load the script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        handleGoogleSignIn(resolve, reject);
      };
      script.onerror = () => {
        reject(new Error('Failed to load Google Identity Services'));
      };
      document.head.appendChild(script);
    });
  };

  const handleGoogleSignIn = async (
    resolve: (value: GoogleRegistrationData | void) => void,
    reject: (error: any) => void
  ) => {
    try {
      // Get Google Client ID from backend
      const clientId = await authAPI.getGoogleClientId();

      // Use OAuth 2.0 token client - this will use a popup if available
      let tokenResponseReceived = false;
      
      if (!window.google?.accounts?.oauth2) {
        reject(new Error('Google Identity Services not loaded'));
        return;
      }
      
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'email profile',
        callback: async (response: any) => {
          if (tokenResponseReceived) return;
          tokenResponseReceived = true;
          
          try {
            if (response.error) {
              reject(new Error(response.error));
              return;
            }
            
            if (!response.access_token) {
              reject(new Error('No access token received'));
              return;
            }
            
            const loginResponse = await authAPI.googleLogin(response.access_token);
            
            // Check if username is required
            if (loginResponse.username_required) {
              // Return registration data so caller can show username selection
              resolve(loginResponse as GoogleRegistrationData);
              return;
            }
            
            // User already exists, complete login
            localStorage.setItem('access_token', loginResponse.access);
            localStorage.setItem('refresh_token', loginResponse.refresh);
            localStorage.setItem('user', JSON.stringify(loginResponse.user));
            setUser(loginResponse.user);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      });

      // Request access token - this opens a popup
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (error) {
      reject(error);
    }
  };

  const completeGoogleRegistration = async (
    username: string,
    email: string,
    googleId: string,
    accessToken: string
  ) => {
    const response = await authAPI.googleCompleteRegistration(username, email, googleId, accessToken);
    localStorage.setItem('access_token', response.access);
    localStorage.setItem('refresh_token', response.refresh);
    localStorage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    completeGoogleRegistration,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

