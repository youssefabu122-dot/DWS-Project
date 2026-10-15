import { useEffect, useState } from "react";
import Icon from "../Icon/Icon.jsx";

// Parent remounts this component when the API's server_now changes.
export default function Countdown({
  closesAt,
  serverNow,
  biddingOpen,
  cycleId,
  onExpired,
}) {
  const [anchor] = useState(() => ({
    receivedAt: performance.now(),
    remaining: Date.parse(closesAt) - Date.parse(serverNow),
  }));
  const [elapsed, setElapsed] = useState(0);
  const valid = Number.isFinite(anchor.remaining);
  const seconds = valid
    ? Math.max(0, Math.ceil((anchor.remaining - elapsed) / 1000))
    : null;

  useEffect(() => {
    if (!biddingOpen || !valid) return;
    const tick = () => setElapsed(performance.now() - anchor.receivedAt);
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [anchor, biddingOpen, valid]);

  useEffect(() => {
    if (valid && biddingOpen && seconds === 0) onExpired?.(cycleId, closesAt);
  }, [valid, biddingOpen, seconds, cycleId, closesAt, onExpired]);

  if (!valid) {
    return (
      <div className="countdown">
        <Icon name="info" />
        <span>No server deadline available.</span>
      </div>
    );
  }
  if (!biddingOpen || seconds === 0) {
    return (
      <div className="countdown countdown-closed" role="status">
        <Icon name="clock" />
        <span>Bidding closed</span>
      </div>
    );
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const value = [hours, minutes, seconds % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  return (
    <div className="countdown">
      <Icon name="clock" />
      <span>Bidding closes in</span>
      <strong role="timer" aria-label="Time remaining for bidding">
        {value}
      </strong>
    </div>
  );
}
