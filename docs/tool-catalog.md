# Tool Catalog

This is the current public tool inventory in the repo. It is useful both as a product snapshot and as a quick check when editing navigation, SEO coverage, or homepage ordering.

## Product Direction

SuperTools is trying to be a dependable toolkit for everyday developer tasks, not an endless warehouse of loosely maintained utilities.

The rough product goals are:

- fast local processing
- trustworthy defaults
- consistent UX across tools
- enough explanation for people to know what a tool is doing

## Current Tool Count

32 public tools

## Routes by Category

Categories match the sidebar and the `/tools/category/<slug>` hub pages. A route's folder is historical and does not always match its category — the Lorem Ipsum generator lives under `/tools/text/`, and the crypto tools under `/tools/encode/`. The source of truth is [`src/lib/tools.ts`](../src/lib/tools.ts).

### Generators (`/tools/category/generators`)

- `/tools/ids/uuid`
- `/tools/ids/password`
- `/tools/text/lorem`
- `/tools/ids/qrcode`

### Encode / Decode (`/tools/category/encode-decode`)

- `/tools/encode/base64`
- `/tools/encode/base32`
- `/tools/encode/base58`
- `/tools/encode/hex`
- `/tools/encode/url`
- `/tools/encode/url-parser`
- `/tools/encode/escape`
- `/tools/encode/jwt`

### Crypto (`/tools/category/crypto`)

- `/tools/encode/hash`
- `/tools/encode/crc32`
- `/tools/encode/aes`
- `/tools/encode/rsa`
- `/tools/encode/tls-cert`

### PDF (`/tools/category/pdf`)

- `/tools/pdf/unlock`
- `/tools/pdf/encrypt`
- `/tools/pdf/merge`
- `/tools/pdf/split`

### Data (`/tools/category/data`)

- `/tools/data/json`
- `/tools/data/yaml`
- `/tools/data/csv`
- `/tools/data/baseconv`
- `/tools/data/color`

### Text (`/tools/category/text`)

- `/tools/text/diff`
- `/tools/text/case`
- `/tools/text/regex`

### Network (`/tools/category/network`)

- `/tools/network/cidr`

### Time (`/tools/category/time`)

- `/tools/time/timestamp`
- `/tools/time/cron`

## What Counts as a Good Tool Here

A good SuperTools page should:

- solve a real recurring problem
- be usable without reading a long manual
- handle common mistakes well
- stay honest about limits
- fit the shared UI model unless a different design is clearly better

## Non-Goals

- user accounts
- cloud history or saved workspaces
- collaborative editing
- server-side payload transformation pipelines
- adding tools just to inflate the catalog
