import { useState } from "react";
import Panel from "../Panel/Panel.jsx";

// Organizer-only bidding controls. The server re-checks every rule
// (role, state, one decision per round, funding before a draw).
export default function OrganizerControls({ client, details, onDone }) {
  const [minutes, setMinutes] = useState("30");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failure, setFailure] = useState(null);
  const cycle = details.cycle;
  // An error (e.g. "not funded yet") is only shown while the state, the round and
  // the recorded contributions are still those it was raised in.
  const situation = `${details.state}|${details.bidding_round}|${details.contribution_count}`;
  const error = failure?.situation === situation ? failure.text : "";
  const setError = (text) => setFailure(text ? { text, situation } : null);

  async function run(action, confirmText) {
    if (busy) return;
    if (confirmText && !window.confirm(confirmText)) return;
    const body = { action };
    if (action === "extend" || action === "reopen") {
      const m = Number(minutes);
      if (!Number.isInteger(m) || m < 1 || m > 10080) {
        setError("Minutes must be a whole number from 1 to 10080.");
        return;
      }
      body.minutes = m;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await client.post(
        `/cycles/${cycle.cycle_id}/bidding`,
        body,
      );
      const at = new Date().toLocaleTimeString();
      setMessage(
        `${at}: ` +
        (action === "random_winner"
          ? `Random draw: member ${data.winner_member_id} receives the full pot.`
          : action === "new_cycle"
            ? `Cycle ${data.next_cycle.seq_no} opened; contributions carried over.`
            : `New deadline: ${new Date(data.bid_closes_at).toLocaleString()}.`),
      );
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const { can_extend, can_reopen, awaiting_decision } = details;
  if (!can_extend && !can_reopen && !awaiting_decision) return null;
  return (
    <Panel title="Organizer controls" className="organizer-panel">
      <div className="organizer-body">
        {awaiting_decision && (
          <p>
            This cycle expired without any bid. Choose what happens next. A
            decision is final.
          </p>
        )}
        {(can_extend || can_reopen) && (
          <label>
            Minutes
            <input
              type="number"
              min="1"
              max="10080"
              step="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
        )}
        <div className="organizer-actions">
          {can_extend && (
            <button disabled={busy} onClick={() => run("extend")}>
              Extend deadline
            </button>
          )}
          {can_reopen && (
            <button
              disabled={busy}
              onClick={() =>
                run("reopen", "Reopen bidding for this cycle? Existing bids stay and can only be raised.")
              }
            >
              Reopen bidding
            </button>
          )}
          {awaiting_decision && (
            <>
              <button
                className="button-outline"
                disabled={busy}
                onClick={() =>
                  run(
                    "new_cycle",
                    "Close this cycle without a winner? Contributions are carried forward to a new cycle.",
                  )
                }
              >
                Close without winner
              </button>
              <button
                className="button-outline"
                disabled={busy}
                onClick={() =>
                  run(
                    "random_winner",
                    "Draw a random eligible member who receives the full pot (0% discount)? All contributions must be recorded.",
                  )
                }
              >
                Random winner
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p role="status">{message}</p>
      </div>
    </Panel>
  );
}
