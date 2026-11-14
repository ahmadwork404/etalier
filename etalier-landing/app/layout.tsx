import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://etalier.app",
  ),
  title: "Etalier — Your salon. All together.",
  description:
    "Bookings, walk-ins, customers, your team, and payroll. A beautifully joined-up workspace for your salon.",
  openGraph: {
    title: "Etalier — Your salon. All together.",
    description: "A little less admin. A lot more salon.",
    type: "website",
    images: [
      {
        url: "/social.png",
        width: 1200,
        height: 630,
        alt: "Etalier — Your salon. All together.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Etalier — Your salon. All together.",
    images: ["/social.png"],
  },
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
