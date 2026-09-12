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
- the consent banner's own script and stylesheet, served from this origin

The important boundary is between serving the app and processing your payload.

## Telemetry

Two kinds, and they are treated differently because they behave differently.

### Vercel Analytics and Speed Insights

Always on. Both are cookieless: they store nothing on your device and set no
identifier, which is why they sit outside the consent banner. They record page
views and Core Web Vitals.

### Google Analytics

Runs only where `NEXT_PUBLIC_GA_MEASUREMENT_ID` is configured. Where it is not
— local development, or anyone running their own copy — there is no Google
Analytics, no cookie banner, and the Content-Security-Policy names no external
host at all.

Where it is configured, the site uses Google Consent Mode v2 and the deployment
is **default-denied**:

- `gtag.js` loads on every page, but the first thing queued for it sets
  `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization` and
  `personalization_storage` to `denied`. Ordering is the whole point, and it is
  asserted in `tests/e2e/consent.test.ts`: if the property were configured
  before the defaults were queued, gtag would replay a measured hit from
  someone who never agreed.
- Nothing is written to your device, and no analytics cookie is set, unless you
  accept in the banner.
- **Being honest about what default-denied still does:** with Consent Mode v2,
  a declined session still sends Google a `page_view`. Inspected on the wire, it
  carries the page URL and title, screen size, language, browser and platform,
  your IP as with any request, and a client id — *and* the signal `gcs=G100`,
  telling Google that both ad and analytics storage were refused. Google uses
  these for aggregate modelling.

  The client id is the part worth being precise about: because no cookie is
  written, a fresh one is generated on every page load, so it cannot link your
  visits to each other. It is not the persistent identifier an accepted session
  gets. But this is a real page view report, not a contentless ping.

  What it never contains is anything you put *into* a tool.

  If you want *no* contact with Google whatsoever, block
  `googletagmanager.com`; the site is fully functional without it, and every
  tool keeps working.
- You can change your mind at any time through **Cookie preferences** in the
  footer of every page.

The consent banner itself is [Silktide Consent
Manager](https://github.com/silktide/consent-manager) (MIT), vendored into
`public/consent/` and served from this origin. It is not loaded from a CDN,
because adding a cookie banner should not mean granting a third party script
execution on every page.

### The boundary that matters

Analytics sees page views: which tool pages are visited, and roughly from
where. It never sees what you put *into* a tool. Tool payloads — text, files,
keys, passwords, PDFs — are processed in your browser and are not sent
anywhere, whether or not you accept cookies. Accepting analytics does not
change what a tool does with your data.

If you add telemetry, keep that boundary intact: raw tool payloads must never
be logged as analytics data.

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

SuperTools keeps browser-stored state minimal. In practice that means:

- your theme preference
- your consent choice, under the `supertools_consent` key
- the browser's normal cache for fetched assets

and, only if you accept analytics, Google Analytics' own cookies. Tool input is
never stored — it lives in page memory and is gone when you close the tab.

That does not change the privacy model, but it is still worth being explicit about what the app stores locally.

## Practical Contributor Rules

- do not send payloads to remote APIs without an explicit product decision
- do not log secrets or raw content
- do not make privacy claims broader than the implementation
- when a tool has caveats, explain them in the UI and docs
