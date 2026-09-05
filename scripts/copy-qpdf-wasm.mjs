// Copies the qpdf engine out of node_modules and into `public/pdf/`, next to
// the hand-written `qpdf-worker.js` that drives it.
//
// Serving these as static assets rather than bundling them is deliberate:
//   - A dedicated worker inherits its CSP from the response headers of its own
//     script URL. Pinning the worker to `/pdf/` lets the 'wasm-unsafe-eval'
//     relaxation it needs be scoped to that one path (see next.config.ts).
//   - The Emscripten glue has an unreachable Node.js branch referencing `fs`
//     and `path`, which the browser bundler would otherwise have to stub.
//   - Both files are same-origin, so `connect-src 'self'` stays intact and the
//     tool works with no network access at all.
//
// Run explicitly from `dev` and `build` rather than as a `prebuild` hook,
// because pnpm does not execute pre/post scripts by default.

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const gluePath = require.resolve("@neslinesli93/qpdf-wasm");
const sources = {
  "qpdf.js": gluePath,
  "qpdf.wasm": gluePath.replace(/qpdf\.js$/, "qpdf.wasm"),
};

const destinationDir = join(projectRoot, "public", "pdf");
mkdirSync(destinationDir, { recursive: true });

for (const [name, source] of Object.entries(sources)) {
  try {
    statSync(source);
  } catch {
    console.error(
      `[qpdf-wasm] Could not find ${source}. Run "pnpm install" and try again.`,
    );
    process.exit(1);
  }

  const destination = join(destinationDir, name);
  copyFileSync(source, destination);
  const { size } = statSync(destination);
  console.log(
    `[qpdf-wasm] Copied ${name} to public/pdf/ (${(size / 1024).toFixed(0)} KB)`,
  );
}
