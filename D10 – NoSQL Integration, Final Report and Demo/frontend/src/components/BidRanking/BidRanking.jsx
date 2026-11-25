import Panel from "../Panel/Panel.jsx";
import Avatar from "../Avatar/Avatar.jsx";
import Icon from "../Icon/Icon.jsx";
import StatusBadge from "../StatusBadge/StatusBadge.jsx";
import BidForm from "../BidForm/BidForm.jsx";

export default function BidRanking({
  client,
  bids,
  cycle,
  members,
  biddingOpen = cycle.status === "open",
  alreadyPaidOut = false,
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
        <StatusBadge
          kind="Bidding"
          tone={biddingOpen ? "blue" : "gray"}
          icon={biddingOpen ? "clock" : "minus"}
        >
          {biddingOpen ? "Open" : "Closed"}
        </StatusBadge>
      }
    >
      <p className="panel-subtitle">
        Cycle {cycle.seq_no} · highest discount first
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
                        {(bid.rank === 1 || bid.raise_count > 0) && (
                          <small>
                            {[
                              bid.rank === 1 && (biddingOpen ? "Leading" : "Highest bid"),
                              bid.raise_count > 0 && "Raised",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                        )}
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
          Highest discount wins. On equal rates, the earlier bid wins (a raise
          counts from the time it was made).
        </span>
      </div>
      {alreadyPaidOut ? (
        <p className="empty-state">
          You have already received the pot in this circle, so you can&apos;t bid
          again. You still pay your full contribution every cycle.
        </p>
      ) : error ? (
        <p className="empty-state">Bidding is paused until the dashboard reconnects.</p>
      ) : !biddingOpen ? (
        <p className="empty-state">Bidding is closed for this cycle.</p>
      ) : (
        <details className="bid-details">
          <summary>Place a bid</summary>
          <BidForm
            key={cycle.cycle_id}
            client={client}
            members={members}
            cycle={cycle}
            biddingOpen={biddingOpen}
            bids={bids}
            onSubmitted={onSubmitted}
          />
        </details>
      )}
    </Panel>
  );
}
