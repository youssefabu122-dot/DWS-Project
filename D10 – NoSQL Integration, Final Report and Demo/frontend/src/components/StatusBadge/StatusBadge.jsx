import Icon from "../Icon/Icon.jsx";

export default function StatusBadge({
  children,
  tone = "blue",
  icon = "clock",
  kind,
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <Icon name={icon} size={14} />
      {kind && <span className="badge-kind">{kind}:</span>}
      {children}
    </span>
  );
}
