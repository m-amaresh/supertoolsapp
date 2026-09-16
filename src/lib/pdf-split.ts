/**
 * Types and pure helpers for the PDF split tool.
 *
 * The split itself runs in a Web Worker (`public/pdf/qpdf-split-worker.js`)
 * driving the same WebAssembly build of qpdf as the other three PDF tools.
 * Everything in this file is framework- and DOM-independent so it can be unit
 * tested directly, and every decision about what qpdf's output *means* lives
 * here rather than in the untyped worker.
 *
 * Two modes, because they answer different questions:
 *
 * - **extract** pulls a page selection into one document. The selection is
 *   resolved to an explicit page list *here* (see `parsePageRange`) and that
 *   list is what reaches qpdf, so the count shown before the run is the count
 *   the run produces.
 * - **chunks** cuts the document into fixed-size pieces with
 *   `--split-pages=N`, which writes several files qpdf names itself.
 */

import {
  declaresEncryption,
  extractWarnings,
  formatBytes,
  isQpdfSuccess,
  looksLikePdf,
  MAX_PDF_BYTES,
  redactQpdfSecrets,
  stripProgramPrefix,
} from "./qpdf";

export {
  declaresEncryption,
  extractWarnings,
  formatBytes,
  isQpdfSuccess,
  looksLikePdf,
  MAX_PDF_BYTES,
  redactQpdfSecrets,
  stripProgramPrefix,
};

/** Scratch paths inside the worker's Emscripten filesystem. */
export const SPLIT_INPUT_PATH = "in.pdf";
export const SPLIT_OUTPUT_PATH = "out.pdf";

/**
 * Stem qpdf builds its chunk filenames from.
 *
 * Reader filenames never reach argv — the merge tool learned this the hard
 * way: a file called `--encrypt` or `1-5` would otherwise be read as an option
 * or a page range. qpdf writes `out-01-02.pdf`, and `chunkFileName` maps that
 * back onto the reader's own filename for display and download.
 */
export const SPLIT_OUTPUT_STEM = "out";

/**
 * Most chunks one run will produce.
 *
 * A 1,000-page document split one page at a time is 1,000 files, each its own
 * blob URL and list row. The cap is about the browser, not qpdf: that many
 * live object URLs is a memory leak waiting to happen and a list nobody can
 * use. Past it the tool asks for a larger chunk size instead of trying.
 */
export const MAX_SPLIT_OUTPUTS = 200;

/** Largest chunk size worth offering; beyond this, extract is the better tool. */
export const MAX_CHUNK_SIZE = 1000;

export type PdfSplitMode = "extract" | "chunks";

export type PdfSplitErrorCode =
  | "empty-file"
  | "too-large"
  | "not-a-pdf"
  | "encrypted"
  | "damaged"
  | "no-selection"
  | "bad-range"
  | "bad-chunk-size"
  | "too-many-outputs"
  | "unknown-page-count"
  | "worker-failed"
  | "unknown";

export interface PdfSplitFailure {
  ok: false;
  code: PdfSplitErrorCode;
  message: string;
  /** Raw qpdf output, useful for the details panel. */
  detail: string;
}

/** One produced document, named as the reader would expect to see it. */
export interface PdfSplitPiece {
  name: string;
  bytes: Uint8Array;
}

export interface PdfSplitSuccess {
  ok: true;
  pieces: PdfSplitPiece[];
  /** Non-fatal qpdf warnings, e.g. a cross-reference table it had to repair. */
  warnings: string[];
}

export type PdfSplitResult = PdfSplitSuccess | PdfSplitFailure;

/** Message posted to the worker. `bytes` is transferred, not copied. */
export interface PdfSplitWorkerRequest {
  bytes: ArrayBuffer;
  /** "count" only reports the page count; the others do the work. */
  mode: "count" | PdfSplitMode;
  /** Pre-built qpdf argv. Absent for "count". */
  args?: string[];
}

/** A file the worker found in MEMFS after the run. */
export interface PdfSplitWorkerFile {
  /** qpdf's own name, e.g. "out-01-02.pdf". */
  name: string;
  bytes: ArrayBuffer;
}

/**
 * Message posted back by the worker.
 *
 * As with the other PDF tools the worker is a thin runner: it reports which
 * qpdf pass it reached, that pass's exit code and the raw console output.
 * Interpretation happens on the main thread via `interpretWorkerResponse`.
 */
export interface PdfSplitWorkerResponse {
  stage: "startup" | "inspect" | "count" | "split";
  exitCode: number;
  output: string;
  /** Pages in the input. Null when the count could not be read. */
  pageCount: number | null;
  /** Produced files, in the order qpdf wrote them. Empty on failure. */
  files: PdfSplitWorkerFile[];
}

// ─── Page range parsing ──────────────────────────────────────────────────────

/**
 * Resolve a qpdf-style page range against a known page count.
 *
 * The grammar is qpdf's, verified against the bundled qpdf 12.2.0 rather than
 * taken from documentation:
 *
 * - `5` a single page, 1-based
 * - `2-6` an ascending run; `6-2` descends, and the order is kept
 * - `z` the last page, `r2` the second from last
 * - `x2-3` removes pages from what has been selected so far
 * - terms are comma separated and evaluated left to right
 *
 * Three behaviours matter and are deliberately reproduced: pages are **not**
 * de-duplicated (`1,1,2` really is three pages), order is **not** sorted
 * (`2-4,1` ends on page 1), and an exclusion may not come first, because it
 * would have nothing to subtract from.
 *
 * Resolving here rather than passing the raw spec through means the page count
 * the UI shows before the run is the page count the run produces.
 */
export function parsePageRange(
  spec: string,
  totalPages: number,
):
  | { ok: true; pages: number[] }
  | { ok: false; code: "no-selection" | "bad-range"; message: string } {
  const fail = (
    code: "no-selection" | "bad-range",
    message: string,
  ): { ok: false; code: "no-selection" | "bad-range"; message: string } => ({
    ok: false,
    code,
    message,
  });

  const trimmed = spec.trim();
  if (trimmed.length === 0) {
    return fail("no-selection", "Enter which pages you want, such as 1-5, 8.");
  }

  if (totalPages < 1) {
    return fail("bad-range", "That document has no pages to take.");
  }

  // Whitespace is allowed anywhere: people type "1-5, 8", not "1-5,8".
  const terms = trimmed.replace(/\s+/g, "").split(",");
  let selected: number[] = [];

  for (const [index, term] of terms.entries()) {
    if (term.length === 0) {
      return fail(
        "bad-range",
        "There is an empty entry in that range — check for a stray comma.",
      );
    }

    const isExclusion = term.startsWith("x");
    if (isExclusion && index === 0) {
      return fail(
        "bad-range",
        "A range cannot start with an exclusion. Say what to include first, as in 1-z,x3.",
      );
    }

    const body = isExclusion ? term.slice(1) : term;
    const resolved = resolveTerm(body, totalPages);
    if (!resolved.ok) return fail("bad-range", resolved.message);

    if (isExclusion) {
      const drop = new Set(resolved.pages);
      selected = selected.filter((page) => !drop.has(page));
    } else {
      selected = selected.concat(resolved.pages);
    }
  }

  if (selected.length === 0) {
    return fail(
      "no-selection",
      "That range selects no pages. The exclusions remove everything it includes.",
    );
  }

  return { ok: true, pages: selected };
}

/** Expand one comma-free term into the pages it names. */
function resolveTerm(
  term: string,
  totalPages: number,
): { ok: true; pages: number[] } | { ok: false; message: string } {
  if (term.length === 0) {
    return { ok: false, message: "There is an empty entry in that range." };
  }

  // Split on the hyphen that separates a run's ends. `r2-z` has one; a bare
  // `5` or `z` has none.
  const parts = term.split("-");
  if (parts.length > 2) {
    return {
      ok: false,
      message: `"${term}" is not a page range. Use a single page, or two joined by a hyphen, as in 2-6.`,
    };
  }

  const from = resolvePage(parts[0], totalPages);
  if (!from.ok) return from;
  if (parts.length === 1) return { ok: true, pages: [from.page] };

  const to = resolvePage(parts[1], totalPages);
  if (!to.ok) return to;

  const pages: number[] = [];
  const step = from.page <= to.page ? 1 : -1;
  for (let page = from.page; ; page += step) {
    pages.push(page);
    if (page === to.page) break;
  }
  return { ok: true, pages };
}

/** Resolve one endpoint: a number, `z`, or `rN`. */
function resolvePage(
  token: string,
  totalPages: number,
): { ok: true; page: number } | { ok: false; message: string } {
  const bad = (message: string) => ({ ok: false as const, message });

  if (token === "z") return { ok: true, page: totalPages };

  if (token.startsWith("r")) {
    const fromEnd = token.slice(1);
    if (!/^\d+$/.test(fromEnd)) {
      return bad(
        `"${token}" is not a page. Use r1 for the last page, r2 for the one before it.`,
      );
    }
    const offset = Number(fromEnd);
    // r0 would name the page *after* the last one, which qpdf rejects with
    // "number N out of range" — so accepting it here enabled an action that
    // could only fail. Counting from the end starts at r1, and with the
    // offset at least 1 the resulting page can never exceed totalPages.
    if (offset < 1) {
      return bad(
        `"${token}" is not a page. Counting back from the end starts at r1, which is the last page.`,
      );
    }
    const page = totalPages - offset + 1;
    if (page < 1) {
      return bad(
        `"${token}" counts back past the start — this document has only ${totalPages} ${totalPages === 1 ? "page" : "pages"}.`,
      );
    }
    return { ok: true, page };
  }

  if (!/^\d+$/.test(token)) {
    return bad(
      `"${token}" is not a page number. Use digits, z for the last page, or rN to count from the end.`,
    );
  }

  const page = Number(token);
  if (page < 1) {
    return bad("Pages are numbered from 1, so 0 is not a page.");
  }
  if (page > totalPages) {
    return bad(
      `This document has ${totalPages} ${totalPages === 1 ? "page" : "pages"}, so page ${page} does not exist.`,
    );
  }
  return { ok: true, page };
}

/** How many files `--split-pages=size` will produce for a document this long. */
export function chunkCount(totalPages: number, chunkSize: number): number {
  if (totalPages < 1 || chunkSize < 1) return 0;
  return Math.ceil(totalPages / chunkSize);
}

/** Validate a chunk size before it reaches the engine. */
export function validateChunkSize(
  chunkSize: number,
  totalPages: number,
): PdfSplitFailure | null {
  const fail = (code: PdfSplitErrorCode, message: string): PdfSplitFailure => ({
    ok: false,
    code,
    message,
    detail: "",
  });

  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    return fail(
      "bad-chunk-size",
      "Pages per file must be a whole number, 1 or more.",
    );
  }

  if (chunkSize > MAX_CHUNK_SIZE) {
    return fail(
      "bad-chunk-size",
      `Pages per file tops out at ${MAX_CHUNK_SIZE}.`,
    );
  }

  const count = chunkCount(totalPages, chunkSize);
  if (count > MAX_SPLIT_OUTPUTS) {
    const needed = Math.ceil(totalPages / MAX_SPLIT_OUTPUTS);
    return fail(
      "too-many-outputs",
      `That would produce ${count} files, and the limit is ${MAX_SPLIT_OUTPUTS}. Use at least ${needed} pages per file.`,
    );
  }

  return null;
}

// ─── Argument construction ───────────────────────────────────────────────────

/**
 * argv for pulling an explicit page list into one document.
 *
 * The list is passed as resolved numbers rather than the reader's spec, so the
 * selection qpdf acts on is exactly the one `parsePageRange` reported.
 * `--decrypt` is not needed: an encrypted input is refused before this point,
 * since silently dropping a document's protection while splitting it is the
 * defect the merge tool had to fix.
 */
export function buildExtractArgs(
  pages: number[],
  inputPath: string,
  outputPath: string,
): string[] {
  return [inputPath, "--pages", ".", pages.join(","), "--", outputPath];
}

/** argv for cutting the document into fixed-size pieces. */
export function buildChunkArgs(
  chunkSize: number,
  inputPath: string,
  outputPath: string,
): string[] {
  return [`--split-pages=${chunkSize}`, inputPath, outputPath];
}

/** argv for the page-count pass. */
export function buildCountArgs(inputPath: string): string[] {
  return ["--show-npages", inputPath];
}

// ─── Output naming ───────────────────────────────────────────────────────────

/** Strip a trailing `.pdf`, leaving something safe to build a name from. */
export function fileStem(originalName: string): string {
  const trimmed = originalName.trim();
  if (!trimmed) return "document";
  const withoutExtension = trimmed.replace(/\.pdf$/i, "");
  return withoutExtension.length > 0 ? withoutExtension : "document";
}

/**
 * Name for an extracted selection: `report.pdf` + `1-5` -> `report-pages-1-5.pdf`.
 *
 * The spec goes in the name so that extracting two different ranges from one
 * document does not produce two files called the same thing in the downloads
 * folder. Anything long or awkward falls back to a plain suffix rather than
 * producing an unwieldy filename.
 */
export function extractedFileName(originalName: string, spec: string): string {
  const stem = fileStem(originalName);
  const compact = spec.replace(/\s+/g, "");
  const safe = compact.replace(/[^0-9a-z-]+/gi, "_");

  if (safe.length === 0 || safe.length > 20 || compact !== spec.trim()) {
    return `${stem}-pages.pdf`;
  }
  return `${stem}-pages-${safe}.pdf`;
}

/**
 * Map a name qpdf produced onto the reader's own filename.
 *
 * qpdf builds chunk names from the output stem it was given, so `out.pdf`
 * yields `out-01-02.pdf`. Only the stem is replaced; the page-range suffix is
 * qpdf's and is exactly what makes the pieces identifiable.
 */
export function chunkFileName(
  qpdfName: string,
  originalName: string,
): string | null {
  const match = new RegExp(`^${SPLIT_OUTPUT_STEM}(-[\\d-]+)\\.pdf$`, "i").exec(
    qpdfName,
  );
  if (!match) return null;
  return `${fileStem(originalName)}${match[1]}.pdf`;
}

/** Name for the archive holding every piece. */
export function archiveFileName(originalName: string): string {
  return `${fileStem(originalName)}-split.zip`;
}

// ─── Result interpretation ───────────────────────────────────────────────────

/**
 * Classify qpdf's combined stdout/stderr into an actionable error.
 *
 * Ordering matters: an encrypted input reports a password problem first and a
 * structural one after, so the password case is checked before the damage
 * cases.
 */
export function classifyQpdfError(
  output: string,
  exitCode: number,
): PdfSplitFailure {
  const detail = output.trim();
  const lower = detail.toLowerCase();

  const fail = (code: PdfSplitErrorCode, message: string): PdfSplitFailure => ({
    ok: false,
    code,
    message,
    detail,
  });

  if (lower.includes("invalid password")) {
    return fail(
      "encrypted",
      "This PDF is password-protected. Remove the password first with the PDF Password Remover, then split it here.",
    );
  }

  if (lower.includes("out of range")) {
    return fail(
      "bad-range",
      "That page selection reaches past the end of the document.",
    );
  }

  if (
    lower.includes("can't find pdf header") ||
    lower.includes("not a pdf file")
  ) {
    return fail(
      "not-a-pdf",
      "This file is not a PDF. Check that you selected the right file.",
    );
  }

  if (
    lower.includes("can't find startxref") ||
    lower.includes("unable to find") ||
    lower.includes("damaged") ||
    lower.includes("file is damaged")
  ) {
    return fail(
      "damaged",
      "This PDF appears to be damaged and could not be read.",
    );
  }

  const firstLine = detail.split("\n").find((line) => line.trim().length > 0);
  return fail(
    "unknown",
    firstLine
      ? stripProgramPrefix(firstLine)
      : `qpdf exited with code ${exitCode}.`,
  );
}

/** qpdf prints this for a file carrying no protection — the input this tool wants. */
export function isNotEncrypted(output: string): boolean {
  return /file is not encrypted/i.test(output);
}

/** Read the page count out of a `--show-npages` run. */
export function parsePageCount(output: string): number | null {
  const trimmed = output.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Sort chunk names the way a reader expects.
 *
 * qpdf zero-pads to the width of the page count, so plain string order is
 * usually right — but `out-9.pdf` and `out-10.pdf` appear unpadded when the
 * document has fewer than ten pages, and then string order puts 10 before 9.
 * Comparing the leading number avoids depending on the padding at all.
 */
export function compareChunkNames(a: string, b: string): number {
  const first = (name: string) => {
    const match = /-(\d+)/.exec(name);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  };
  const diff = first(a) - first(b);
  return diff !== 0 ? diff : a.localeCompare(b);
}

/**
 * Turn a raw worker report into the final result shown to the user.
 *
 * `originalName` is the reader's filename, used to name the pieces; `spec`
 * names an extracted selection and is ignored for chunk runs.
 */
export function interpretWorkerResponse(
  response: PdfSplitWorkerResponse,
  originalName: string,
  mode: PdfSplitMode,
  spec: string,
): PdfSplitResult {
  const { stage, exitCode, files } = response;
  // Scrub once, here, so no raw qpdf text can reach the UI unredacted.
  const output = redactQpdfSecrets(response.output);

  if (stage === "startup") {
    return {
      ok: false,
      code: "worker-failed",
      message: "The PDF engine failed to start. Reload the page and try again.",
      detail: output,
    };
  }

  if (stage === "inspect") {
    if (!isQpdfSuccess(exitCode)) return classifyQpdfError(output, exitCode);
    // The inspect pass succeeded and found protection. Splitting would quietly
    // strip it from every piece, so stop instead.
    return {
      ok: false,
      code: "encrypted",
      message:
        "This PDF is password-protected. Splitting it would drop that protection from every piece, so remove the password first with the PDF Password Remover.",
      detail: output,
    };
  }

  if (stage === "count") {
    if (!isQpdfSuccess(exitCode)) return classifyQpdfError(output, exitCode);
    return {
      ok: false,
      code: "unknown-page-count",
      message: "The number of pages in that PDF could not be read.",
      detail: output,
    };
  }

  if (!isQpdfSuccess(exitCode)) {
    return classifyQpdfError(output, exitCode);
  }

  if (files.length === 0) {
    return {
      ok: false,
      code: "unknown",
      message: "The split finished but produced no files.",
      detail: output,
    };
  }

  const pieces: PdfSplitPiece[] =
    mode === "extract"
      ? [
          {
            name: extractedFileName(originalName, spec),
            bytes: new Uint8Array(files[0].bytes),
          },
        ]
      : [...files]
          .sort((a, b) => compareChunkNames(a.name, b.name))
          .map((file) => ({
            // A name qpdf produced that does not match the expected shape is
            // kept rather than dropped: losing a page silently is worse than
            // an oddly named download.
            name: chunkFileName(file.name, originalName) ?? file.name,
            bytes: new Uint8Array(file.bytes),
          }));

  return { ok: true, pieces, warnings: extractWarnings(output) };
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Checks everything knowable *without* reading the file.
 *
 * Must be called before `file.arrayBuffer()`. Validating the decoded bytes
 * instead means an oversized file is fully allocated in page memory before
 * being refused — the freeze the limit exists to prevent.
 */
export function validateRequestMetadata(
  fileSize: number,
): PdfSplitFailure | null {
  const fail = (code: PdfSplitErrorCode, message: string): PdfSplitFailure => ({
    ok: false,
    code,
    message,
    detail: "",
  });

  if (fileSize === 0) return fail("empty-file", "That file is empty.");

  if (fileSize > MAX_PDF_BYTES) {
    return fail(
      "too-large",
      `That file is ${formatBytes(fileSize)}. The limit is ${formatBytes(MAX_PDF_BYTES)} so the browser tab stays responsive.`,
    );
  }

  return null;
}

/** Full validation, once the bytes are in hand. */
export function validateRequest(bytes: Uint8Array): PdfSplitFailure | null {
  const fail = (code: PdfSplitErrorCode, message: string): PdfSplitFailure => ({
    ok: false,
    code,
    message,
    detail: "",
  });

  if (bytes.length === 0) return fail("empty-file", "That file is empty.");

  if (bytes.length > MAX_PDF_BYTES) {
    return fail(
      "too-large",
      `That file is ${formatBytes(bytes.length)}. The limit is ${formatBytes(MAX_PDF_BYTES)} so the browser tab stays responsive.`,
    );
  }

  if (!looksLikePdf(bytes)) {
    return fail(
      "not-a-pdf",
      "This file is not a PDF. Check that you selected the right file.",
    );
  }

  return null;
}

/**
 * The pages a selection resolved to, listed plainly.
 *
 * The range grammar is the confusing part of this tool — `x`, `z` and reversed
 * runs all do something that is hard to picture from the spec alone. Naming
 * the pages removes the guesswork for a selection small enough to read, which
 * is the size where a mistake is both likely and easy to miss.
 *
 * Returns null past `limit`, where a list is noise and the count says enough.
 */
export function summarizePages(pages: number[], limit = 10): string | null {
  if (pages.length === 0 || pages.length > limit) return null;
  return pages.join(", ");
}

/**
 * Short sentence describing what a finished run produced.
 *
 * Takes a count rather than the pieces: the page holds each piece as a Blob
 * for the archive, not as the bytes this module hands back, and only the
 * number is needed either way.
 */
export function describeResult(count: number): string {
  if (count === 1) return "1 PDF ready to download.";
  return `${count} PDFs ready to download.`;
}
