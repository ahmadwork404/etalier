import {
  Scissors,
  Sparkles,
  Droplets,
  Package,
  Building2,
  ClipboardList,
  Palette,
  Hand,
  Flower2,
  Eye,
} from "lucide-react";
export function RecordVisual({
  name,
  kind,
  identity,
  iconKey,
}: {
  name: string;
  kind: string;
  identity?: string;
  iconKey?: string;
}) {
  const hash = Array.from(identity || name || "salon").reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  const variant = hash % 3;
  const person =
    /customer|employee|member|review|loyalty|payroll|leave|working hours|payment|commission/i.test(
      kind,
    );
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  if (person)
    return (
      <span
        className={`record-visual person-visual visual-${variant}`}
        title={`${name} · illustrated avatar`}
      >
        <svg
          viewBox="0 0 64 64"
          role="img"
          aria-label={`${name} illustrated avatar`}
        >
          <path
            d="M8 64c0-18 10-27 24-27s24 9 24 27"
            fill="var(--color-primary)"
          />
          <path
            d={
              hash % 2
                ? "M15 33V23a17 17 0 0 1 34 0v20H15Z"
                : "M17 28V21a15 15 0 0 1 30 0v14H17Z"
            }
            fill="var(--color-text)"
          />
          <ellipse
            cx="32"
            cy="27"
            rx="12"
            ry="15"
            fill="var(--color-secondary)"
          />
          <path
            d={
              hash % 2
                ? "M19 23c0-16 26-18 27 0-9 0-12-5-14-9-2 6-8 8-13 9"
                : "M19 21c2-14 26-14 27 2-10-1-16-3-19-7-2 3-5 4-8 5"
            }
            fill="var(--color-text)"
          />
          <circle cx="27" cy="28" r="1" fill="var(--color-primary)" />
          <circle cx="37" cy="28" r="1" fill="var(--color-primary)" />
          <path
            d="M28 34q4 3 8 0"
            stroke="var(--color-accent)"
            fill="none"
            strokeWidth="1.5"
          />
        </svg>
        <span className="visual-initials">{initials}</span>
      </span>
    );
  const presets: Record<string, typeof Scissors> = {
    haircut: Scissors,
    color: Palette,
    wash: Droplets,
    facial: Sparkles,
    nails: Hand,
    massage: Flower2,
    brows: Eye,
  };
  const Icon =
    (/service/i.test(kind) && iconKey && presets[iconKey]) ||
    (/service|consumption/i.test(kind)
      ? /facial|skin|glow/i.test(name)
        ? Sparkles
        : /wash|color|treat/i.test(name)
          ? Droplets
          : Scissors
      : /product|inventory|stock/i.test(kind)
        ? Package
        : /branch|supplier/i.test(kind)
          ? Building2
          : ClipboardList);
  return (
    <span
      className={`record-visual item-visual visual-${variant}`}
      role="img"
      aria-label={`${name} category illustration`}
    >
      <Icon size={25} />
      <span className="visual-initials">{initials}</span>
    </span>
  );
}
