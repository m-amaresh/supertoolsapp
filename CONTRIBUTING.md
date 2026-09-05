# Contributing to SuperTools

SuperTools is intentionally opinionated. The product is small, but the standards are not: tools should feel trustworthy, predictable, and safe to use with sensitive data. This guide makes that bar clear before you open a pull request.

## Read These First

- [README.md](README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/technical-reference.md](docs/technical-reference.md)
- [docs/privacy.md](docs/privacy.md)

## Non-Negotiables

1. **Client-side processing.** Core tool transformations must run in the browser. Do not add server-side payload handling without an explicit product decision.
2. **Logic in `src/lib/`.** Transformation, parsing, encoding, and validation logic belongs in `src/lib/`, not directly in page components. This keeps the logic testable, portable, and framework-independent.
3. **Shared scaffold.** Reuse the existing tool scaffold and toolbar patterns. Do not invent one-off layouts unless the tool has a concrete reason to break the pattern.
4. **Defensive limits.** Add size guards and debounce for expensive operations. Tools should degrade honestly rather than freezing the tab.
5. **Accurate claims.** Do not make privacy, security, or cryptography claims the code does not support.
6. **No unsafe HTML.** Do not use `dangerouslySetInnerHTML` or raw HTML injection. Use inline styles or React elements for content outside the theme system (e.g., the global error page).

## Project Structure

| Directory | Contents |
|---|---|
| `src/app/tools/` | Tool route pages — state management and UI orchestration |
| `src/components/` | App shell, header, sidebar, shared tool scaffold |
| `src/components/ui/` | shadcn/ui primitives (button, input, select, checkbox, etc.) |
| `src/hooks/` | Shared client hooks (useToolState, useClipboard) |
| `src/lib/` | Pure logic — parsers, encoders, generators, validators, SEO helpers |

## Tool Design Expectations

Every tool should feel related to the others, even when the functionality differs:

- Clear title and description
- Obvious primary actions (encode/decode, format, generate, etc.)
- Consistent input/output layout using the shared scaffold
- Status messaging that surfaces errors, never hides them
- Explicit footnotes when a tool has important limits or security caveats
- Accessible focus handling (component-level `focus-visible:ring-*` styles, not global outlines)

## Privacy and Security

- Do not send user payloads to a backend service for transformation
- Do not log raw user input to analytics or console output in production
- Validate external input before doing expensive work
- Do not use `dangerouslySetInnerHTML` or equivalent raw HTML injection
- Respect the security headers and CSP model in `next.config.ts`
- The global error page (`global-error.tsx`) sits outside the theme provider — use inline styles only, with `matchMedia` for dark mode

## Theming

The app supports three theme modes: light, dark, and system. System mode tracks the OS preference and updates live. The theme provider uses `next-themes` with the `data-theme` attribute and `enableSystem`. Do not override or flatten the system preference in application code.

## Development Workflow

```bash
pnpm install
pnpm dev          # http://localhost:3100
```

### Required validation before a PR

```bash
pnpm lint
pnpm test:run
pnpm typecheck
pnpm build
```

All four must pass.

## Testing Guidance

- Add or update tests when changing parsing, crypto, encoding, validation, or transformation logic
- Prefer focused unit tests in `src/lib/` for pure logic
- If a bug was user-visible, add a regression test when practical
- Tests run against the logic directly, not the DOM — this keeps them fast and stable

## Documentation

If you change behavior that affects users or contributors, update the docs in the same pull request. The project has a maintained docs set in `docs/` — keep it accurate rather than letting it drift.

## Pull Requests

Keep descriptions concrete:

- What changed
- Why it changed
- Risks or tradeoffs
- How you validated it

If a change touches privacy, SEO, security, or cryptography, call that out explicitly.

## Security Issues

Do not open public issues for security vulnerabilities. Report them privately through the repository's security process.
