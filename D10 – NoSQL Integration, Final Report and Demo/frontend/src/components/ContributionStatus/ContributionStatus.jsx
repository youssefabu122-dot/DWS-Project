import { useState } from "react";
import Panel from "../Panel/Panel.jsx";
import Avatar from "../Avatar/Avatar.jsx";
import StatusBadge from "../StatusBadge/StatusBadge.jsx";
import { STATUS, displayStatus } from "../../cycleStatus.js";

// Contributions can be recorded while the cycle is open or waiting for the organizer
// (the server enforces the same rule and all D9 permissions).
const RECORDABLE = ["open", "awaiting_decision"];
// States in which the last missing contribution completes the payout immediately.
const SETTLES_WHEN_FUNDED = ["awaiting_funding", "awaiting_settlement", "final_member"];

export default function ContributionStatus({
  cycle,
  members,
  paid,
  contributionAmount,
  user,
  client,
  payoutState,
  payoutRecipients = new Set(),
  onRecorded,
}) {
  const [pending, setPending] = useState(null); // member awaiting confirmation
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const count = members.filter((member) => paid.has(member.member_id)).length;
  const unpaid = members.length - count;
  const percentage = members.length ? Math.round((count / members.length) * 100) : 0;
  const amount = Number(contributionAmount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const canRecord = (member) =>
    Boolean(client && user) &&
    RECORDABLE.includes(cycle.status) &&
    !paid.has(member.member_id) &&
    (user.role === "organizer" || user.member_id === member.member_id);
  const settlesNow = unpaid === 1 && SETTLES_WHEN_FUNDED.includes(payoutState);

  function ask(member) {
    setPending(member);
    setMessage("");
    setError("");
  }

  async function confirm() {
    if (busy || !pending) return; // no double submission
    setBusy(true);
    setError("");
    try {
      await client.post("/contributions", {
        member_id: pending.member_id,
        cycle_id: cycle.cycle_id,
      });
      setMessage(
        `Payment recorded: ${pending.member_id === user.member_id ? "your" : `${pending.name}'s`} contribution for Cycle ${cycle.seq_no}.`,
      );
      setPending(null);
      await onRecorded?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Contribution status"
      action={
        <StatusBadge kind="Cycle" tone={STATUS[displayStatus(cycle)].tone}>
          {STATUS[displayStatus(cycle)].label}
        </StatusBadge>
      }
    >
      <div className="contribution-summary">
        <div className="progress-label">
          <p>
            <strong>
              {count} of {members.length}
            </strong>{" "}
            paid
          </p>
          <span>{percentage}%</span>
        </div>
        <progress
          aria-label="Contributions recorded"
          max={members.length || 1}
          value={count}
        />
        <p className="muted">
          Cycle {cycle.seq_no}
          {unpaid > 0 ? ` · ${unpaid} still to pay` : " · everyone has paid"}
        </p>
      </div>

      {pending && (
        <div className="record-confirm" role="dialog" aria-labelledby="record-title">
          <p id="record-title">
            <strong>
              Record{" "}
              {pending.member_id === user.member_id ? "your" : `${pending.name}'s`}{" "}
              payment of {amount} for Cycle {cycle.seq_no}?
            </strong>
          </p>
          <p>
            This only records a payment made outside the app. No money is
            transferred. It cannot be undone here.
          </p>
          {settlesNow && (
            <p className="record-warning">
              This is the last missing contribution. The payout for Cycle{" "}
              {cycle.seq_no} will be made immediately.
            </p>
          )}
          <div className="record-actions">
            <button onClick={confirm} disabled={busy}>
              {busy ? "Recording…" : "Confirm payment"}
            </button>
            <button
              className="button-outline"
              onClick={() => setPending(null)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="form-error record-message" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="record-success record-message" role="status">
          {message}
        </p>
      )}

      {!members.length ? (
        <p className="empty-state">No members in this circle yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="contribution-table">
            <thead>
              <tr>
                <th>Member</th>
                <th className="numeric">Per cycle</th>
                <th className="numeric">Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const recorded = paid.has(member.member_id);
                const due = !recorded && RECORDABLE.includes(cycle.status);
                return (
                  <tr key={member.member_id} className={due ? "unpaid-row" : undefined}>
                    <td>
                      <span className="member">
                        <Avatar name={member.name} />
                        <span>
                          {member.name}
                          {payoutRecipients.has(member.member_id) && (
                            // Rule: winners keep paying the full contribution every cycle.
                            <small>Received the pot · still pays each cycle</small>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="numeric">{amount}</td>
                    <td className="numeric">
                      {canRecord(member) ? (
                        <button
                          className="button-outline record-button"
                          onClick={() => ask(member)}
                          disabled={busy}
                          aria-label={`Record payment for ${member.name}`}
                        >
                          Record payment
                        </button>
                      ) : (
                        <StatusBadge
                          tone={recorded ? "green" : "amber"}
                          icon={recorded ? "check" : "minus"}
                        >
                          {recorded ? "Paid" : "Not paid"}
                        </StatusBadge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
