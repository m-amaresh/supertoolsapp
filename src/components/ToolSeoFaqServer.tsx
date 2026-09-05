import { SeoFaq } from "@/components/SeoFaq";
import { RelatedTools } from "@/components/tool/RelatedTools";
import { GITHUB_REPO_URL, getSiteUrl } from "@/lib/site";
import { TOOL_FAQ_BY_PATH } from "@/lib/tool-seo";
import { toolDefinitions } from "@/lib/tools";

interface ToolSeoFaqServerProps {
  path: string;
}

export function ToolSeoFaqServer({ path }: ToolSeoFaqServerProps) {
  const section = TOOL_FAQ_BY_PATH[path];
  const tool = toolDefinitions.find((t) => t.href === path);

  const appSchema = tool
    ? {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: `${tool.name} - SuperTools`,
        url: `${getSiteUrl()}${tool.href}`,
        description: tool.description,
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web",
        browserRequirements: "Requires JavaScript. Runs in any modern browser.",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        publisher: {
          "@type": "Organization",
          name: "SuperTools",
          url: getSiteUrl(),
          sameAs: [GITHUB_REPO_URL],
        },
      }
    : null;

  return (
    <>
      {appSchema && (
        <script type="application/ld+json">{JSON.stringify(appSchema)}</script>
      )}
      {section && (
        <SeoFaq
          title={section.title}
          about={section.about}
          howToUse={section.howToUse}
          items={section.items}
        />
      )}
      <RelatedTools path={path} />
    </>
  );
}
