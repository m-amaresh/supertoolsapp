// Copies the pdf.js worker out of node_modules and into `public/pdfjs/`.
//
// The split tool renders page thumbnails with pdf.js, which does its parsing
// and rasterising in a worker of its own. That worker has to be served from
// this origin — `script-src 'self'` allows nothing else — and pdf.js loads it
// by URL rather than through the bundler, so it has to exist as a static file.
//
// `public/pdfjs/` rather than `public/pdf/` on purpose. The `/pdf/` directory
// carries a relaxed Content-Security-Policy so the qpdf engine can instantiate
// WebAssembly; pdf.js 6 needs no WebAssembly for ordinary rendering and no
// `eval` at all, so it has no business inheriting that relaxation. Kept one
// directory over, it is served under the strict policy like everything else.
// The header rule in next.config.ts excludes `pdf/` specifically, and
// `pdfjs/` does not match it.
//
// Run explicitly from `dev` and `build` alongside copy-qpdf-wasm.mjs, because
// pnpm does not execute pre/post scripts by default.

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// Resolved through the package rather than by path, so a layout change in
// pdfjs-dist fails here with a clear message instead of silently shipping
// nothing and breaking the preview at runtime.
const packageJsonPath = require.resolve("pdfjs-dist/package.json");
const source = join(dirname(packageJsonPath), "build", "pdf.worker.min.mjs");

const destinationDir = join(projectRoot, "public", "pdfjs");
mkdirSync(destinationDir, { recursive: true });

try {
  statSync(source);
} catch {
  console.error(
    `[pdfjs] Could not find ${source}. Run "pnpm install" and try again.`,
  );
  process.exit(1);
}

const destination = join(destinationDir, "pdf.worker.min.mjs");
copyFileSync(source, destination);
const { size } = statSync(destination);
console.log(
  `[pdfjs] Copied pdf.worker.min.mjs to public/pdfjs/ (${(size / 1024).toFixed(0)} KB)`,
);
