# Getting Started

This guide covers the practical setup for running SuperTools locally and the few deployment details that matter early.

## Requirements

- Node.js `26.x`
- pnpm `12.x`

## Install and Run

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3100`.

## Everyday Commands

```bash
pnpm dev
pnpm lint
pnpm test:run
pnpm typecheck
pnpm build
pnpm start
```

`pnpm test:run` covers `src/lib` only. The browser tests live behind
`pnpm test:e2e` and need a production build first — they refuse to run against
`next dev`, because the layout defects they guard are properties of the built
CSS.

## What to Expect Locally

- The app runs as a normal Next.js App Router project.
- Tool payloads are processed client-side.
- Theme supports three modes: light, dark, and system. System mode tracks the OS preference automatically. The header toggle switches between light and dark; the choice persists across sessions.

## Environment Variables

Local development works without a `.env` file. Deployments set:

- `NEXT_PUBLIC_SITE_URL` — required
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — optional; see [Privacy](privacy.md#google-analytics)

### Why `NEXT_PUBLIC_SITE_URL` Matters

SuperTools uses a shared site URL helper ([`src/lib/site.ts`](../src/lib/site.ts)) for canonical metadata, sitemap output, robots, and structured data. Locally it falls back to `http://localhost:3100`. On Vercel or in CI a build without it fails on purpose, because a localhost canonical in production would send every SEO signal to the wrong host.

## Local Validation

Before opening a PR or cutting a release, run:

```bash
pnpm lint
pnpm test:run
pnpm typecheck
pnpm build
pnpm test:e2e
```

`test:e2e` comes last because it serves the build produced by the step above it.

## First Places to Look in the Code

- [`src/app`](../src/app): routes, layouts, metadata, and global styles
- [`src/components`](../src/components): shared shell and UI composition
- [`src/lib`](../src/lib): transformation logic, helpers, and SEO support
- [`src/hooks`](../src/hooks): shared client hooks
- [`tests/e2e`](../tests/e2e): browser tests against the production build
