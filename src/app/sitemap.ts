import type { MetadataRoute } from "next";
import { lastModifiedFor, sitemapPaths } from "@/lib/last-modified";
import { getSiteUrl } from "@/lib/site";

// Google ignores <changefreq> and <priority>; <lastmod> is what it uses to
// decide when to recrawl, so every entry carries an honest one.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  return sitemapPaths().map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: lastModifiedFor(path),
  }));
}
