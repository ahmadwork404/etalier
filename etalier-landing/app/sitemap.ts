import type { MetadataRoute } from "next";
import { articles } from "@/lib/journal";
import { features } from "@/lib/product";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/product",
    "/about",
    "/blog",
    "/pricing",
    "/security",
    "/contact",
    ...features.map((f) => "/features/" + f.slug),
    ...articles.map((a) => "/blog/" + a.slug),
  ].map((path) => ({
    url: "https://etalier.app" + path,
    changeFrequency: path === "/blog" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
