import Icon from "../Icon/Icon.jsx";
import StatusBadge from "../StatusBadge/StatusBadge.jsx";

export default function CircleOverview({ circle }) {
  const amount = Number(circle.contribution_amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const total = Number(circle.member_count);
  const received = Number(circle.paid_member_count);
  const status = circle.status;
  return (
    <section className="circle-overview" aria-label="Circle overview">
      <div className="circle-title">
        <h2>{circle.name}</h2>
        <StatusBadge
          tone={status === "active" ? "green" : "gray"}
          icon={status === "pending" ? "clock" : "check"}
        >
          {status}
        </StatusBadge>
      </div>
      <div className="stats-grid">
        <article className="stat-card">
          <div className="stat-label">
            Total members
            <Icon name="users" size={21} />
          </div>
          <p className="stat-value">
            {total}
            <span>members</span>
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-label">
            Contribution per member
            <Icon name="wallet" size={21} />
          </div>
          <p className="stat-value">
            {amount}
            <span>per cycle</span>
          </p>
        </article>
        <article className="stat-card">
          <div className="stat-label">
            Members paid so far
            <Icon name="check" size={21} />
          </div>
          <p className="stat-value">
            {received} of {total}
            <span>members</span>
          </p>
          <p className="stat-note">
            Across all cycles · Current circle progress
          </p>
          <progress
            aria-label="Members paid so far"
            max={total || 1}
            value={received}
          />
        </article>
      </div>
    </section>
  );
}
