// pdf.js loads its worker by URL. Serve it from /pdfjs/ so it stays same-origin
// without inheriting the relaxed /pdf/ CSP used by qpdf. dev and build invoke
// this script explicitly because pnpm does not run pre/post scripts by default.

import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// Resolve through the package so layout changes fail during the copy step.
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
