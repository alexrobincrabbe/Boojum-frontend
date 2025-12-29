import {
  BrowserRouter as Router,
  Routes,
  Route,
  Outlet,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { BoardThemeProvider } from "./contexts/BoardThemeContext";
import Layout from "./components/Layout";
import { useRouteActivityTracking } from "./hooks/useRouteActivityTracking";
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
import "./App.css";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react"

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
      <SpeedInsights />
      <Analytics />
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-yellow-400">
          Welcome to Boojum Games!
        </h1>
        {isAuthenticated ? (
          <>
            <p className="text-white mb-6">
              You are successfully logged in with JWT authentication.
            </p>
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <h3 className="font-semibold mb-4 text-yellow-400">
                User Information:
              </h3>
              <p className="text-white">
                <strong>ID:</strong> {user?.id}
              </p>
              <p className="text-white">
                <strong>Username:</strong> {user?.username}
              </p>
              <p className="text-white">
                <strong>Email:</strong> {user?.email}
              </p>
            </div>
          </>
        ) : (
          <p className="text-white mb-6">
            Welcome! You can browse the site as a guest or{" "}
            <a href="/login" className="text-yellow-400 hover:underline">
              login
            </a>{" "}
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
    </AuthProvider>
  );
}

export default App;
