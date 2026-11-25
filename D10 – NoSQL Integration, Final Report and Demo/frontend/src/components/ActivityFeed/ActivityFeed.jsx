import { useEffect, useState } from "react";
import Panel from "../Panel/Panel.jsx";
import Icon from "../Icon/Icon.jsx";

// Read from the MongoDB document store; only plain sentences are shown.
const pct = (v) =>
  `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
const money = (v) =>
  Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const who = (actor) =>
  actor?.name || (actor?.role === "organizer" ? "The organizer" : "The system");

function describe(event) {
  const d = event.data || {};
  const cycle = d.seq_no ? `Cycle ${d.seq_no}` : "this cycle";
  switch (event.type) {
    case "bid.placed":
      return `${who(event.actor)} placed a ${pct(d.discount_rate)} bid in ${cycle}.`;
    case "bid.raised":
      return `${who(event.actor)} raised their bid to ${pct(d.discount_rate)} in ${cycle}.`;
    case "contribution.recorded":
      return `${who(event.actor)} paid ${money(d.amount)} for ${cycle}.`;
    case "cycle.opened":
      return `${cycle} opened for bidding.`;
    case "bidding.extended":
      return `Bidding for ${cycle} was extended by ${d.minutes} minutes.`;
    case "bidding.reopened":
      return `Bidding for ${cycle} was reopened.`;
    case "cycle.awaiting_decision":
      return `${cycle} expired: no bids were placed before the deadline. The organizer will decide what happens next.`;
    case "cycle.decision":
      return d.option === "random_winner"
        ? `The organizer drew a random winner for ${cycle}.`
        : d.option === "new_cycle"
          ? `The organizer closed ${cycle} without a winner and started a new cycle.`
          : null; // a reopen is already shown as "Bidding … was reopened"
    case "cycle.closed": {
      const winner = d.winner?.name ?? "A member";
      if (d.selection === "random_draw")
        return `${cycle} closed. ${winner} was drawn at random and received the payout.`;
      if (d.final_member)
        return `${cycle} closed. ${winner} received the final payout.`;
      return Number(d.winning_discount_rate) > 0
        ? `${cycle} closed. ${winner} received the payout with a discount of ${pct(d.winning_discount_rate)}.`
        : `${cycle} closed. ${winner} received the payout.`;
    }
    case "cycle.expired":
      return d.reason === "organizer_started_new_cycle"
        ? null // already described by the organizer's decision
        : `${cycle} closed without a winner. Its contributions moved to the next cycle.`;
    default:
      return null; // unknown types are not shown
  }
}

const FIRST = 5;
const STEP = 10;

function iconFor(event) {
  if (event.type.startsWith("bid.")) return "trend";
  if (event.type === "contribution.recorded") return "wallet";
  if (event.type === "cycle.closed")
    return event.data?.selection === "random_draw" ? "shuffle" : "check";
  if (event.type === "cycle.decision")
    return event.data?.option === "random_winner" ? "shuffle" : "minus";
  if (event.type === "cycle.awaiting_decision" || event.type === "cycle.expired") return "alert";
  if (event.type === "cycle.opened") return "flag";
  return "clock";
}

const when = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export default function ActivityFeed({ client, circleId, refreshKey }) {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(FIRST);

  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      client
        .get(`/circles/${circleId}/activity`, {
          params: { limit: 50 },
          signal: controller.signal,
        })
        .then(({ data }) => {
          setEvents(data.events);
          setError("");
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError("The activity feed is temporarily unavailable.");
        });
    load();
    // New events reach the feed about a second after they happen, so load once more.
    const again = setTimeout(load, 2000);
    return () => {
      clearTimeout(again);
      controller.abort();
    };
  }, [client, circleId, refreshKey]);

  const items = (events || [])
    .map((event) => ({ event, text: describe(event) }))
    .filter((item) => item.text);
  const shown = items.slice(0, visible);

  return (
    <Panel title="Activity" className="activity-panel">
      {error && (
        <p className="empty-state" role="alert">
          {error}
        </p>
      )}
      {!error && !events && <p className="empty-state">Loading activity…</p>}
      {events && !items.length && !error && (
        <p className="empty-state">No activity yet.</p>
      )}
      {items.length > 0 && (
        <ol className="activity-list">
          {shown.map(({ event, text }) => (
            <li key={event._id}>
              <span className="activity-icon">
                <Icon name={iconFor(event)} size={15} />
              </span>
              <span className="activity-text">{text}</span>
              <time dateTime={event.occurred_at}>{when(event.occurred_at)}</time>
            </li>
          ))}
        </ol>
      )}
      {items.length > FIRST && (
        <div className="activity-more">
          {visible < items.length ? (
            <button className="button-outline" onClick={() => setVisible((n) => n + STEP)}>
              View more ({items.length - visible} older)
            </button>
          ) : (
            <button className="button-outline" onClick={() => setVisible(FIRST)}>
              Show less
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}
