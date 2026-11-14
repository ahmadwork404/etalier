import type { Metadata } from "next";
import "./globals.css";
import { StructuredData } from "@/components/StructuredData";
import { organisation, website } from "@/lib/seo";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://etalier.app",
  ),
  title: "Salon Management Software for Bookings & Teams | Etalier",
  description:
    "Manage salon bookings, walk-ins, customer records, team schedules and payroll in one workspace. Explore Etalier and request a walkthrough.",
  applicationName: "Etalier",
  category: "Business software",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
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
      <body>
        <StructuredData
          data={{
            "@context": "https://schema.org",
            "@graph": [organisation, website],
          }}
        />
        {children}
      </body>
    </html>
  );
}
