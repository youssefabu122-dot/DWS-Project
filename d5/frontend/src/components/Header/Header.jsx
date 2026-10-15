import Icon from "../Icon/Icon.jsx";

export default function Header({ connected = false, paused = false }) {
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
        <span
          className={`connection ${connected && !paused ? "connected" : ""}`}
          role="status"
        >
          <span className="connection-dot" />
          {paused
            ? "Updates paused"
            : connected
              ? "Live updates · 15s"
              : "Connecting"}
        </span>
      </div>
    </header>
  );
}
