/**
 * When each page's content last changed in a way a reader would notice, for
 * the sitemap's <lastmod>. Google only trusts lastmod while it tracks real
 * changes, so bump a date when you edit what a page says (copy, FAQ, the
 * tool's behaviour) — not on every deploy, and not for refactors.
 *
 * Tool pages without an entry fall back to TOOL_PAGES_LAST_MODIFIED; bump that
 * for changes that touch every tool page (shared FAQ/schema/layout copy).
 */
export const TOOL_PAGES_LAST_MODIFIED = "2026-11-07";

export const PAGE_LAST_MODIFIED: Record<string, string> = {
  "/": "2026-11-07",
  "/about": "2026-11-07",
  "/privacy": "2026-09-15",
  "/tools/category": "2026-11-07",
};

export function lastModifiedFor(path: string): Date {
  const key = path.startsWith("/tools/category/") ? "/tools/category" : path;
  const date = PAGE_LAST_MODIFIED[key] ?? TOOL_PAGES_LAST_MODIFIED;
  return new Date(`${date}T00:00:00Z`);
}
