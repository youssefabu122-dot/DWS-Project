import Icon from "../Icon/Icon.jsx";

export default function StatusBadge({
  children,
  tone = "blue",
  icon = "clock",
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <Icon name={icon} size={14} />
      {children}
    </span>
  );
}
