import React, { useEffect, useState } from "react";

import DashboardPage from "./pages/DashboardPage";
import EventsPage from "./pages/EventsPage";
import AnnouncementsPage from "./pages/AnnouncementsPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AttendeeWorkspace from "./pages/AttendeeWorkspace";
import StaffCheckInPage from "./pages/StaffCheckInPage";
import UsersPage from "./pages/UsersPage";
import ProfilePage from "./pages/ProfilePage";
import { getCurrentUser, login } from "./services/api";

export const TOKEN_STORAGE_KEY = "event_manager_access_token";
const MANAGEMENT_ROLES = new Set(["ADMIN", "ORGANIZER"]);

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(token));
  const [authError, setAuthError] = useState("");
  const [activeView, setActiveView] = useState("analytics");
  const [authView, setAuthView] = useState("login");

  const clearAuth = (message = "") => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setCurrentUser(null);
    setAuthView("login");
    setAuthError(typeof message === "string" ? message : "");
    setAuthLoading(false);
    setActiveView("analytics");
  };

  useEffect(() => {
    if (!token || currentUser) return undefined;
    const controller = new AbortController();
    setAuthLoading(true);

    getCurrentUser(token, controller.signal)
      .then((user) => {
        setCurrentUser(user);
        setAuthError("");
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        sessionStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken(null);
        setCurrentUser(null);
        setAuthError(error.status === 0 ? error.message : "Your session has expired. Please sign in again.");
      })
      .finally(() => setAuthLoading(false));

    return () => controller.abort();
  }, [token, currentUser]);

  const handleLogin = async (email, password) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const auth = await login(email, password);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, auth.access_token);
      const user = await getCurrentUser(auth.access_token);
      setToken(auth.access_token);
      setCurrentUser(user);
      return true;
    } catch (error) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setCurrentUser(null);
      setAuthError(
        error.status === 401 ? "Invalid email or password." : error.message || "Unable to sign in.",
      );
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  if (authLoading && token && !currentUser) {
    return (
      <main className="centered-page" aria-live="polite">
        <div className="app-loader" />
        <p>Restoring your session...</p>
      </main>
    );
  }

  if (!token || !currentUser) {
    if (authView === "register") return <RegisterPage onSignIn={() => { setAuthView("login"); setAuthError(""); }} />;
    return <LoginPage onLogin={handleLogin} onRegister={() => { setAuthView("register"); setAuthError(""); }} loading={authLoading} error={authError} />;
  }

  if (activeView === "profile") {
    return <ProfilePage token={token} currentUser={currentUser} onUserUpdated={setCurrentUser} onBack={() => setActiveView("analytics")} onLogout={clearAuth} onUnauthorized={clearAuth}/>;
  }

  if (currentUser.role === "ATTENDEE") {
    return <AttendeeWorkspace token={token} currentUser={currentUser} onLogout={clearAuth} onUnauthorized={clearAuth} onProfile={() => setActiveView("profile")} />;
  }

  if (currentUser.role === "STAFF") {
    return <StaffCheckInPage token={token} currentUser={currentUser} onLogout={clearAuth} onUnauthorized={clearAuth} onProfile={() => setActiveView("profile")} />;
  }

  if (!MANAGEMENT_ROLES.has(currentUser.role)) {
    return (
      <main className="centered-page">
        <section className="access-card">
          <span className="access-icon" aria-hidden="true">!</span>
          <p className="eyebrow">ACCESS RESTRICTED</p>
          <h1>Access denied</h1>
          <p>You do not have permission to view analytics.</p>
          <button type="button" className="primary-button" onClick={clearAuth}>Logout</button>
        </section>
      </main>
    );
  }

  if (activeView === "announcements") {
    return <AnnouncementsPage token={token} currentUser={currentUser} onLogout={clearAuth} onUnauthorized={clearAuth} activeView={activeView} onViewChange={setActiveView} />;
  }

  if (activeView === "events") {
    return <EventsPage token={token} currentUser={currentUser} onLogout={clearAuth} onUnauthorized={clearAuth} activeView={activeView} onViewChange={setActiveView} />;
  }

  if (activeView === "users" && currentUser.role === "ADMIN") {
    return <UsersPage token={token} currentUser={currentUser} onLogout={clearAuth} onUnauthorized={clearAuth} activeView={activeView} onViewChange={setActiveView} />;
  }

  return (
    <DashboardPage
      token={token}
      currentUser={currentUser}
      onLogout={clearAuth}
      onUnauthorized={clearAuth}
      activeView={activeView}
      onViewChange={setActiveView}
    />
  );
}

export default App;
