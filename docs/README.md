# SuperTools Documentation

This folder is the human-readable guide to the project. It serves three audiences:

- **Evaluators** deciding whether to use or contribute to the project
- **Contributors** working safely in the codebase
- **Maintainers** who need a quick source of truth

## Start Here

Read these pages in order for a complete picture:

1. [Getting Started](getting-started.md) — local setup, commands, environment variables, what to expect
2. [Privacy and Data Handling](privacy.md) — what "privacy-first" means in practice, contributor rules
3. [Architecture](architecture.md) — project layers, tool page pattern, shared hooks, design decisions
4. [Technical Reference](technical-reference.md) — hooks API, utilities, SEO system, security baseline, testing strategy, tool authoring guidance
5. [Tool Catalog](tool-catalog.md) — full route inventory, product direction, quality bar

## What SuperTools Is

SuperTools is a browser-first suite of developer tools. The product focus is not "as many tools as possible." It is "tools people can trust with real work."

That means the project balances:

- speed — instant local processing, no round-trips
- privacy — payloads stay in the browser
- consistency — shared scaffold, toolbar, and interaction patterns across every tool
- honesty — clear failure states, explicit limits, no silent data loss
- accessibility — keyboard navigation, focus management, reduced-motion support

## What These Docs Try to Do

- Explain how the app is structured so contributors can work confidently
- Document the shared conventions behind tools so new pages stay consistent
- Make the privacy model explicit so nobody accidentally weakens it
- Keep maintainers from breaking subtle guarantees (focus handling, theme behavior, CSP, metadata behavior)

## Ground Rule

If you spot a mismatch between the docs and the code, fix the mismatch rather than working around it.
