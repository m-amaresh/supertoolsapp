import { toolCategories, toolDefinitions } from "./tools";

/**
 * When each page's content last changed in a way a reader would notice, for
 * the sitemap's <lastmod>. Google only trusts lastmod while it tracks real
 * changes, so bump a date when you edit what a page says (copy, FAQ, the
 * tool's behaviour) — not on every deploy, and not for refactors.
 *
 * Dates are calendar days (YYYY-MM-DD, a valid W3C datetime), so there is no
 * time zone to get wrong.
 */

/**
 * Tool pages share one date unless listed in PAGE_LAST_MODIFIED. Bump it for
 * changes that touch every tool page (shared FAQ, schema or layout copy).
 */
export const TOOL_PAGES_LAST_MODIFIED = "2026-11-07";

/**
 * Every non-tool page in the sitemap needs an entry here; a missing one
 * throws rather than silently borrowing a date. Category pages list their
 * tools' names and descriptions, so bump one when a tool in it is renamed.
 */
export const PAGE_LAST_MODIFIED: Record<string, string> = {
  "/": "2026-11-07",
  "/about": "2026-11-08",
  "/privacy": "2026-09-15",
  "/tools/category/generators": "2026-11-07",
  "/tools/category/encode-decode": "2026-11-07",
  "/tools/category/crypto": "2026-11-07",
  "/tools/category/pdf": "2026-11-07",
  "/tools/category/data": "2026-09-05",
  "/tools/category/text": "2026-09-05",
  "/tools/category/network": "2026-09-05",
  "/tools/category/time": "2026-11-07",
};

const TOOL_PATHS = new Set(toolDefinitions.map((tool) => tool.href));

function assertCalendarDate(date: string, source: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  // The round trip rejects both bad formats and impossible days (2026-02-30).
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`Invalid lastmod date "${date}" for ${source}`);
  }
  return date;
}

export function lastModifiedFor(path: string): string {
  const date = PAGE_LAST_MODIFIED[path];
  if (date !== undefined) return assertCalendarDate(date, path);
  if (TOOL_PATHS.has(path)) {
    return assertCalendarDate(TOOL_PAGES_LAST_MODIFIED, path);
  }
  throw new Error(`No lastmod date for ${path}; add it to PAGE_LAST_MODIFIED`);
}

/** Every page the sitemap lists, each of which must resolve a date above. */
export function sitemapPaths(): string[] {
  return [
    "/",
    "/about",
    "/privacy",
    ...toolCategories.map((category) => `/tools/category/${category.slug}`),
    ...toolDefinitions
      .filter((tool) => tool.available)
      .map((tool) => tool.href),
  ];
}
