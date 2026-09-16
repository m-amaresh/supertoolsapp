# Architecture

SuperTools is a Next.js App Router application with a simple architectural rule: keep tool logic predictable, portable, and local to the browser whenever possible.

## High-Level Shape

```text
src/
  app/                  Routes, layouts, metadata, global styles, tool pages
  components/           App shell and reusable UI composition
  components/ui/        shadcn/ui primitives
  hooks/                Small reusable client hooks
  lib/                  Pure logic, parsers, generators, SEO helpers, utilities

docs/                   Project documentation
```

## Main Layers

### `src/lib`

This is where most of the real work belongs:

- encoders and decoders
- parsers and formatters
- generators
- validation helpers
- route metadata and SEO helpers

The goal is to keep this layer mostly framework-independent and easy to test.

### `src/app/tools`

Tool pages live here. A page should mostly do orchestration:

- manage UI state
- call into `src/lib`
- wire up toolbar actions
- render the shared scaffold consistently

When tool logic starts getting large inside a page file, it usually belongs in `src/lib`.

### `src/components`

This layer holds:

- the app shell
- the header and sidebar
- shared tool layout primitives
- status and FAQ components
- small reusable UI composition pieces

### `src/hooks`

The hook layer is intentionally small and focused:

- [`useToolState`](../src/hooks/useToolState.ts) for common input/output/error state
- [`useClipboard`](../src/hooks/useClipboard.ts) for clipboard actions and feedback
- [`useAnnouncement`](../src/hooks/useAnnouncement.ts) for the result sentence a tool announces — `useAnnouncement` for live tools (debounced, with a change token) and `useAnnouncer` for manual ones
- [`useRunShortcut`](../src/hooks/useRunShortcut.ts) for the ⌘/Ctrl+Enter accelerator on manual tools, and `useFocusResult` for moving focus to the result

## Tool Page Pattern

Most tools follow the same basic shape:

1. initialize state
2. call pure helpers from `src/lib`
3. render the shared scaffold
4. show success, warning, and error states clearly

This consistency is deliberate. Users should not have to relearn the UI for every tool.

## Tool UI Rules

The scaffold gives every tool the same slots — toolbar, options bar, status stack, body. That is not enough on its own: the same slot came to mean different things on different pages, so learning one tool did not transfer to the next. These six rules fix the meaning of each slot.

They were chosen off the back of a UI/UX audit of all 29 tool pages, which found the same visual slot meaning different things on different pages. This section is the decision rather than the argument: when adding or changing a tool, follow it here.

Each rule notes where the codebase does not yet conform. Those lists are the remaining remediation work, not permission to add more.

### 1. When a tool computes

**A tool computes live unless the work is expensive, destructive, or needs a credential.**

- **Live tools have no action button.** Output updates as the user types, debounced.
- **Manual tools have exactly one filled `variant="default"` button**, labelled with the verb it performs, placed at the end of the input flow.
- A button that recomputes what is already on screen is a lie about how the tool works. Do not add one.

Manual tools, each with a stated reason: `aes` and `rsa` (key derivation is expensive), `pdf-unlock` and `pdf-encrypt` (WASM plus a password) and `pdf-merge` (WASM over several files), `tls-cert` (parses a certificate chain on demand), `password`, `uuid` and `lorem` (generators — re-running is the point), `diff` (expensive on large inputs). Everything else is live.

*Conforming.* No live tool carries a filled button that recomputes what is already on screen. `timestamp`'s `Use current time` is a ghost convenience that fills the input. `qrcode` does keep a filled `SVG` button, which is correct — it exports a file rather than recomputing, and only appears once a code exists.

### 2. Where output goes

**Split when input and output are compared line by line; stacked when the output is a single value.**

Split (`md:grid-cols-2` on `ToolBody`) suits structured multi-line documents — `json`, `yaml`, `csv`, `diff`. Stacked suits a value the user copies whole — encoders, hashes, checksums, case conversion. Split layouts must collapse to stacked below `lg`.

*Conforming.* `escape` was moved to split; `rsa` was already stacked.

### 3. Where clipboard actions go

**`Copy` belongs in the output's label row. `Paste` belongs in the input's label row. Neither belongs in the toolbar.**

A toolbar `Copy` does not say what it will put on the clipboard. That is already ambiguous on pages with more than one copyable region — `cron`, `cidr` and `url-parser` each have several — and it is ambiguous by construction, not by accident.

*Conforming.* No `Copy` or `Paste` remains in any toolbar. Where a tool has several copyable regions, each row owns its own `Copy` and the "copy all" sits in the results header — `hash` shows the pattern for both its digest and HMAC blocks. `tests/e2e/filled-state.test.ts` fails the build if two `Copy` buttons appear in one row.

### 4. What a field is called

**A field's label states what it holds in the current mode; an output label names the type produced, not the operation.**

The pattern is `<what it holds> to <what happens to it>` — `Text to Encode`, `Base64 to Decode`. If a tool has a direction toggle, its labels change with it, including the options-bar label: in decode mode `Input Encoding` becomes `Output Encoding`, because the encoding then describes the result rather than the source.

The full convention is already correct in `base64`, `base32`, `hex` and `url`. Extend it; do not invent a second one.

*Conforming.* `escape`'s input and `csv`'s output — the only two labels genuinely fixed beside a direction toggle — now track the mode, and `yaml`, `aes`, `base58`, `rsa`, `hash` and `crc32` were rephrased onto the convention.

### 5. What an empty state says

**Two sentence shapes, one per interaction model, so the empty state teaches which kind of tool this is.**

- Live tools end with **"as you type"** — `Encoded output appears here as you type`.
- Manual tools name their button — `Click Generate to create UUIDs`.

"as you type" is the only place a live tool tells the user it is live. Never instruct a click that is not required.

*Conforming.* All 18 live tools with an empty state end with "as you type", mode-aware where a mode exists. Manual tools name their button.

### 6. What lives in the toolbar

**Verbs only. Mode, direction and format are settings, and settings live in the options bar.**

A mutually-exclusive choice is always a `SegmentedControl`, never two buttons — it gets `role="radio"` semantics and arrow-key navigation for free. Putting a mode toggle beside the action it modifies also produces the same word twice in one row, once as a setting and once as an action, distinguishable only by button styling.

*Conforming.* Every mode, direction and view toggle now sits in the options bar. With Phase 0's `flex-wrap` disabled, all 30 toolbars still fit a 375px card unaided — the wrapping is now insurance rather than the thing holding the layout together.

### Accessibility invariants

These are settled and enforced; do not regress them.

- Every tool renders a [`ToolLiveRegion`](../src/components/tool/ToolScaffold.tsx) announcing its result. Live tools debounce it with `useAnnouncement`; manual tools push to it with `useAnnouncer`, which alternates a zero-width space so repeating an identical result still announces.
- A success `AlertBox` on a tool with a live region takes `role="presentation"`, or the outcome is announced twice.
- `ToolbarSelect` takes an `id` matched by the surrounding `ToolbarGroup`'s `htmlFor`, so the visible label is the accessible name. A select with neither `id` nor `ariaLabel` fails to type-check — that is deliberate.
- Sidebar category captions are not headings. The first heading on a tool page is its `<h1>`.
- Interactive targets are at least 24×24 CSS pixels, counting hit-area overlays. Measure the target, not the border box.
- `tests/e2e/toolbar-overflow.test.ts` asserts no tool toolbar overflows its card at 375 px, across every available tool.
- Colour contrast and focus-ring contrast are measured, not assumed: `tests/e2e/contrast.test.ts` computes ratios against each element's composited background in both themes, and opens with a self-test that injects known-bad text — a checker matching nothing reports zero failures and looks like a pass.
- `tests/e2e/filled-state.test.ts` drives each tool to a **real result** first, then asserts: no duplicate `Copy` in a row, nothing wider than its container at 375 px, a live-region mutation for a *second, different* result, focus leaving the action button on manual tools, and no interactive target under 24×24 **including `tabIndex=-1`**. Presence checks are not enough — every one of those was green while the behaviour was broken.
- Anything asynchronous in a tool compares against an attempt counter before publishing. `pdf-unlock` shows the pattern: selection, password edits, Clear and unmount all invalidate the run in flight.

## Shared Product Decisions

### Browser-First Processing

Core payload transformations are intended to run on the client. That supports the product’s privacy position and keeps most tools fast and dependency-light.

### Defensive Limits

Large inputs and heavy operations should have clear guardrails. A tool should degrade honestly instead of pretending everything is fine while freezing the tab.

### SEO by Convention

Metadata, tool intent keywords, FAQ content, canonical handling, sitemap output, and structured data are centralized instead of being hand-authored ad hoc on every route.

Relevant files:

- [`src/lib/seo.ts`](../src/lib/seo.ts)
- [`src/lib/tool-seo.ts`](../src/lib/tool-seo.ts)
- [`src/lib/site.ts`](../src/lib/site.ts)
- [`src/components/SeoFaq.tsx`](../src/components/SeoFaq.tsx)
- [`src/components/ToolSeoFaqServer.tsx`](../src/components/ToolSeoFaqServer.tsx)

## WebAssembly and the PDF Tools

The PDF tools are the one place where a pure-TypeScript implementation was not
the right call. Removing PDF encryption correctly means parsing cross-reference
tables and streams, object streams, and every standard security handler (RC4
40/128, AES-128, AES-256); assembling pages from several documents means
rewriting object numbers, resources and page trees without breaking any of it.
[qpdf](https://qpdf.readthedocs.io/) has done both for twenty years, so it is
compiled to WebAssembly and driven directly.

`pdf-unlock` and `pdf-merge` each own a worker in `public/pdf/` and a module in
`src/lib/`. What they share — the PDF header check, the size ceiling, the exit
code rules, the warning extraction — lives in
[`src/lib/qpdf.ts`](../src/lib/qpdf.ts), so the two tools cannot drift into two
conventions for the same engine behaviour. What differs is what an error *means*
to the reader, and that stays in each tool's own module.

Consequences worth knowing about:

- **Instantiating WebAssembly requires `'wasm-unsafe-eval'` in `script-src`.**
  A dedicated worker takes its CSP from the response headers of *its own script
  URL*, not from the page that created it. The worker is therefore served as a
  static file from `public/pdf/` so that relaxation can be scoped to that one
  directory in [`next.config.ts`](../next.config.ts). Every page in the app,
  including the PDF tool itself, keeps the strict policy, and no other worker
  gains the capability.
- **The engine is not bundled.** `qpdf.js` and `qpdf.wasm` are copied from
  `node_modules` into `public/pdf/` by
  [`scripts/copy-qpdf-wasm.mjs`](../scripts/copy-qpdf-wasm.mjs), which runs from
  `dev` and `build`. They are gitignored. This keeps a 1.3 MB binary out of the
  app bundle, means nothing about qpdf is downloaded until someone actually
  unlocks a file, and avoids stubbing the Node built-ins that the Emscripten
  glue references from an unreachable code path.
- **The worker stays thin.** It runs qpdf and reports raw exit codes and output.
  All interpretation — deciding that exit code 2 with `invalid password` means
  a wrong password rather than a damaged file — lives in
  [`src/lib/pdf-unlock.ts`](../src/lib/pdf-unlock.ts), where it is unit tested.
  The worker itself is plain JavaScript in `public/`, so keeping logic out of it
  is deliberate.
- **Exit code 3 is success.** qpdf returns 3 when the operation completed but
  printed warnings, which real-world PDFs do routinely — a cross-reference
  table that disagrees with the object count, say. Both passes accept 0 and 3;
  treating 3 as a failure rejects files that unlock perfectly well. The
  warnings are surfaced alongside the result rather than in place of it.
- **Raw qpdf output is scrubbed before display.** `--show-encryption` prints the
  document's user password when the owner password is the one supplied, so
  `redactQpdfSecrets` strips it before any output reaches the UI.

## App Shell and Runtime Concerns

- The global shell lives in [`src/components/AppShell.tsx`](../src/components/AppShell.tsx).
- Light, dark, and system themes are handled by `next-themes`. System mode tracks the OS preference and updates live when it changes.
- Security headers and CSP are set in [`next.config.ts`](../next.config.ts).

## What This App Does Not Try to Be

- a multi-user platform
- a cloud sync product
- a backend processing service
- a generic CMS for arbitrary tool pages

Keeping the scope narrow is part of how the app stays understandable.
