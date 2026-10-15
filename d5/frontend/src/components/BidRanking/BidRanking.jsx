import Panel from "../Panel/Panel.jsx";
import Avatar from "../Avatar/Avatar.jsx";
import Icon from "../Icon/Icon.jsx";
import BidForm from "../BidForm/BidForm.jsx";

export default function BidRanking({
  client,
  bids,
  cycle,
  members,
  biddingOpen = cycle.status === "open",
  error,
  onSubmitted,
}) {
  function amount(value) {
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return (
    <Panel
      title="Bid ranking"
      action={
        <span className="blue-text small">
          {biddingOpen ? "Provisional" : "Bidding closed"}
        </span>
      }
    >
      <p className="panel-subtitle">
        Cycle {cycle.seq_no} · Highest discount first
      </p>
      {!bids.length ? (
        <p className="empty-state">No bids for this cycle yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Member</th>
                <th className="numeric">Discount</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr
                  key={bid.bid_id}
                  className={bid.rank === 1 ? "leading-row" : ""}
                >
                  <td>
                    <span className="rank">{bid.rank}</span>
                  </td>
                  <td>
                    <span className="member">
                      <Avatar name={bid.name} />
                      <span>
                        {bid.name}
                        <small>
                          {bid.rank === 1 && cycle.status === "open"
                            ? "Top-ranked bid · "
                            : ""}
                          Bid #{bid.bid_id}
                        </small>
                      </span>
                    </span>
                  </td>
                  <td className="numeric bid-value">
                    {amount(bid.discount_rate)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="panel-foot foot-note">
        <Icon name="info" />
        <span>
          Highest discount wins; equal rates use the lowest bid ID. The server
          confirms settlement.
        </span>
      </div>
      {error ? (
        <p className="empty-state">Refresh successfully to enable bidding.</p>
      ) : (
        <details className="bid-details">
          <summary>Place a bid</summary>
          <BidForm
            key={cycle.cycle_id}
            client={client}
            members={members}
            cycle={cycle}
            biddingOpen={biddingOpen}
            onSubmitted={onSubmitted}
          />
        </details>
      )}
    </Panel>
  );
}
