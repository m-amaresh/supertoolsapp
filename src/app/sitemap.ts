import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";
import { toolCategories, toolDefinitions } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/about`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = toolCategories.map(
    (category) => ({
      url: `${siteUrl}/tools/category/${category.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }),
  );

  const toolRoutes: MetadataRoute.Sitemap = toolDefinitions
    .filter((tool) => tool.available)
    .map((tool) => ({
      url: `${siteUrl}${tool.href}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));

  return [...staticRoutes, ...categoryRoutes, ...toolRoutes];
}
