import Panel from "../Panel/Panel.jsx";
import Avatar from "../Avatar/Avatar.jsx";
import StatusBadge from "../StatusBadge/StatusBadge.jsx";

export default function ContributionStatus({
  cycle,
  members,
  paid,
  contributionAmount,
}) {
  const count = members.filter((member) => paid.has(member.member_id)).length;
  const percentage = members.length
    ? Math.round((count / members.length) * 100)
    : 0;
  const amount = Number(contributionAmount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <Panel
      title="Contribution status"
      action={
        <StatusBadge tone={cycle.status === "open" ? "blue" : "gray"}>
          {cycle.status}
        </StatusBadge>
      }
    >
      <div className="contribution-summary">
        <div className="progress-label">
          <p>
            <strong>
              {count} of {members.length}
            </strong>{" "}
            recorded
          </p>
          <span>{percentage}%</span>
        </div>
        <progress
          aria-label="Contributions recorded"
          max={members.length || 1}
          value={count}
        />
        <p className="muted">
          Cycle {cycle.seq_no} — {cycle.status} · {members.length - count}{" "}
          contributions not recorded
        </p>
      </div>
      {!members.length ? (
        <p className="empty-state">No members in this circle yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="contribution-table">
            <thead>
              <tr>
                <th>Member</th>
                <th className="numeric">Per cycle</th>
                <th className="numeric">Record status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const recorded = paid.has(member.member_id);
                return (
                  <tr key={member.member_id}>
                    <td>
                      <span className="member">
                        <Avatar name={member.name} />
                        {member.name}
                      </span>
                    </td>
                    <td className="numeric">{amount}</td>
                    <td className="numeric">
                      <StatusBadge
                        tone={recorded ? "green" : "amber"}
                        icon={recorded ? "check" : "minus"}
                      >
                        {recorded ? "Recorded" : "Not recorded"}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="panel-foot">
        All {members.length} members · Records for the selected cycle only
      </div>
    </Panel>
  );
}
