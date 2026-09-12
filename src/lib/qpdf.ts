/**
 * Primitives shared by every tool that drives the WebAssembly build of qpdf.
 *
 * Both PDF tools run the same engine in the same kind of thin worker, so they
 * read PDF headers, size limits, exit codes and console output identically.
 * Keeping that in one place is what stops the two tools drifting into two
 * conventions for the same qpdf behaviour — the tool-specific parts (what an
 * error *means* to the reader) stay in `pdf-unlock.ts` and `pdf-merge.ts`.
 *
 * Everything here is framework- and DOM-independent so it can be unit tested
 * directly.
 */

/**
 * Largest single PDF we accept.
 *
 * Emscripten's MEMFS keeps file contents on the **JS heap**, not in WASM linear
 * memory — measured, the WASM heap stays at 16 MB while the tab grows by the
 * size of the files. So the cost of a file is paid in ordinary tab memory, and
 * it is paid more than once: the transferred bytes and the MEMFS copy coexist
 * until the worker drops its reference.
 */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

const PDF_HEADER = "%PDF-";

/**
 * qpdf exits 0 on success and 3 when the operation succeeded but printed
 * warnings — a cross-reference table it had to repair, say. Both leave usable
 * output, so only anything else is a real failure. The workers in `public/pdf/`
 * mirror this to decide whether to continue past a pass.
 */
export function isQpdfSuccess(exitCode: number): boolean {
  return exitCode === 0 || exitCode === 3;
}

/**
 * `qpdf --show-encryption` prints the document's own user password when the
 * owner password is the one supplied. Nothing here needs it, and it would
 * otherwise sit in the details panel in plain text, so scrub it before any raw
 * output is kept for display.
 */
export function redactQpdfSecrets(output: string): string {
  return output.replace(
    /^([^\n]*?\b(?:user password|encryption key)\s*=\s*).*$/gim,
    "$1[hidden]",
  );
}

/**
 * qpdf prefixes messages with its argv[0], which under Emscripten is whatever
 * the host page happened to be called. Strip it so errors read cleanly.
 */
export function stripProgramPrefix(line: string): string {
  return line.replace(/^[^\s:]*:\s*/, "").trim();
}

/** True when the buffer starts with a PDF header, allowing leading junk bytes. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  // The spec requires %PDF- at byte 0, but real files often carry a preamble,
  // and qpdf itself scans the first 1024 bytes. Match that tolerance.
  const window = bytes.subarray(0, 1024);
  const text = String.fromCharCode(...window);
  return text.includes(PDF_HEADER);
}

/**
 * qpdf names the file it is complaining about, which is a worker scratch path
 * rather than anything the reader chose. `in.pdf` is the unlock worker's input;
 * `in0.pdf`, `in1.pdf`, … are the merge worker's. The merge tool substitutes
 * the reader's own filenames back in *before* calling this, so those survive
 * and only unresolved scratch names are stripped.
 */
const WORKER_FILE_PREFIX = /^(?:in\d*|out)\.pdf:\s*/i;

/** Pull non-fatal WARNING lines out of qpdf output. */
export function extractWarnings(output: string): string[] {
  const warnings = output
    .split("\n")
    // The label, not the bare word: qpdf ends a run that warned with the
    // summary line "operation succeeded with warnings", which is a status
    // report rather than a warning of its own.
    .filter((line) => /\bwarning:/i.test(line))
    .map((line) =>
      stripProgramPrefix(line)
        .replace(/^WARNING:\s*/i, "")
        .replace(WORKER_FILE_PREFIX, "")
        .trim(),
    )
    .filter((line) => line.length > 0);

  // Passes that read the same file report a structural problem more than once.
  return [...new Set(warnings)];
}

/** Human-readable byte size for the UI. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
