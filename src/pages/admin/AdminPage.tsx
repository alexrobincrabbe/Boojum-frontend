import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Gamepad2, Users, Plus } from 'lucide-react';
import './AdminPage.css';

const AdminPage = () => {
  const { user } = useAuth();

  if (!user?.is_superuser) {
    return (
      <div className="admin-page">
        <div className="page-container">
          <h1>Admin</h1>
          <p>You must be a superuser to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-container">
        <div className="admin-header">
          <Settings size={32} />
          <h1>Admin Dashboard</h1>
        </div>

        <div className="admin-sections">
          <div className="admin-section">
            <h2>
              <Gamepad2 size={24} />
              Game Management
            </h2>
            <div className="admin-links">
              <Link to="/admin/create-custom-gameboard" className="admin-link">
                <Plus size={20} />
                <div>
                  <div className="link-title">Create Custom Gameboard</div>
                  <div className="link-description">Create custom gameboards with automatic word list generation</div>
                </div>
              </Link>
              <Link to="/admin/convert-special-boards" className="admin-link">
                <Gamepad2 size={20} />
                <div>
                  <div className="link-title">Convert Special Boards</div>
                  <div className="link-description">Convert existing special boards to Daily or Timeless boards</div>
                </div>
              </Link>
            </div>
          </div>

          <div className="admin-section">
            <h2>
              <Users size={24} />
              Tournament Management
            </h2>
            <div className="admin-links">
              <Link to="/tournament/test" className="admin-link">
                <Gamepad2 size={20} />
                <div>
                  <div className="link-title">Test Tournament</div>
                  <div className="link-description">Access the test tournament page</div>
                </div>
              </Link>
              <Link to="/team-tournament/test" className="admin-link">
                <Users size={20} />
                <div>
                  <div className="link-title">Test Team Tournament</div>
                  <div className="link-description">Access the test team tournament page</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

