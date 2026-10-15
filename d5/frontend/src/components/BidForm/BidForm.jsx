import { useState } from "react";
import { z } from "zod";

const bidSchema = z.object({
  member_id: z.coerce
    .number()
    .int()
    .positive("Choose a member.")
    .max(2147483647),
  discount_rate: z
    .string()
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "Enter a percentage with at most two decimal places.",
    )
    .transform(Number)
    .pipe(
      z
        .number()
        .gt(0, "Discount must be greater than 0.")
        .max(100, "Discount cannot exceed 100."),
    ),
});

export default function BidForm({
  client,
  members,
  cycle,
  biddingOpen = cycle.status === "open",
  onSubmitted,
}) {
  const [member, setMember] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!biddingOpen) {
      setError("Bidding is closed for this cycle.");
      return;
    }
    setError("");
    setMessage("");

    const result = bidSchema.safeParse({
      member_id: member,
      discount_rate: rate,
    });
    if (!result.success) {
      setError(result.error.issues.map((issue) => issue.message).join(" "));
      return;
    }
    if (!members.some((m) => m.member_id === result.data.member_id)) {
      setError("Choose a member from this circle.");
      return;
    }

    setBusy(true);
    try {
      await client.post(`/cycles/${cycle.cycle_id}/bids`, result.data);
      setMember("");
      setRate("");
      setMessage("Bid accepted. Refreshing the dashboard…");
      await onSubmitted();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h3>Submit a bid</h3>
      <p>
        All circle members are listed. The server checks eligibility when you
        submit.
      </p>
      <fieldset disabled={busy || !biddingOpen || !members.length}>
        <label>
          Member
          <select value={member} onChange={(e) => setMember(e.target.value)}>
            <option value="">Choose a member</option>
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Discount (%)
          <input
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <button type="submit">{busy ? "Submitting…" : "Submit bid"}</button>
      </fieldset>
      {!biddingOpen ? (
        <p>Bidding is closed for this cycle.</p>
      ) : (
        !members.length && <p>No members in this circle yet.</p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p role="status">{message}</p>
    </form>
  );
}
