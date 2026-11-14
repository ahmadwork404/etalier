import type { CSSProperties } from "react";
export function Star({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M32 8v48M8 32h48M15 15l34 34M15 49l34-34"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path d="M4 12h15M13 5l7 7-7 7" />
      </>
    ),
    chevron: <path d="m6 9 6 6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    play: <path d="m9 5 11 7-11 7z" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v5M17 3v5M3 11h18M8 15h2M14 15h2" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 4v2" />
      </>
    ),
    scissors: (
      <>
        <circle cx="5" cy="6" r="3" />
        <circle cx="5" cy="18" r="3" />
        <path d="m8 8 13 13M8 16 21 3" />
      </>
    ),
    bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7z" />,
    chart: (
      <>
        <path d="M4 3v18h17M8 16v-5M13 16V8M18 16V5" />
      </>
    ),
    receipt: (
      <>
        <path d="M5 3h14v19l-3-2-4 2-4-2-3 2zM9 8h6M9 12h6M9 16h3" />
      </>
    ),
    heart: (
      <path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 3 12 8 16 5-4 13-11 8-16Z" />
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6l4 2" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3M12 20v3M1 12h3M20 12h3M4 4l2 2M18 18l2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    location: (
      <>
        <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
    sparkle: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
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
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] || paths.sparkle}
    </svg>
  );
}
export function Brand() {
  return (
    <span className="brand">
      etalier
      <Star />
    </span>
  );
}
