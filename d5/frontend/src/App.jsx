import { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard/Dashboard";
import Login from "./components/Login/Login.jsx";
import Header from "./components/Header/Header.jsx";
import { loadSession, saveSession, setUnauthorizedHandler } from "./api.js";

export default function App() {
  const [user, setUser] = useState(loadSession);

  // An expired or rejected token (401) logs the user out (fail-safe).
  useEffect(() => setUnauthorizedHandler(() => setUser(null)), []);

  function login(session) {
    saveSession(session);
    setUser(session);
  }
  function logout() {
    saveSession(null);
    setUser(null);
  }

  if (!user) {
    return (
      <>
        <Header />
        <Login onLogin={login} />
      </>
    );
  }
  return <Dashboard key={user.member_id} user={user} onLogout={logout} />;
}
