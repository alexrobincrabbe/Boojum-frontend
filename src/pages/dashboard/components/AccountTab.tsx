import { useState, useEffect } from 'react';
import { Loading } from '../../../components/Loading';
import { toast } from 'react-toastify';
import { dashboardAPI } from '../../../services/api';
import { useOnboarding } from '../../../contexts/OnboardingContext';

interface AccountBundle {
  email?: string;
  display_name?: string;
}

const AccountTab = ({ bundle }: { bundle?: AccountBundle | null }) => {
  const { resetOnboarding } = useOnboarding();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initFromBundle = () => {
      if (bundle) {
        setEmail(bundle.email || '');
        setDisplayName(bundle.display_name || '');
        setLoading(false);
        return true;
      }
      return false;
    };

    if (initFromBundle()) return;

    const fetchData = async () => {
      try {
        const data = await dashboardAPI.getDashboardData();
        setEmail(data.email || '');
        setDisplayName(data.display_name || '');
      } catch (error: any) {
        // Silently handle 401 errors (unauthorized) - user shouldn't see this tab anyway
        if (error.response?.status === 401) {
          setLoading(false);
          return;
        }
        console.error('Error fetching dashboard data:', error);
        toast.error('Error loading dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [bundle]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await dashboardAPI.updateEmail(email);
      toast.success(response.message || 'Email updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error updating email');
    }
  };

  const handleDisplayNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await dashboardAPI.updateDisplayName(displayName);
      toast.success(response.message || 'Display name updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error updating display name');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await dashboardAPI.changePassword(oldPassword, newPassword, confirmPassword);
      toast.success(response.message || 'Password changed successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Error changing password');
    }
  };

  if (loading) {
    return (
      <div className="tab-content">
        <Loading minHeight="400px" />
      </div>
    );
  }

  const handleRestartTour = () => {
    resetOnboarding();
    toast.success('Onboarding tour will start shortly');
  };

  return (
    <div className="tab-content">
      <div className="account-content">
        <div className="account-section" style={{ marginBottom: '20px' }}>
          <button
            onClick={handleRestartTour}
            className="dashboard-button"
            style={{ backgroundColor: '#fbbf24', color: '#000' }}
          >
            Restart Onboarding Tour
          </button>
        </div>
        <div className="account-section">
          <form onSubmit={handleEmailSubmit} className="short-form">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit" className="dashboard-button">
              Update
            </button>
          </form>
          <form onSubmit={handleDisplayNameSubmit} className="short-form">
            <label htmlFor="display-name">Display Name:</label>
            <input
              type="text"
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <button type="submit" className="dashboard-button">
              Update
            </button>
          </form>
        </div>
        <div className="account-section">
          <form onSubmit={handlePasswordSubmit} className="password-form">
            <div>
              <label htmlFor="old-password">Old Password:</label>
              <input
                type="password"
                id="old-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="new-password">New Password:</label>
              <input
                type="password"
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-password">Confirm Password:</label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="dashboard-button" id="change-password-button">
              Change Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountTab;


