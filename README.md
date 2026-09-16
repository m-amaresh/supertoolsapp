# SuperTools

<p align="center">
  <a href="https://github.com/m-amaresh/supertoolsapp/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/m-amaresh/supertoolsapp/ci.yml?style=for-the-badge&label=CI&logo=github" />
  </a>
  <a href="https://www.supertoolsapp.com">
    <img src="https://img.shields.io/badge/Vercel-deployed-000000?style=for-the-badge&logo=vercel&logoColor=white" />
  </a>
  <br/>
  <img src="https://img.shields.io/badge/node-24.x-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-16.x.x-black?style=for-the-badge&logo=next.js&logoColor=white" />
</p>

A fast, privacy-first suite of developer utilities that run entirely in your browser. No data leaves your machine.

## What You Get

- **32 browser-based tools** across encoding, data conversion, cryptography, PDF, text processing, ID generation, network, and time utilities
- **Client-side processing** — payloads (text, files, tokens, secrets) are transformed locally, never sent to a server
- **Consistent UX** — every tool follows the same scaffold, toolbar, status, and output patterns
- **Modern stack** — Next.js 16, React 19, TypeScript 6, Tailwind CSS 4, Biome, Vitest

### Tool Inventory

| Category | Tools |
|---|---|
| **Encoding & Crypto** | Base64, Base32, Base58, Hex, URL Encode/Decode, URL Parser, Escape/Unescape, AES, RSA, Hash/HMAC, CRC32, JWT Decoder, TLS Certificate Inspector |
| **PDF** | PDF Password Remover, PDF Password Protector, PDF Merger, PDF Splitter |
| **Data** | JSON Formatter, YAML Converter, CSV Converter, Base Converter, Color Converter |
| **Text** | Diff Viewer, Regex Tester, Case Converter, Lorem Ipsum Generator |
| **IDs & Passwords** | UUID Generator, Password Generator, QR Code Generator |
| **Network** | CIDR / Subnet Calculator |
| **Time** | Unix Timestamp Converter, Cron Expression Parser |

## Quick Start

**Requirements:** Node.js `24.x`, pnpm

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3100`.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server on port 3100 |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | Lint and format check (Biome) |
| `pnpm format` | Auto-format (Biome) |
| `pnpm test:run` | Run unit tests |
| `pnpm test:e2e` | Run browser tests (needs `pnpm build` first) |
| `pnpm typecheck` | Type-check without emitting |

## Privacy Model

Tool payloads — JSON, YAML, CSV, regex input, secrets, tokens, ciphertext, passphrases, generated passwords, uploaded files — are processed locally in the browser. The app does not send them to any backend service.

Network activity is limited to serving app assets (HTML, JS, CSS, fonts), optional Vercel analytics metadata, and — where a measurement ID is configured — Google Analytics with a cookie preference banner and cookieless measurement before acceptance. The important boundary is between *serving the app* and *processing your data*: analytics counts page views, and never sees what you paste into a tool.

Full policy: [docs/privacy.md](docs/privacy.md)

## Project Layout

```
src/
  app/              Routes, layouts, metadata, global styles, tool pages
  components/       App shell, header, sidebar, shared tool scaffold
  components/ui/    shadcn/ui primitives (button, input, select, etc.)
  hooks/            Shared client hooks (useToolState, useClipboard)
  lib/              Pure logic — parsers, encoders, generators, validators, SEO

public/pdf/         PDF workers (qpdf.js / qpdf.wasm copied at build time)
scripts/            Build helpers
docs/               Project documentation
```

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 6 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Icons | Font Awesome 7 (tree-shaken path imports) |
| Theming | next-themes (light, dark, system) |
| Crypto | @noble/hashes (audited, pure JS) |
| PDF | qpdf 12 compiled to WebAssembly (runs in a Web Worker) |
| Lint & Format | Biome |
| Tests | Vitest |
| Package Manager | pnpm |
| Deployment | Vercel (optional analytics + speed insights) |
| Consent | [Silktide Consent Manager](https://github.com/silktide/consent-manager) (MIT), vendored and self-hosted |

## Environment Variables

Local development works without configuration.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical metadata, sitemap output, and structured data. Set this for any real deployment. |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 measurement ID (`G-XXXXXXXXXX`). **Disabled on Vercel preview deployments. Leave unset and there is no Google Analytics, no cookie banner, and no CSP relaxation at all** — the build stays same-origin only. |

The measurement ID is validated, not just read: a malformed value is treated as unset, so a typo cannot ship a cookie banner that reports to nothing.

## Pre-Merge Checklist

```bash
pnpm lint
pnpm test:run
pnpm typecheck
pnpm build
```

All four must pass before merging.

## Documentation

Detailed guides live in [`docs/`](docs/):

1. [Getting Started](docs/getting-started.md) — setup, commands, local expectations
2. [Privacy & Data Handling](docs/privacy.md) — the privacy contract and contributor rules
3. [Architecture](docs/architecture.md) — layers, tool page pattern, design decisions
4. [Technical Reference](docs/technical-reference.md) — hooks, utilities, SEO, testing, security
5. [Tool Catalog](docs/tool-catalog.md) — full route inventory and product direction

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version:

- Keep tool processing client-side
- Put transformation logic in `src/lib/`, not in page components
- Preserve the shared tool scaffold and interaction model
- Add defensive limits for expensive operations
- Do not weaken privacy or security claims
- Update docs when behavior changes
