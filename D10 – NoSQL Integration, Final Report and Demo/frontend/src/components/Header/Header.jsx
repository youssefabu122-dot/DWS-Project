import Icon from "../Icon/Icon.jsx";

export default function Header({
  connected = false,
  paused = false,
  user,
  onLogout,
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <span className="brand-icon">
            <Icon name="logo" size={23} />
          </span>
          <span>ROSCA</span>
          <span className="brand-divider" />
          <h1>Dashboard</h1>
        </div>
        {user && (
          <div className="session">
            <span
              className={`connection ${connected && !paused ? "connected" : ""}`}
              role="status"
            >
              <span className="connection-dot" />
              {paused
                ? "Updates paused"
                : connected
                  ? "Live"
                  : "Connecting"}
            </span>
            <span className="user-name">
              {user.name} · {user.role}
            </span>
            <button className="button-outline" onClick={onLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
