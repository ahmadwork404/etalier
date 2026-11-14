"use client";
import { useEffect, useState, type ReactNode } from "react";
export function PortalLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [origin, setOrigin] = useState("https://portal.etalier.app");
  useEffect(() => {
    if (
      window.location.hostname ===
      "etalier-landing.etalier-ahmadwork404.workers.dev"
    )
      setOrigin("https://etalier-portal.etalier-ahmadwork404.workers.dev");
  }, []);
  return (
    <a href={origin + "/login"} className={className}>
      {children}
    </a>
  );
}
