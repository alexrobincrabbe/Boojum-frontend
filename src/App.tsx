import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BoardThemeProvider } from './contexts/BoardThemeContext';
import Layout from './components/Layout';
import LoginPage from './pages/login/LoginPage';
import RegisterPage from './pages/register/RegisterPage';
import ProfilePage from './pages/profile/ProfilePage';
import DashboardPage from './pages/dashboard/DashboardPage';
import LobbyPage from './pages/lobby/LobbyPage';
import GameRoom from './pages/game-room/GameRoom';
import DailyBoardPage from './pages/daily-boards/DailyBoardPage';
import DailyBoardGameRoom from './pages/daily-boards/DailyBoardGameRoom';
import './App.css';

const HomePage = () => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-yellow-400">Welcome to Boojum Games!</h1>
        {isAuthenticated ? (
          <>
            <p className="text-white mb-6">
              You are successfully logged in with JWT authentication.
            </p>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="font-semibold mb-4 text-yellow-400">User Information:</h3>
              <p className="text-white"><strong>ID:</strong> {user?.id}</p>
              <p className="text-white"><strong>Username:</strong> {user?.username}</p>
              <p className="text-white"><strong>Email:</strong> {user?.email}</p>
            </div>
          </>
        ) : (
          <p className="text-white mb-6">
            Welcome! You can browse the site as a guest or <a href="/login" className="text-yellow-400 hover:underline">login</a> to access your account.
          </p>
        )}
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const LayoutWrapper = () => {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <BoardThemeProvider>
        <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<LayoutWrapper />}>
            <Route path="/profile/:profileUrl" element={<ProfilePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/lobby" element={<LobbyPage />} />
            <Route path="/daily-boards" element={<DailyBoardPage />} />
            <Route path="/daily-boards/play/:dailyBoardId" element={<DailyBoardGameRoom />} />
            <Route path="/rooms/guest/:roomId/" element={<GameRoom />} />
            <Route path="/" element={<HomePage />} />
          </Route>
        </Routes>
      </Router>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        style={{ top: '80px' }}
        toastClassName="custom-toast"
      />
      </BoardThemeProvider>
    </AuthProvider>
  );
}

export default App;
