import { useEffect, useState } from "react";
import Panel from "../Panel/Panel.jsx";

const pct = (v) =>
  v === null || v === undefined
    ? "—"
    : `${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const money = (v) =>
  Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Fixed categorical order (validated palette): won by bid, random draw, last member.
const SERIES = [
  { key: "bid", label: "Won by bid", color: "#2a78d6" },
  { key: "random_draw", label: "Random draw", color: "#eb6834" },
  { key: "final_member", label: "Last member (automatic)", color: "#1baf7a" },
];
const HOW = {
  bid: "Bid",
  random_draw: "Random draw",
  final_member: "Last member",
};

function Distribution({ buckets }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...buckets.map((b) => b.total));
  return (
    <figure className="dist">
      <figcaption>
        <span className="dist-title">Winning discount per completed cycle</span>
        <ul className="legend" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key}>
              <span className="swatch" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      </figcaption>
      <div className="dist-rows" role="img" aria-label="Number of completed cycles per winning discount range">
        {buckets.map((b) => (
          <div className="dist-row" key={b.label}>
            <span className="dist-label">{b.label}</span>
            <div className="dist-track">
              <span className="dist-bar" style={{ width: `${(b.total / max) * 85}%` }}>
                {SERIES.filter((s) => b[s.key] > 0).map((s) => (
                  <span
                    key={s.key}
                    className="dist-seg"
                    style={{ flexGrow: b[s.key], background: s.color }}
                    onMouseEnter={() => setHover(`${b.label}: ${b[s.key]} × ${s.label.toLowerCase()}`)}
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </span>
              <span className="dist-count">{b.total}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="dist-hover" aria-live="polite">
        {hover || "Hover a bar for details. Each cycle counts once."}
      </p>
    </figure>
  );
}

export default function BiddingAnalytics({ client, circleId, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    client
      .get(`/circles/${circleId}/analytics`, { signal: controller.signal })
      .then(({ data }) => {
        setData(data);
        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [client, circleId, refreshKey]);

  if (error)
    return (
      <Panel title="Bidding analytics" className="analytics-panel">
        <p className="empty-state" role="alert">{error}</p>
      </Panel>
    );
  if (!data)
    return (
      <Panel title="Bidding analytics" className="analytics-panel">
        <p className="empty-state">Loading analytics…</p>
      </Panel>
    );

  const { average_discount: avg, winning_bids: wins, cost_of_credit: cost } = data;
  const none = wins.completed_cycles === 0;
  return (
    <Panel title="Bidding analytics" className="analytics-panel">
      <div className="analytics-cards">
        <article className="stat-card">
          <div className="stat-label">Average discount rate</div>
          <p className="stat-value">{pct(avg.rate)}</p>
          <p className="stat-note">
            {avg.bid_count
              ? `${avg.bid_count} final bids in ${avg.cycle_count} completed cycles.`
              : "No completed cycle with bids yet."}
            {avg.current &&
              ` Cycle ${avg.current.seq_no} so far: ${pct(avg.current.average_rate)}.`}
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-label">Average winning discount</div>
          <p className="stat-value">{pct(wins.average_winning_rate)}</p>
          <p className="stat-note">
            {none
              ? "No completed cycles yet."
              : `Bids only: ${wins.counts.bid} won by bid, ${wins.counts.random_draw + wins.counts.final_member} at 0% without a bid.`}
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-label">Cost of credit</div>
          <p className="stat-value">
            {pct(cost.average_per_cycle_rate_pct)}
            {cost.average_per_cycle_rate_pct !== null && <span>per cycle</span>}
          </p>
          <p className="stat-note">
            {cost.average_per_cycle_rate_pct === null
              ? "No early payout yet."
              : `Total ${pct(cost.average_total_cost_pct)} of the amount received early. Not a yearly rate.`}
          </p>
        </article>
      </div>

      {none ? (
        <p className="empty-state">Charts appear once a cycle has been paid out.</p>
      ) : (
        <div className="analytics-body">
          <Distribution buckets={wins.distribution} />
          <div className="table-wrap">
            <table className="analytics-table">
              <caption>Payouts</caption>
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Recipient</th>
                  <th>Chosen by</th>
                  <th className="numeric">Discount</th>
                  <th className="numeric">Received early</th>
                  <th className="numeric">Cost per cycle</th>
                </tr>
              </thead>
              <tbody>
                {cost.payouts.map((p) => (
                  <tr key={p.cycle_id}>
                    <td>{p.seq_no}</td>
                    <td>{p.winner.name}</td>
                    <td>{HOW[p.selection]}</td>
                    <td className="numeric">
                      {pct(p.winning_rate)} <small>({money(p.discount_amount)})</small>
                    </td>
                    <td className="numeric">{p.borrower ? money(p.advance) : "—"}</td>
                    <td className="numeric">{p.borrower ? pct(p.per_cycle_rate_pct) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <details className="analytics-help">
        <summary>How these figures are calculated</summary>
        <ul>
          <li>
            <strong>Average discount rate:</strong> the simple average of each
            member&apos;s final bid in completed cycles. A raised bid counts once,
            at its final rate. Bids in the current cycle are shown separately
            (&quot;so far&quot;).
          </li>
          <li>
            <strong>Average winning discount:</strong> the average of the winning
            bids. Random draws and the last member (automatic) receive the full
            pot at 0% without a bid, so they are counted separately and not
            included in the average.
          </li>
          <li>
            <strong>Cost of credit:</strong> a member paid out in completed cycle k
            has paid k contributions and receives the pot minus the discount.
            Received early = pot − discount − k × contribution. It is repaid with
            the remaining (members − k) contributions. The cost per cycle is the
            rate at which those repayments equal the amount received early. The
            total cost is discount ÷ amount received early; the card shows the
            average over members paid early. Cycles have no fixed length, so
            neither figure is converted to a yearly rate.
          </li>
        </ul>
      </details>
    </Panel>
  );
}
