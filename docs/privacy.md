# Privacy and Data Handling

Privacy is a product feature in SuperTools, not a marketing footnote. This page explains what that means in concrete terms.

## Core Promise

For normal tool usage, SuperTools is designed so the content you provide is processed locally in the browser rather than being sent to a backend service for transformation.

Examples include:

- pasted text
- uploaded files handled by local tools
- JSON, YAML, CSV, and diff input
- tokens, secrets, ciphertext, and passphrases
- generated passwords and UUIDs
- PDF files, the passwords used to unlock them, and the documents combined by the merger

## What This Promise Does Mean

- Formatting, parsing, encoding, decoding, conversion, and generation logic lives in client-executed code.
- The app does not require a server API for core tool operations.
- Sensitive payloads are not supposed to be shipped to a backend just to make the tool work.

## What This Promise Does Not Mean

It does not mean the site is a sealed box with no network activity at all. Like any web app, SuperTools still serves:

- HTML, JavaScript, CSS, fonts, and images
- static Next.js assets
- optional analytics or performance scripts when enabled in deployment

The important boundary is between serving the app and processing your payload.

## Telemetry

This repo includes optional Vercel integrations for:

- analytics
- speed insights

Policy:

- usage and performance metadata may be collected
- raw sensitive tool payloads should not be logged as analytics data

If you add telemetry, keep that boundary intact.

## The PDF Tools

The PDF password remover and the PDF merger are worth calling out, because this
is the category where hosted tools most often claim privacy they do not deliver.
Most online PDF unlockers upload the document *and its password* to a server,
and most online mergers upload every file you want combined — contracts,
statements, scans — purely to staple them together.

These do not. Each file is read with `File.arrayBuffer()`, transferred into a
Web Worker, and processed there by a WebAssembly build of qpdf. Specifically:

- neither the PDFs nor any password is ever sent over the network
- the worker is created per attempt and terminated as soon as it answers, which
  releases the WASM memory holding the files
- the result is handed back as a blob URL that is revoked when you clear the
  tool or leave the page
- `qpdf.wasm` is served same-origin from `public/pdf/`, so `connect-src 'self'`
  remains unchanged and there is no CDN in the path

Once the page and the engine have loaded, both tools work with no network
connection at all.

## Browser Storage

SuperTools keeps browser-stored state minimal. In practice, that mainly means theme preference plus the browser's normal cache for fetched assets.

That does not change the privacy model, but it is still worth being explicit about what the app stores locally.

## Practical Contributor Rules

- do not send payloads to remote APIs without an explicit product decision
- do not log secrets or raw content
- do not make privacy claims broader than the implementation
- when a tool has caveats, explain them in the UI and docs
