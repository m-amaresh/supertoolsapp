import Link from "next/link";
import { toolDefinitions } from "@/lib/tools";

interface RelatedToolsProps {
  path: string;
}

// Internal links to sibling tools in the same category, topped up with featured
// tools so every page links out to peers. Improves crawl depth, topical
// relevance, and time-on-site.
export function RelatedTools({ path }: RelatedToolsProps) {
  const current = toolDefinitions.find((t) => t.href === path);
  if (!current) return null;

  const sameCategory = toolDefinitions.filter(
    (t) =>
      t.available &&
      t.href !== path &&
      t.sidebarCategory === current.sidebarCategory,
  );
  const featured = toolDefinitions.filter(
    (t) =>
      t.available &&
      t.href !== path &&
      t.featured &&
      t.sidebarCategory !== current.sidebarCategory,
  );

  const seen = new Set<string>();
  const related = [...sameCategory, ...featured]
    .filter((t) => !seen.has(t.href) && seen.add(t.href))
    .slice(0, 6);

  if (related.length === 0) return null;

  return (
    <section className="mt-6" aria-label="Related tools">
      <div className="glass-panel rounded-xl border border-border p-4 sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
          Related tools
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {related.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/50 hover:bg-foreground/[0.03]"
              >
                <span className="text-[14px] font-medium text-foreground">
                  {t.name}
                </span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">
                  {t.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
