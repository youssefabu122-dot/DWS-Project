import Panel from "../Panel/Panel.jsx";
import Avatar from "../Avatar/Avatar.jsx";
import StatusBadge from "../StatusBadge/StatusBadge.jsx";
import Icon from "../Icon/Icon.jsx";
import Countdown from "../Countdown/Countdown.jsx";

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
  const confirmed = state === "confirmed";
  const labels = {
    confirmed: "Payout recorded",
    provisional: "Provisional leader",
    final_member: "Final eligible member",
    awaiting_bids: "No leader yet",
    closed_without_payout: "No payout recorded",
    complete: "All members have received a payout",
    no_members: "No members yet",
    awaiting_funding: "Leading bid — awaiting contributions",
    awaiting_settlement: "Settlement pending",
    expired_no_bids: "At least one eligible member must submit a bid",
  };
  const names = {
    expired_no_bids: "No bids submitted",
    awaiting_bids: "Awaiting bids",
    closed_without_payout: "No payout recorded",
    complete: "Circle complete",
    no_members: "No members yet",
  };
  const messages = {
    awaiting_funding:
      "Bidding is closed. The highest eligible bid will receive the payout once all contributions are recorded.",
    awaiting_settlement:
      "Bidding is closed and the pot is fully funded. The server is completing settlement.",
    expired_no_bids:
      "The deadline passed without eligible bids. At least one eligible member must submit a bid before closing. No payout was created; this cycle is expired.",
    confirmed: "The server has recorded the payout for this cycle.",
    closed_without_payout:
      "This cycle is not open. No payout is recorded for it.",
    final_member:
      "The final eligible member receives the full pot once all contributions are recorded. No bid is required.",
    complete: "There are no remaining eligible members in this circle.",
    no_members: "Add members before a payout can be determined.",
  };
  const message =
    messages[state] ||
    "At closing, the highest eligible bid wins once all contributions are recorded. The server confirms the payout.";
  const name = recipient?.name || names[state] || "Awaiting bids";

  return (
    <Panel
      title={
        cycle.status === "open" && !confirmed
          ? `Next payout — Cycle ${cycle.seq_no}`
          : `Payout details — Cycle ${cycle.seq_no}`
      }
      className="payout-panel"
      action={
        <StatusBadge
          tone={confirmed ? "green" : "blue"}
          icon={confirmed ? "check" : "clock"}
        >
          {confirmed
            ? "Confirmed"
            : state === "awaiting_funding"
              ? "Awaiting funding"
              : state === "expired_no_bids"
                ? "No payout"
                : "Not confirmed"}
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
          <p className="blue-text">{labels[state]}</p>
        </div>
      </div>
      <div className="info-box">
        <div>
          <Icon name="info" />
          {confirmed
            ? "Server-confirmed payout"
            : "Server confirmation required"}
        </div>
        <p>{message}</p>
      </div>
      <ul className="payout-facts">
        <li>
          <Icon name="minus" />
          Contributions: {contribution_count} of {member_count} recorded
        </li>
        <li>
          <Icon name="clock" />
          {confirmed
            ? "Settlement recorded"
            : state === "final_member"
              ? "Bids: not required for the final member"
              : `Bids: ${eligible_bid_count} of ${eligible_members.length} eligible members`}
        </li>
      </ul>
      <div className="closing-note">
        <Icon name="info" />
        <span>
          {cycle.status === "open" && !confirmed
            ? "Bidding may close early when all eligible members have bid and the pot is fully funded."
            : `Cycle status: ${cycle.status}.`}
        </span>
      </div>
    </Panel>
  );
}
