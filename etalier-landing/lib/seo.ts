import type { Metadata } from "next";
export const siteOrigin = "https://etalier.app";
export const siteTitle = "Etalier";
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const url = new URL(path, siteOrigin).href;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      title,
      description,
      url,
      siteName: siteTitle,
      locale: "en_GB",
      images: [
        {
          url: siteOrigin + "/social.png",
          width: 1200,
          height: 630,
          alt: "Etalier salon management software",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteOrigin + "/social.png"],
    },
  };
}
export const organisation = {
  "@type": "Organization",
  "@id": siteOrigin + "/#organization",
  name: "Etalier",
  url: siteOrigin,
  logo: { "@type": "ImageObject", url: siteOrigin + "/icon.svg" },
  description:
    "Salon management software for bookings, walk-ins, customer records and team operations.",
};
export const website = {
  "@type": "WebSite",
  "@id": siteOrigin + "/#website",
  url: siteOrigin,
  name: "Etalier",
  publisher: { "@id": siteOrigin + "/#organization" },
  inLanguage: "en",
};
export function breadcrumb(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((i, n) => ({
      "@type": "ListItem",
      position: n + 1,
      name: i.name,
      item: siteOrigin + i.path,
    })),
  };
}
