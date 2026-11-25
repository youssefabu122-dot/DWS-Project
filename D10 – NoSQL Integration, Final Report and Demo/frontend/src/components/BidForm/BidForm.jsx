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
        .min(0, "Discount cannot be negative.")
        .max(50, "Discount cannot exceed 50%."),
    ),
});

export default function BidForm({
  client,
  members,
  cycle,
  biddingOpen = cycle.status === "open",
  bids = [],
  onSubmitted,
}) {
  const [member, setMember] = useState("");
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // A member with a bid can only raise it (the server enforces this too).
  const current = bids.find((b) => String(b.member_id) === String(member));

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
    if (current && result.data.discount_rate <= Number(current.discount_rate)) {
      setError(`A bid can only be raised above the current ${current.discount_rate}%.`);
      return;
    }

    setBusy(true);
    try {
      const { data } = await client.post(
        `/cycles/${cycle.cycle_id}/bids`,
        result.data,
      );
      setMember("");
      setRate("");
      setMessage(
        data.action === "raised"
          ? "Bid raised. Refreshing the dashboard…"
          : "Bid accepted. Refreshing the dashboard…",
      );
      await onSubmitted();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h3>{current ? "Raise your bid" : "Submit a bid"}</h3>
      <p>
        0% to 50%. You can raise your bid until the deadline, but not lower
        it.
      </p>
      <fieldset disabled={busy || !biddingOpen || !members.length}>
        <label>
          Member
          <select
            value={member}
            onChange={(e) => {
              setMember(e.target.value);
              setMessage("");
              setError("");
            }}
          >
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
            min={current ? Number(current.discount_rate) + 0.01 : 0}
            max="50"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <button type="submit">
          {busy ? "Submitting…" : current ? "Raise bid" : "Submit bid"}
        </button>
      </fieldset>
      {!biddingOpen ? (
        <p>Bidding is closed for this cycle.</p>
      ) : (
        !members.length && <p>No member can bid: everyone has already received the pot.</p>
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
