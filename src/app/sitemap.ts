import type { MetadataRoute } from "next";
import { lastModifiedFor } from "@/lib/last-modified";
import { getSiteUrl } from "@/lib/site";
import { toolCategories, toolDefinitions } from "@/lib/tools";

// Google ignores <changefreq> and <priority>; <lastmod> is what it uses to
// decide when to recrawl, so every entry carries an honest one.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const paths = [
    "/",
    "/about",
    "/privacy",
    ...toolCategories.map((category) => `/tools/category/${category.slug}`),
    ...toolDefinitions
      .filter((tool) => tool.available)
      .map((tool) => tool.href),
  ];

  return paths.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: lastModifiedFor(path),
  }));
}
