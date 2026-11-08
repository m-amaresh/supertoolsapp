# SuperTools

<p align="center">
  <a href="https://github.com/m-amaresh/supertoolsapp/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/m-amaresh/supertoolsapp/ci.yml?style=for-the-badge&label=CI&logo=github" />
  </a>
  <a href="https://www.supertoolsapp.com">
    <img src="https://img.shields.io/badge/Vercel-deployed-000000?style=for-the-badge&logo=vercel&logoColor=white" />
  </a>
  <br/>
  <img src="https://img.shields.io/badge/node-26.x-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Next.js-16.x.x-black?style=for-the-badge&logo=next.js&logoColor=white" />
</p>

A fast, privacy-first suite of developer utilities that run entirely in your browser. No data leaves your machine.

## What You Get

- **32 browser-based tools** across generators, encoding, cryptography, PDF, data conversion, text processing, network, and time utilities
- **Client-side processing** — payloads (text, files, tokens, secrets) are transformed locally, never sent to a server
- **Consistent UX** — every tool follows the same scaffold, toolbar, status, and output patterns
- **Modern stack** — Next.js 16, React 19, TypeScript 7, Tailwind CSS 4, Biome, Vitest

### Tool Inventory

| Category            | Tools                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Generators**      | UUID Generator, Strong Password Generator, Lorem Ipsum Generator, QR Code Generator                                                          |
| **Encode / Decode** | Base64, Base32, Base58 and Hex Encoders & Decoders, URL Encoder & Decoder, URL Parser & Query Builder, String Escape & Unescape, JWT Decoder |
| **Crypto**          | Hash Generator, CRC32 Checksum Calculator, AES Encryption & Decryption, RSA Sign & Verify, TLS Certificate Decoder                           |
| **PDF**             | PDF Password Remover, PDF Password Protector, PDF Merger, PDF Splitter                                                                       |
| **Data**            | JSON Formatter & Validator, YAML to JSON Converter, CSV to JSON Converter, Number Base Converter, Color Converter                            |
| **Text**            | Text Diff Checker, Case Converter, Regex Tester                                                                                              |
| **Network**         | CIDR / Subnet Calculator                                                                                                                     |
| **Time**            | Unix Timestamp Converter, Cron Expression Parser & Builder                                                                                   |

The categories match the site's sidebar and `/tools/category/*` pages; names come from [`src/lib/tools.ts`](src/lib/tools.ts).

## Quick Start

**Requirements:** Node.js `26.x`, pnpm `12.x`

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3100`.

## Commands

| Command          | Purpose                                      |
| ---------------- | -------------------------------------------- |
| `pnpm dev`       | Start dev server on port 3100                |
| `pnpm build`     | Production build                             |
| `pnpm start`     | Serve production build                       |
| `pnpm lint`      | Lint and format check (Biome)                |
| `pnpm format`    | Auto-format (Biome)                          |
| `pnpm test:run`  | Run unit tests                               |
| `pnpm test:e2e`  | Run browser tests (needs `pnpm build` first) |
| `pnpm typecheck` | Type-check without emitting                  |

## Privacy Model

Tool payloads — JSON, YAML, CSV, regex input, secrets, tokens, ciphertext, passphrases, generated passwords, uploaded files — are processed locally in the browser. The app does not send them to any backend service.

Network activity is limited to serving app assets (HTML, JS, CSS, fonts), optional Vercel analytics metadata, and — where a measurement ID is configured — Google Analytics with a cookie preference banner and cookieless measurement before acceptance. The important boundary is between _serving the app_ and _processing your data_: analytics counts page views, and never sees what you paste into a tool.

Full policy: [docs/privacy.md](docs/privacy.md)

## Project Layout

```
src/
  app/              Routes, layouts, metadata, global styles, tool pages
  components/       App shell, header, sidebar, shared tool scaffold
  components/ui/    shadcn/ui primitives (button, input, select, etc.)
  hooks/            Shared client hooks (tool state, clipboard, announcements,
                    run shortcut, pdf.js document loading)
  lib/              Pure logic — parsers, encoders, generators, validators, SEO

public/pdf/         qpdf Web Workers (hand-written, tracked); qpdf.js / qpdf.wasm
                    copied in at dev/build time
public/pdfjs/       pdf.js worker for PDF previews (copied in, gitignored)
public/consent/     Vendored Silktide consent manager
scripts/            Build helpers that copy the qpdf and pdf.js assets
tests/e2e/          Browser tests against the production build
docs/               Project documentation
```

## Stack

| Layer           | Technology                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16 (App Router)                                                                                 |
| Language        | TypeScript 7                                                                                            |
| Styling         | Tailwind CSS 4 + shadcn/ui                                                                              |
| Icons           | Font Awesome 7 (tree-shaken path imports)                                                               |
| Theming         | next-themes (light, dark, system)                                                                       |
| Crypto          | Web Crypto API (AES-GCM, RSA, SHA-1/2, HMAC); @noble/hashes for SHA-3 (audited, pure JS)                |
| PDF             | qpdf 12 compiled to WebAssembly (runs in a Web Worker); pdf.js for page previews                        |
| Lint & Format   | Biome                                                                                                   |
| Tests           | Vitest (unit), Vitest + playwright-core with Chromium (browser)                                         |
| Package Manager | pnpm                                                                                                    |
| Deployment      | Vercel (optional analytics + speed insights)                                                            |
| Consent         | [Silktide Consent Manager](https://github.com/silktide/consent-manager) (MIT), vendored and self-hosted |

## Environment Variables

Local development works without configuration.

| Variable                        | Purpose                                                                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | Canonical metadata, sitemap output, and structured data. Set this for any real deployment.                                                                                                                        |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | GA4 measurement ID (`G-XXXXXXXXXX`). **Disabled on Vercel preview deployments. Leave unset and there is no Google Analytics, no cookie banner, and no CSP relaxation at all** — the build stays same-origin only. |

The measurement ID is validated, not just read: a malformed value is treated as unset, so a typo cannot ship a cookie banner that reports to nothing.

## Pre-Merge Checklist

```bash
pnpm lint
pnpm test:run
pnpm typecheck
pnpm build
pnpm test:e2e
```

All five must pass before merging; CI runs the same steps on every push and pull request to `preview` and `main`. `test:e2e` serves the build from the step before it.

## Documentation

Detailed guides live in [`docs/`](docs/):

1. [Getting Started](docs/getting-started.md) — setup, commands, local expectations
2. [Privacy & Data Handling](docs/privacy.md) — the privacy contract and contributor rules
3. [Architecture](docs/architecture.md) — layers, tool page pattern, design decisions
4. [Technical Reference](docs/technical-reference.md) — hooks, utilities, SEO, testing, security
5. [Tool Catalog](docs/tool-catalog.md) — full route inventory and product direction

## Author

Built and maintained by [Amaresh Mohapatra](https://www.amaresh.me).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version:

- Keep tool processing client-side
- Put transformation logic in `src/lib/`, not in page components
- Preserve the shared tool scaffold and interaction model
- Add defensive limits for expensive operations
- Do not weaken privacy or security claims
- Update docs when behavior changes
