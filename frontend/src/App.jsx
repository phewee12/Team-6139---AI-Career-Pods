import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { getCurrentUser, logoutUser } from "./api/client";
import DashboardPage from "./pages/DashboardPage";
import AuthPage from "./pages/AuthPage";
import ProfileSetupPage from "./pages/ProfileSetupPage";
import "./App.css";

function hasCompletedProfile(user) {
  return Boolean(user?.fieldOfStudy && user?.careerStage && user?.targetTimeline);
}

function destinationForUser(user) {
  if (!user) return "/auth";
  if (!hasCompletedProfile(user)) return "/profile-setup";
  return "/dashboard";
}

function OAuthCallback({ onAuthenticated }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Verifying sign-in...");

  useEffect(() => {
    let cancelled = false;

    async function resolveSession() {
      try {
        const result = await getCurrentUser();
        if (!cancelled) {
          onAuthenticated(result.user);
          navigate(destinationForUser(result.user), { replace: true });
        }
      } catch {
        if (!cancelled) {
          setStatus("Could not verify your Google sign-in. Please try again.");
        }
      }
    }

    resolveSession();

    return () => {
      cancelled = true;
    };
  }, [navigate, onAuthenticated]);

  return (
    <main className="loader-screen">
      <div className="loader-panel">
        <p>{status}</p>
      </div>
    </main>
  );
}

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapSession() {
      try {
        const result = await getCurrentUser();
        if (!cancelled) {
          setCurrentUser(result.user);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrapSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const homeDestination = useMemo(() => destinationForUser(currentUser), [currentUser]);

  async function handleLogout() {
    await logoutUser();
    setCurrentUser(null);
  }

  if (loading) {
    return (
      <main className="loader-screen">
        <div className="loader-panel">
          <p>Loading your workspace...</p>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/auth"
        element={
          currentUser ? (
            <Navigate to={homeDestination} replace />
          ) : (
            <AuthPage onAuthenticated={setCurrentUser} />
          )
        }
      />
      <Route
        path="/auth/callback"
        element={<OAuthCallback onAuthenticated={setCurrentUser} />}
      />
      <Route
        path="/profile-setup"
        element={
          currentUser ? (
            hasCompletedProfile(currentUser) ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <ProfileSetupPage user={currentUser} onSaved={setCurrentUser} />
            )
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
      <Route
        path="/dashboard"
        element={
          currentUser ? (
            hasCompletedProfile(currentUser) ? (
              <DashboardPage user={currentUser} onLogout={handleLogout} />
            ) : (
              <Navigate to="/profile-setup" replace />
            )
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to={homeDestination} replace />} />
    </Routes>
  );
}

export default App;
