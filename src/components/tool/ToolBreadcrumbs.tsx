import { faChevronRight } from "@fortawesome/free-solid-svg-icons/faChevronRight";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { getSiteUrl } from "@/lib/site";
import { slugForCategory, toolDefinitions } from "@/lib/tools";

interface ToolBreadcrumbsProps {
  path: string;
}

// Visible breadcrumb trail plus BreadcrumbList JSON-LD so search engines can
// render breadcrumb rich results. Home, the category hub page, and the current
// tool are all included as fully-linked crumbs.
export function ToolBreadcrumbs({ path }: ToolBreadcrumbsProps) {
  const tool = toolDefinitions.find((t) => t.href === path);
  if (!tool) return null;

  const siteUrl = getSiteUrl();
  const categorySlug = slugForCategory(tool.sidebarCategory);
  const categoryPath = `/tools/category/${categorySlug}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: tool.sidebarCategory,
        item: `${siteUrl}${categoryPath}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: tool.name,
        item: `${siteUrl}${tool.href}`,
      },
    ],
  };

  return (
    <nav aria-label="Breadcrumb" className="mb-3 px-1">
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
      {/* Crumb links carry `min-h-6` so the tap target clears the WCAG 2.5.8
          24px minimum; the 12px text alone left them 15px tall. */}
      <ol className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
        <li>
          <Link
            href="/"
            className="inline-flex min-h-6 min-w-6 items-center justify-center transition-colors hover:text-foreground"
          >
            Home
          </Link>
        </li>
        <li aria-hidden="true">
          <FontAwesomeIcon icon={faChevronRight} className="h-2 w-2" />
        </li>
        <li>
          <Link
            href={categoryPath}
            className="inline-flex min-h-6 min-w-6 items-center justify-center transition-colors hover:text-foreground"
          >
            {tool.sidebarCategory}
          </Link>
        </li>
        <li aria-hidden="true">
          <FontAwesomeIcon icon={faChevronRight} className="h-2 w-2" />
        </li>
        <li className="font-medium text-foreground" aria-current="page">
          {tool.name}
        </li>
      </ol>
    </nav>
  );
}
