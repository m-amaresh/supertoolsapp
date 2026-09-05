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
- Node target: `24.x`
- Framework: Next.js 16 App Router
- TypeScript: `6`
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

### `useRunShortcut` and `useFocusResult`

File: [`src/hooks/useRunShortcut.ts`](../src/hooks/useRunShortcut.ts)

For manual tools only; live tools need neither.

- `useRunShortcut(run, enabled)` — binds ⌘/Ctrl+Enter. Pass `enabled` matching
  whatever disables the visible button: a shortcut that runs an action the UI
  presents as unavailable is a bug.
- `useFocusResult()` — returns `[ref, requestFocus]`. Attach `ref` to whatever
  *is* the result for the current mode, which is not always one element: RSA's
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

- [`src/lib/site.ts`](../src/lib/site.ts)
- [`src/lib/seo.ts`](../src/lib/seo.ts)
- [`src/lib/tool-seo.ts`](../src/lib/tool-seo.ts)
- [`src/app/sitemap.ts`](../src/app/sitemap.ts)
- [`src/app/robots.ts`](../src/app/robots.ts)

Important detail:

- `NEXT_PUBLIC_SITE_URL` should be set in production.
- If it is missing, the shared site helper can fall back to localhost, which is unacceptable for a real deployment.

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

## Tool Authoring Guidance

When adding or refactoring a tool:

1. put the transformation logic in `src/lib`
2. keep the page focused on state and UI orchestration
3. add limits for heavy work
4. add or update tests
5. wire SEO metadata and FAQ content if the route is public
6. update docs when behavior changes materially
