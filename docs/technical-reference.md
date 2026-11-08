# Technical Reference

This page is the practical reference for maintainers. It collects the implementation details that are easy to forget and expensive to relearn.

## Required Validation

Run these before release and before merging meaningful changes:

```bash
pnpm lint
pnpm test:run
pnpm typecheck
pnpm build
pnpm test:e2e
```

`test:e2e` runs last: it starts a server against the build from the previous
step and fails outright if there is no production build to serve. A green
`test:run` on its own says nothing about layout, focus or announcements.

## Runtime and Build Notes

- Package manager: `pnpm`
- Node target: `26.x`
- Framework: Next.js 16 App Router
- TypeScript: `7`
- Linting/formatting: Biome
- Unit tests: Vitest

## Shared Hooks

### `useToolState`

File: [`src/hooks/useToolState.ts`](../src/hooks/useToolState.ts)

Use this when a tool has the common trio of:

- `input`
- `output`
- `error`

It also provides a standard clear handler and a clipboard paste helper. If a tool has multiple primary inputs or more complex validation, use custom state instead of forcing everything through this hook.

### `useClipboard`

File: [`src/hooks/useClipboard.ts`](../src/hooks/useClipboard.ts)

Provides:

- clipboard copy feedback
- clipboard read support
- transient paste error state

### `useAnnouncement` and `useAnnouncer`

File: [`src/hooks/useAnnouncement.ts`](../src/hooks/useAnnouncement.ts)

Produce the sentence a tool feeds to `ToolLiveRegion`.

- `useAnnouncement(message, delayMs, token)` — for live tools. Debounced, so
  typing does not produce a stream of interruptions.
- `useAnnouncer()` — for manual tools. Returns `[message, announce]`; call
  `announce` on the success path.

Both exist because a screen reader only speaks a live region whose text
actually changes. A summary describing a size or a count is identical for two
different results, so `useAnnouncement` takes a `token` identifying the result
itself and alternates an invisible zero-width space when the token moves but the
sentence does not. `useAnnouncer` does the same for a repeated action —
generating five UUIDs twice would otherwise announce once and then fall silent.

### `usePdfDocument`

File: [`src/hooks/usePdfDocument.ts`](../src/hooks/usePdfDocument.ts)

Opens a PDF with pdf.js (imported dynamically, so the renderer only loads once
a file is picked), holds it while pages are drawn, and destroys it when the
file changes or the component unmounts. A load that finishes after a newer file
was picked is discarded rather than allowed to tear down the newer document.
Used by the page previews, the viewer dialog and the merger's cover thumbnails.

### `useRunShortcut` and `useFocusResult`

File: [`src/hooks/useRunShortcut.ts`](../src/hooks/useRunShortcut.ts)

For manual tools only; live tools need neither.

- `useRunShortcut(run, enabled)` — binds ⌘/Ctrl+Enter. Pass `enabled` matching
  whatever disables the visible button: a shortcut that runs an action the UI
  presents as unavailable is a bug.
- `useFocusResult()` — returns `[ref, requestFocus]`. Attach `ref` to whatever
  _is_ the result for the current mode, which is not always one element: RSA's
  outcome is the signature box when signing and the verdict when verifying,
  where that same box is an input. **Call `requestFocus` only on the success
  path** — the request stands until a target renders, so requesting it at the
  top of a handler focuses whichever target happens to exist, even after a
  failure.

## Common Utilities

### Constants

File: [`src/lib/constants.ts`](../src/lib/constants.ts)

Shared values such as text encoding options and input thresholds belong here instead of being repeated across tools.

### Class Merging and Small Helpers

File: [`src/lib/utils.ts`](../src/lib/utils.ts)

This is the right place for narrow reusable helpers like class merging and strict integer parsing.

## SEO and Indexing

Relevant files:

- [`src/lib/site.ts`](../src/lib/site.ts) — site URL, repository link, author entity
- [`src/lib/tools.ts`](../src/lib/tools.ts) — tool names, descriptions and categories
- [`src/lib/seo.ts`](../src/lib/seo.ts)
- [`src/lib/tool-seo.ts`](../src/lib/tool-seo.ts) — per-tool FAQ and how-to copy
- [`src/lib/last-modified.ts`](../src/lib/last-modified.ts) — sitemap `lastmod` dates
- [`src/app/sitemap.ts`](../src/app/sitemap.ts)
- [`src/app/robots.ts`](../src/app/robots.ts)

Important details:

- **`NEXT_PUBLIC_SITE_URL` is required for deployments.** On Vercel or in CI,
  `getSiteUrl()` throws if it is unset, so the build fails rather than shipping
  localhost canonicals. Locally it falls back to `http://localhost:3100`.
- **Tool names live in one place.** A tool page's `<h1>` comes from
  `toolName(href)`, and its FAQ heading and `WebApplication` name are built from
  the same entry, so the sidebar, page title, heading and structured data cannot
  disagree. `toolName` throws for an unknown route.
- **`lastmod` tracks real content changes.** Bump a date in
  `last-modified.ts` when a page's visible content changes, not on every deploy.
  Tool pages share `TOOL_PAGES_LAST_MODIFIED`; every other sitemap page needs
  its own entry, and a missing one throws. The unit test checks every sitemap
  URL resolves to a valid date that is not in the future.
- **Site-wide links use `prefetch={false}`.** The sidebar, footer, home grid,
  category pages and related-tools block link to every tool from every page.
  With prefetching on, each page view triggered dozens of `?_rsc=` requests that
  crawlers followed and counted against the crawl budget. Keep it off for any
  new link list that repeats across pages.
- **Structured data names one author.** The Organization lists Amaresh
  Mohapatra as `founder` and every tool's `WebApplication` names the same person as
  `author`, both using `authorSchema` from `site.ts`. Its `@id` is the one
  amaresh.me gives the same person, so keep the two sites' `@id` and `sameAs`
  in step.
- **The 404 page has no canonical.** It sets `canonical: null`, so it cannot
  point search engines at the home page as a duplicate.

## Security Baseline

- Security headers and CSP are configured in [`next.config.ts`](../next.config.ts).
- Do not use `dangerouslySetInnerHTML` or raw HTML injection patterns. The global error page uses pure inline styles for this reason.
- Do not log sensitive payload content to analytics.
- Keep claims about encryption, signatures, and verification accurate to the implemented behavior.
- The global focus outline is suppressed in `globals.css` so that component-level `focus-visible:ring-*` styles are the sole source of focus indicators, preventing double-ring conflicts.

## Testing Strategy

Most regression coverage lives next to the pure logic in [`src/lib`](../src/lib). That is intentional:

- it keeps tests fast
- it avoids over-coupling tests to page markup
- it protects the logic that is easiest to regress silently

When a user-facing bug comes from parsing, conversion, validation, or flag handling, start by writing a small lib-level regression test.

Browser tests in [`tests/e2e`](../tests/e2e) cover what unit tests cannot:
toolbar overflow at 375 px, colour contrast in both themes, live-region
announcements, focus, consent ordering, reduced motion, and the PDF tools end
to end — including comparisons of the page-selection parser against real qpdf
output. They drive Chromium through `playwright-core` against the production
build.

## Tool Authoring Guidance

When adding or refactoring a tool:

1. put the transformation logic in `src/lib`
2. keep the page focused on state and UI orchestration
3. add limits for heavy work
4. add or update tests
5. wire SEO metadata and FAQ content if the route is public
6. update docs when behavior changes materially
