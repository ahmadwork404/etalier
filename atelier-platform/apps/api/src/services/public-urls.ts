export const portalUrl = () =>
  (
    process.env.PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://portal.etalier.app"
      : "http://localhost:3000")
  ).replace(/\/$/, "");
export const siteUrl = () =>
  (process.env.PUBLIC_SITE_URL || "https://etalier.app").replace(/\/$/, "");
export function allowedOrigins() {
  const configured = [process.env.WEB_ORIGINS, process.env.WEB_ORIGIN]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes("*") && process.env.NODE_ENV === "production")
    throw new Error("Configure explicit WEB_ORIGINS in production");
  return new Set([
    "https://etalier.app",
    "https://portal.etalier.app",
    ...(process.env.NODE_ENV !== "production"
      ? [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
        ]
      : []),
    ...configured.filter((value) => value !== "*"),
  ]);
}
