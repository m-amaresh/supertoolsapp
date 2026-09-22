/** Interpret qpdf worker results and validate requests for the PDF merge tool. */

import {
  extractWarnings,
  formatBytes,
  isQpdfSuccess,
  looksLikePdf,
  MAX_PDF_BYTES,
  redactQpdfSecrets,
  stripProgramPrefix,
} from "./qpdf";

export { formatBytes, looksLikePdf, MAX_PDF_BYTES };

/** Merging one file is a no-op, so the action needs at least two. */
export const MIN_MERGE_FILES = 2;

/** Caps the argument list and the number of files held in memory. */
export const MAX_MERGE_FILES = 50;

/**
 * Transferred bytes and MEMFS copies coexist. A measured 200 MB merge used
 * roughly 410 MB of resident memory, so cap the combined input at 200 MB.
 * Each file is also capped by `MAX_PDF_BYTES`.
 */
export const MAX_TOTAL_MERGE_BYTES = 200 * 1024 * 1024;

/**
 * Apply merge size limits before previews load entire files. Skip an oversized
 * preview without blocking later files; `validateSelection` governs the merge.
 */
export function previewableFiles(sizes: number[]): boolean[] {
  let running = 0;
  return sizes.map((size) => {
    if (size <= 0 || size > MAX_PDF_BYTES) return false;
    if (running + size > MAX_TOTAL_MERGE_BYTES) return false;
    running += size;
    return true;
  });
}

export type PdfMergeErrorCode =
  | "too-few-files"
  | "too-many-files"
  | "empty-file"
  | "file-too-large"
  | "total-too-large"
  | "not-a-pdf"
  | "encrypted"
  | "damaged"
  | "worker-failed"
  | "unknown";

/** What the UI knows about a queued file before its bytes are read. */
export interface PdfMergeInput {
  name: string;
  size: number;
}

export interface PdfMergeSuccess {
  ok: true;
  bytes: Uint8Array;
  /** Pages in the result, or null when qpdf would not report it. */
  pageCount: number | null;
  /** Non-fatal qpdf warnings, e.g. a cross-reference table it had to repair. */
  warnings: string[];
  /**
   * Inputs that were encrypted, and whose restrictions `--decrypt` therefore
   * removed. Named so the UI can report the change rather than make it
   * silently.
   */
  decrypted: string[];
}

export interface PdfMergeFailure {
  ok: false;
  code: PdfMergeErrorCode;
  message: string;
  /** Sanitized qpdf output for the details panel. */
  detail: string;
  /**
   * The input that caused it, named as the reader named it. Null when the
   * failure is not about one particular file.
   */
  fileName: string | null;
}

export type PdfMergeResult = PdfMergeSuccess | PdfMergeFailure;

/** Message posted to the worker. Each buffer is transferred, not copied. */
export interface PdfMergeWorkerRequest {
  /** Input PDFs, in the order they should appear in the result. */
  buffers: ArrayBuffer[];
}

/** Raw worker report; `interpretMergeResponse` classifies it on the main thread. */
export interface PdfMergeWorkerResponse {
  stage: "startup" | "merge";
  exitCode: number;
  output: string;
  /** Pages in the merged file. Null when the count could not be read. */
  pageCount: number | null;
  /** Indexes of inputs that qpdf reported as encrypted. */
  encryptedIndexes: number[];
  /** Merged bytes — present only when the merge succeeded. */
  bytes: ArrayBuffer | null;
}

/** Where the worker writes the merged file inside the WASM filesystem. */
export const MERGE_OUTPUT_PATH = "out.pdf";

/**
 * Scratch path for the nth input inside the WASM filesystem.
 *
 * The reader's own filenames never reach argv. That removes any question of a
 * filename being read as a qpdf option or a page range — a file called
 * `--encrypt` or `1-5` is just `in3.pdf` to the engine — and it gives every
 * message qpdf prints a stable handle that `resolveScratchNames` can map back
 * to what the reader actually called the file.
 */
export function scratchName(index: number): string {
  return `in${index}.pdf`;
}

/**
 * Build the qpdf argv that concatenates `count` inputs into one document.
 *
 * The first input doubles as the primary input rather than using `--empty`, so
 * the merged document inherits its document-level metadata and outlines
 * instead of starting blank. Its pages come from the `--pages` list like every
 * other file's, so it is not duplicated.
 *
 * `--decrypt` is not optional. qpdf carries the *primary input's* encryption
 * into the output, so merging a file that opens freely but forbids printing
 * produced an AES-256 encrypted result that forbade printing — silently
 * applying one document's restrictions to everyone else's pages. The reader
 * could open every input, so the merged file must be openable too.
 *
 * Each file is passed as an explicit `--file=` token. qpdf 11 onward will not
 * accept a bare filename in a `--pages` list without a page range — the
 * shorthand that older documentation shows fails with "invalid range syntax".
 */
export function buildMergeArgs(count: number): string[] {
  const files = Array.from(
    { length: count },
    (_, i) => `--file=${scratchName(i)}`,
  );
  return [
    scratchName(0),
    "--decrypt",
    "--pages",
    ...files,
    "--",
    MERGE_OUTPUT_PATH,
  ];
}

/** Args that report what protection an input carries, without rewriting it. */
export function buildInspectArgs(index: number): string[] {
  return ["--show-encryption", scratchName(index)];
}

/**
 * True when `qpdf --show-encryption` reported actual protection.
 *
 * A file with an empty user password opens with no prompt, so it merges
 * without ever asking the reader for anything — but it can still forbid
 * printing or editing, and `--decrypt` drops that. This is what lets the UI
 * say so instead of changing the document silently.
 */
export function isEncrypted(inspectOutput: string): boolean {
  const text = inspectOutput.trim();
  if (!text) return false;
  return !/file is not encrypted/i.test(text);
}

/**
 * Substitute the reader's filenames back into qpdf output.
 *
 * Done with one pass and a lookup rather than a replacement per name, so
 * `in1.pdf` cannot eat the prefix of `in10.pdf`.
 */
export function resolveScratchNames(output: string, names: string[]): string {
  return output.replace(/\bin(\d+)\.pdf\b/g, (match, digits: string) => {
    const name = names[Number(digits)];
    return name ?? match;
  });
}

/**
 * Which input qpdf was complaining about, by its position in the list.
 *
 * Read from the *unresolved* output, where every input still carries its
 * scratch name — a reader's filename could be anything, including another
 * input's name, so matching those would be guesswork.
 */
export function findOffendingIndex(rawOutput: string): number | null {
  const lines = rawOutput.split("\n");
  const isWarning = (line: string) => /\bwarning:/i.test(line);

  // A file that merely warned is not the file that failed. Non-warning lines
  // are searched first, so a repaired cross-reference table in one input does
  // not take the blame for another input's hard error.
  for (const line of [
    ...lines.filter((l) => !isWarning(l)),
    ...lines.filter(isWarning),
  ]) {
    const match = line.match(/\bin(\d+)\.pdf\b/);
    if (match) return Number(match[1]);
  }
  return null;
}

/**
 * Classify qpdf's combined stdout/stderr into an actionable error.
 *
 * Ordering matters: a locked file also produces downstream structural
 * complaints, so encryption is checked before damage.
 */
export function classifyMergeError(
  rawOutput: string,
  exitCode: number,
  names: string[],
): PdfMergeFailure {
  const detail = resolveScratchNames(rawOutput, names).trim();
  const lower = rawOutput.toLowerCase();

  const index = findOffendingIndex(rawOutput);
  const fileName = index === null ? null : (names[index] ?? null);
  // Qualify the message with the filename only when one was identified —
  // "That PDF" is honest about not knowing which, where a guess would not be.
  const subject = fileName ? `“${fileName}”` : "One of these files";

  const fail = (code: PdfMergeErrorCode, message: string): PdfMergeFailure => ({
    ok: false,
    code,
    message,
    detail,
    fileName,
  });

  if (lower.includes("invalid password")) {
    return fail(
      "encrypted",
      `${subject} is password-protected, so its pages cannot be copied. Remove the password first, then add it again.`,
    );
  }

  if (
    lower.includes("can't find pdf header") ||
    lower.includes("not a pdf file")
  ) {
    return fail(
      "not-a-pdf",
      `${subject} is not a PDF. Remove it from the list and try again.`,
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
      `${subject} appears to be damaged and could not be read.`,
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

/**
 * Turn a raw worker report into the final result shown to the reader.
 *
 * `names` is the input list in merge order, used to translate qpdf's scratch
 * paths back into the reader's own filenames.
 */
export function interpretMergeResponse(
  response: PdfMergeWorkerResponse,
  names: string[],
): PdfMergeResult {
  const { stage, exitCode, bytes, pageCount } = response;
  // Scrub once, here, so no raw qpdf text can reach the UI unredacted.
  const output = redactQpdfSecrets(response.output);

  if (stage === "startup") {
    return {
      ok: false,
      code: "worker-failed",
      message: "The PDF engine failed to start. Reload the page and try again.",
      detail: output,
      fileName: null,
    };
  }

  if (!isQpdfSuccess(exitCode)) {
    return classifyMergeError(output, exitCode, names);
  }

  if (!bytes || bytes.byteLength === 0) {
    return {
      ok: false,
      code: "unknown",
      message: "The merge finished but produced no output.",
      detail: resolveScratchNames(output, names),
      fileName: null,
    };
  }

  return {
    ok: true,
    bytes: new Uint8Array(bytes),
    pageCount,
    warnings: extractWarnings(resolveScratchNames(output, names)),
    decrypted: (response.encryptedIndexes ?? [])
      .map((index) => names[index])
      .filter((name): name is string => Boolean(name)),
  };
}

/**
 * Validate the queued list before any file is read.
 *
 * Must be called before `file.arrayBuffer()`. Validating decoded bytes instead
 * means an oversized selection is fully allocated in page memory before being
 * refused — the freeze the limit exists to prevent.
 */
export function validateSelection(
  files: PdfMergeInput[],
): PdfMergeFailure | null {
  const fail = (
    code: PdfMergeErrorCode,
    message: string,
    fileName: string | null = null,
  ): PdfMergeFailure => ({ ok: false, code, message, detail: "", fileName });

  if (files.length < MIN_MERGE_FILES) {
    return fail(
      "too-few-files",
      `Add at least ${MIN_MERGE_FILES} PDFs to merge.`,
    );
  }

  if (files.length > MAX_MERGE_FILES) {
    return fail(
      "too-many-files",
      `That is ${files.length} files. The limit is ${MAX_MERGE_FILES} per merge.`,
    );
  }

  for (const file of files) {
    if (file.size === 0) {
      return fail("empty-file", `“${file.name}” is empty.`, file.name);
    }
    if (file.size > MAX_PDF_BYTES) {
      return fail(
        "file-too-large",
        `“${file.name}” is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_PDF_BYTES)} per file.`,
        file.name,
      );
    }
  }

  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_MERGE_BYTES) {
    return fail(
      "total-too-large",
      `These files total ${formatBytes(total)}. The limit is ${formatBytes(MAX_TOTAL_MERGE_BYTES)} so the browser tab stays responsive.`,
    );
  }

  return null;
}

/** Reject a file whose bytes turn out not to be a PDF, before qpdf sees it. */
export function validateBytes(
  bytes: Uint8Array,
  name: string,
): PdfMergeFailure | null {
  if (!looksLikePdf(bytes)) {
    return {
      ok: false,
      code: "not-a-pdf",
      message: `“${name}” is not a PDF. Remove it from the list and try again.`,
      detail: "",
      fileName: name,
    };
  }
  return null;
}

/**
 * Move the item at `from` to `to`, returning a new array.
 *
 * Out-of-range moves return the list unchanged, so the first row's "up" and
 * the last row's "down" are no-ops rather than errors.
 */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length) return items;
  if (to < 0 || to >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Build the download filename: `report.pdf` -> `report-merged.pdf`, matching
 * the `-unlocked` convention of the sibling PDF tool.
 */
export function mergedFileName(firstName: string | undefined): string {
  const trimmed = firstName?.trim() ?? "";
  if (!trimmed) return "merged.pdf";

  const withoutExtension = trimmed.replace(/\.pdf$/i, "");
  const base = withoutExtension.length > 0 ? withoutExtension : "merged";
  return `${base}-merged.pdf`;
}

/** "3 files · 12 pages · 1.20 MB" for the result row. */
export function describeMerge(
  fileCount: number,
  pageCount: number | null,
  byteSize: number,
): string {
  const parts = [`${fileCount} files`];
  if (pageCount !== null) {
    parts.push(`${pageCount} page${pageCount === 1 ? "" : "s"}`);
  }
  parts.push(formatBytes(byteSize));
  return parts.join(" · ");
}
