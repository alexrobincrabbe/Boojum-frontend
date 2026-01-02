import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
  Link,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BoardThemeProvider } from "./contexts/BoardThemeContext";
import { OnboardingProvider } from "./contexts/OnboardingContext";
import Layout from "./components/Layout";
import { useRouteActivityTracking } from "./hooks/useRouteActivityTracking";
import { ProfilePicture } from "./components/ProfilePicture";
import { authAPI } from "./services/api";
import { useState, useEffect } from "react";
import LoginPage from "./pages/login/LoginPage";
import RegisterPage from "./pages/register/RegisterPage";
import GoogleUsernamePageWrapper from "./pages/google-username/GoogleUsernamePageWrapper";
import VerifyEmailSentPage from "./pages/verify-email-sent/VerifyEmailSentPage";
import ForgotPasswordPage from "./pages/forgot-password/ForgotPasswordPage";
import ResetPasswordPage from "./pages/reset-password/ResetPasswordPage";
import VerifyEmailPage from "./pages/verify-email/VerifyEmailPage";
import ProfilePage from "./pages/profile/ProfilePage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import LobbyPage from "./pages/lobby/LobbyPage";
import GameRoom from "./pages/game-room/GameRoom";
import DailyBoardPage from "./pages/daily-boards/DailyBoardPage";
import DailyBoardGameRoom from "./pages/daily-boards/DailyBoardGameRoom";
import DailyBoardsArchivePage from "./pages/daily-boards/DailyBoardsArchivePage";
import DailyBoardArchiveDetailPage from "./pages/daily-boards/DailyBoardArchiveDetailPage";
import TimelessBoardPage from "./pages/timeless-boards/TimelessBoardPage";
import TimelessBoardGameRoom from "./pages/timeless-boards/TimelessBoardGameRoom";
import TimelessBoardsArchivePage from "./pages/timeless-boards/TimelessBoardsArchivePage";
import TimelessBoardArchiveDetailPage from "./pages/timeless-boards/TimelessBoardArchiveDetailPage";
import SavedBoardGameRoom from "./pages/saved-boards/SavedBoardGameRoom";
import LeaderboardsPage from "./pages/leaderboards/LeaderboardsPage";
import ForumPage from "./pages/forum/ForumPage";
import ViewPostPage from "./pages/forum/ViewPostPage";
import NewPostPage from "./pages/forum/NewPostPage";
import MinigamesPage from "./pages/minigames/MinigamesPage";
import DoodledumPage from "./pages/minigames/DoodledumPage";
import TournamentPage from "./pages/tournament/TournamentPage";
import TestTournamentPage from "./pages/tournament/TestTournamentPage";
import TournamentArchivesPage from "./pages/tournament/TournamentArchivesPage";
import MatchResultsPage from "./pages/tournament/MatchResultsPage";
import TournamentGameRoom from "./pages/tournament/TournamentGameRoom";
import TeamTournamentPage from "./pages/tournament/TeamTournamentPage";
import TeamTournamentGameRoom from "./pages/tournament/TeamTournamentGameRoom";
import TeamMatchResultsPage from "./pages/tournament/TeamMatchResultsPage";
import AdminPage from "./pages/admin/AdminPage";
import CreateCustomGameboardPage from "./pages/admin/CreateCustomGameboardPage";
import ConvertSpecialBoardsPage from "./pages/admin/ConvertSpecialBoardsPage";
import "./App.css";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react"

const HomePage = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [chatColor, setChatColor] = useState<string>('#71bbe9');

  useEffect(() => {
    const fetchProfile = async () => {
      if (isAuthenticated && user) {
        try {
          const profile = await authAPI.getProfile(user.username.toLowerCase());
          setProfilePictureUrl(profile.profile_picture_url);
          setProfileUrl(profile.profile_url);
          setChatColor(profile.chat_color || '#71bbe9');
        } catch (error) {
          // Profile might not exist yet, use defaults
          setProfilePictureUrl(null);
          setProfileUrl(user.username.toLowerCase());
        }
      }
    };

    if (isAuthenticated && user) {
      fetchProfile();
    }
  }, [isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <SpeedInsights />
      <Analytics />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-yellow-400">
          Welcome to Boojum Games!
        </h1>
        {isAuthenticated && user ? (
          <div className="home-page-content">
            <div className="home-page-welcome-section">
              <div className="home-page-profile-picture">
                <ProfilePicture
                  profilePictureUrl={profilePictureUrl}
                  profileUrl={profileUrl || undefined}
                  chatColor={chatColor}
                  size={80}
                  showBorder={true}
                />
              </div>
              <div className="home-page-welcome-text">
                <p className="home-page-signed-in">
                  You are signed in as <strong>{user.username}</strong>
                </p>
                <p className="home-page-game-time">
                  It's game time, let's play!
                </p>
              </div>
            </div>
            <div className="home-page-info-section">
              <p className="home-page-info-text">
                Go to your <Link to={`/profile/${profileUrl || user.username.toLowerCase()}`} className="home-page-link home-page-link-yellow">profile page</Link> to update your picture and share info about yourself.
              </p>
              <p className="home-page-info-text">
                Check out your <Link to="/dashboard" className="home-page-link home-page-link-green">dashboard</Link>, you can customise the game appearance, change your username colour and more.
              </p>
              <p className="home-page-info-text">
                Go to the <Link to="/lobby" className="home-page-link home-page-link-pink">live games page</Link>, or check out the daily challenges to start playing now.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-white mb-6">
            Welcome! You can browse the site as a guest or{" "}
            <Link to="/login" className="text-yellow-400 hover:underline">
              login
            </Link>{" "}
            to access your account.
          </p>
        )}
      </div>
    </div>
  );
};

const LayoutWrapper = () => {
  // Track route changes for online status
  useRouteActivityTracking();
  
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

function App() {
  return (
    <AuthProvider>
      <OnboardingProvider>
        <BoardThemeProvider>
          <Router>
          <Routes>
            <Route element={<LayoutWrapper />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/google-username" element={<GoogleUsernamePageWrapper />} />
              <Route path="/verify-email-sent" element={<VerifyEmailSentPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/profile/:profileUrl" element={<ProfilePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/lobby" element={<LobbyPage />} />
              <Route path="/daily-boards" element={<DailyBoardPage />} />
              <Route
                path="/daily-boards/play/:dailyBoardId"
                element={<DailyBoardGameRoom />}
              />
              <Route path="/daily-boards/archive" element={<DailyBoardsArchivePage />} />
              <Route
                path="/daily-boards/archive/:boardId"
                element={<DailyBoardArchiveDetailPage />}
              />
              <Route path="/timeless-boards" element={<TimelessBoardPage />} />
              <Route
                path="/timeless-boards/play/:timelessBoardId/:level"
                element={<TimelessBoardGameRoom />}
              />
              <Route path="/timeless-boards/archive" element={<TimelessBoardsArchivePage />} />
              <Route
                path="/timeless-boards/archive/:boardId/:level"
                element={<TimelessBoardArchiveDetailPage />}
              />
              <Route
                path="/saved-boards/play/:boardId"
                element={<SavedBoardGameRoom />}
              />
              <Route path="/leaderboards" element={<LeaderboardsPage />} />
              <Route path="/forum/new-post" element={<NewPostPage />} />
              <Route path="/forum/:slug" element={<ViewPostPage />} />
              <Route path="/forum" element={<ForumPage />} />
              <Route path="/minigames" element={<MinigamesPage />} />
              <Route path="/doodledum" element={<DoodledumPage />} />
              <Route path="/tournament" element={<TournamentPage />} />
              <Route path="/tournament/test" element={<TestTournamentPage />} />
              <Route path="/tournament/archives" element={<TournamentArchivesPage />} />
              <Route path="/tournament/match/:matchId" element={<MatchResultsPage />} />
              <Route path="/tournament/play/:matchId" element={<TournamentGameRoom />} />
              <Route path="/team-tournament" element={<TeamTournamentPage />} />
              <Route path="/team-tournament/test" element={<TeamTournamentPage tournamentType="test" />} />
              <Route path="/team-tournament/match/:matchId" element={<TeamMatchResultsPage />} />
              <Route path="/team-tournament/play/:matchId" element={<TeamTournamentGameRoom />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/create-custom-gameboard" element={<CreateCustomGameboardPage />} />
              <Route path="/admin/convert-special-boards" element={<ConvertSpecialBoardsPage />} />
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
          style={{ top: "80px" }}
          toastClassName="custom-toast"
        />
        </BoardThemeProvider>
      </OnboardingProvider>
    </AuthProvider>
  );
}

export default App;
