import type { MetadataRoute } from "next";
import { articles } from "@/lib/journal";
import { features } from "@/lib/product";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/product",
    "/about",
    "/blogs",
    "/pricing",
    "/security",
    "/contact",
    ...features.map((f) => "/features/" + f.slug),
    ...articles.map((a) => "/blogs/" + a.slug),
  ].map((path) => ({
    url: new URL(path || "/", "https://etalier.app").href,
    lastModified: path.startsWith("/blogs/")
      ? new Date(
          (articles.find((a) => path === "/blogs/" + a.slug)?.modifiedAt ||
            articles.find((a) => path === "/blogs/" + a.slug)?.publishedAt ||
            "2026-11-14") + "T00:00:00+05:00",
        )
      : new Date("2026-11-15T00:00:00+05:00"),
    changeFrequency: path === "/blogs" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
