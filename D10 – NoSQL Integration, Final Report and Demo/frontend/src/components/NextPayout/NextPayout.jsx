import Panel from "../Panel/Panel.jsx";
import Avatar from "../Avatar/Avatar.jsx";
import StatusBadge from "../StatusBadge/StatusBadge.jsx";
import Icon from "../Icon/Icon.jsx";
import Countdown from "../Countdown/Countdown.jsx";

// One short, plain line per payout state. The badge always describes the payout,
// never the bidding window (that has its own badge in the bid panel).
const STATES = {
  confirmed: { badge: "Paid out", tone: "green", label: "Received the payout" },
  provisional: {
    badge: "Pending",
    label: "Currently leading",
    note: "The highest bid at the deadline wins once everyone has paid.",
  },
  final_member: {
    badge: "Pending",
    label: "Receives the full pot",
    note: "No bid needed: paid out as soon as everyone has paid.",
  },
  awaiting_bids: {
    badge: "Pending",
    name: "No bids yet",
    note: "The highest bid at the deadline wins.",
  },
  awaiting_funding: {
    badge: "Awaiting payments",
    tone: "amber",
    label: "Winning bid",
    note: "Paid out once all contributions are recorded.",
  },
  awaiting_settlement: {
    badge: "Processing",
    label: "Winning bid",
    note: "Everyone has paid. The payout is being recorded.",
  },
  awaiting_decision: {
    badge: "On hold",
    tone: "amber",
    name: "No bids placed",
    note: "Bidding ended without any bid. The organizer can reopen bidding, close the cycle without a winner, or draw a random winner.",
  },
  expired_no_bids: {
    badge: "No payout",
    tone: "gray",
    name: "No winner",
    note: "This cycle closed without a winner. Its contributions moved to the next cycle.",
  },
  closed_without_payout: { badge: "No payout", tone: "gray", name: "No payout" },
  complete: {
    badge: "Complete",
    tone: "green",
    name: "Circle complete",
    note: "Every member has received the pot.",
  },
  no_members: { badge: "None", tone: "gray", name: "No members yet" },
};

export default function NextPayout({ details, onExpired }) {
  const {
    cycle,
    state,
    recipient,
    member_count,
    contribution_count,
    eligible_members,
    eligible_bid_count,
  } = details;
  const info = STATES[state] || STATES.awaiting_bids;
  const confirmed = state === "confirmed";
  const name = recipient?.name || info.name || "No bids yet";

  return (
    <Panel
      title={confirmed ? `Payout — Cycle ${cycle.seq_no}` : `Next payout — Cycle ${cycle.seq_no}`}
      className="payout-panel"
      action={
        <StatusBadge
          kind="Payout"
          tone={info.tone || "blue"}
          icon={confirmed || state === "complete" ? "check" : "clock"}
        >
          {info.badge}
        </StatusBadge>
      }
    >
      {!confirmed && cycle.status === "open" && (
        <Countdown
          key={`${details.closes_at}-${details.server_now}`}
          cycleId={cycle.cycle_id}
          closesAt={details.closes_at}
          serverNow={details.server_now}
          biddingOpen={details.bidding_open}
          onExpired={onExpired}
        />
      )}
      <div className="payout-person">
        <Avatar name={name} large />
        <div>
          <h3>{name}</h3>
          {recipient && info.label && <p className="blue-text">{info.label}</p>}
        </div>
      </div>
      {info.note && <p className="payout-note">{info.note}</p>}
      <ul className="payout-facts">
        <li>
          <Icon name="wallet" />
          Contributions: {contribution_count} of {member_count} paid
        </li>
        {!confirmed && state !== "final_member" && state !== "complete" && (
          <li>
            <Icon name="users" />
            Bids: {eligible_bid_count} of {eligible_members.length} eligible
            members
          </li>
        )}
      </ul>
    </Panel>
  );
}
