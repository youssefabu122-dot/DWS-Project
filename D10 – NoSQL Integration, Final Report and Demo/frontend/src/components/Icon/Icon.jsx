export default function Icon({ name, size = 18 }) {
  const paths = {
    logo: (
      <>
        <path d="M4 8h13l-3-3M20 16H7l3 3M4 8v6M20 16v-6" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5" />
      </>
    ),
    wallet: (
      <>
        <path d="M20 8V5H6a3 3 0 0 0 0 6h14v9H6a3 3 0 0 1-3-3V8M20 12h-5v5h5" />
        <path d="M17 14.5h.01" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5h4" />
      </>
    ),
    minus: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8" />
      </>
    ),
    trend: (
      <>
        <path d="M4 17l6-6 4 4 6-7" />
        <path d="M15 8h5v5" />
      </>
    ),
    flag: (
      <>
        <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
      </>
    ),
    alert: (
      <>
        <path d="M12 4 3 20h18L12 4z" />
        <path d="M12 10v4M12 17h.01" />
      </>
    ),
    shuffle: (
      <>
        <path d="M4 7h3l10 10h3M4 17h3l3-3M14 10l3-3h3" />
        <path d="m18 5 2 2-2 2M18 15l2 2-2 2" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.info}
    </svg>
  );
}
