import type { MetadataRoute } from "next";
import { getSiteUrl, shouldIndexSite } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const allowIndexing = shouldIndexSite();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: allowIndexing ? [] : ["/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
