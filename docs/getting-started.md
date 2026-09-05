# Getting Started

This guide covers the practical setup for running SuperTools locally and the few deployment details that matter early.

## Requirements

- Node.js `24.x`
- pnpm

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
- Theme supports three modes: light, dark, and system. System mode tracks the OS preference automatically. Users can cycle between light and dark manually; the preference persists across sessions.

## Environment Variables

Local development works without a `.env` file, but production should set:

- `NEXT_PUBLIC_SITE_URL`

### Why `NEXT_PUBLIC_SITE_URL` Matters

SuperTools uses a shared site URL helper for canonical metadata, sitemap output, robots, and structured data. If production falls back to `http://localhost:3000`, SEO signals will be wrong. Treat this as required in real deployments.

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
