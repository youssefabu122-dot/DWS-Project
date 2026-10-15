export default function Avatar({ name = "", large = false }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <span
      className={`avatar ${large ? "avatar-large" : ""}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
