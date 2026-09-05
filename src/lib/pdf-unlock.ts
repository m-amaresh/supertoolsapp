/**
 * Types and pure helpers for the PDF unlock tool.
 *
 * The actual decryption runs in a Web Worker (`qpdf.worker.ts`) driving a
 * WebAssembly build of qpdf. Everything in this file is framework- and
 * DOM-independent so it can be unit tested directly.
 *
 * "Unlocking" here means removing the encryption from a PDF you can already
 * open — you supply the password, qpdf decrypts every string and stream and
 * writes a plain PDF. It is not a password recovery or cracking tool.
 */

/** Largest PDF we accept. qpdf holds the file in WASM memory twice (in + out). */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

/** Passwords longer than this are rejected before reaching the worker. */
export const MAX_PASSWORD_LENGTH = 2048;

export type PdfUnlockErrorCode =
  | "invalid-password"
  | "not-a-pdf"
  | "not-encrypted"
  | "damaged"
  | "unsupported-encryption"
  | "too-large"
  | "empty-file"
  | "worker-failed"
  | "unknown";

export interface PdfUnlockRequest {
  /** Raw bytes of the encrypted PDF. */
  bytes: Uint8Array;
  /** User or owner password. Empty string means "try with no password". */
  password: string;
}

export interface PdfUnlockSuccess {
  ok: true;
  /** Decrypted PDF bytes, with no /Encrypt dictionary. */
  bytes: Uint8Array;
  /** Non-fatal qpdf warnings, if any (e.g. a repaired cross-reference table). */
  warnings: string[];
  /** What was removed, for display. Null when qpdf reported nothing usable. */
  encryption: PdfEncryptionInfo | null;
}

export interface PdfUnlockFailure {
  ok: false;
  code: PdfUnlockErrorCode;
  message: string;
  /** Raw qpdf output, useful for the details panel. */
  detail: string;
}

export type PdfUnlockResult = PdfUnlockSuccess | PdfUnlockFailure;

/** Message posted to the worker. `bytes` is transferred, not copied. */
export interface PdfUnlockWorkerRequest {
  bytes: ArrayBuffer;
  password: string;
}

/**
 * Message posted back by the worker.
 *
 * The worker is a thin runner: it reports which qpdf pass it reached, that
 * pass's exit code, and the raw console output. All interpretation happens
 * here on the main thread via `interpretWorkerResponse`, which keeps the
 * decision-making in this tested module rather than in the untyped worker.
 */
export interface PdfUnlockWorkerResponse {
  /** Which stage the worker reached before reporting back. */
  stage: "startup" | "inspect" | "decrypt";
  /** Exit code of the qpdf invocation for that stage. */
  exitCode: number;
  /** Combined stdout/stderr captured from qpdf. */
  output: string;
  /** Output of the inspect pass, retained so the cipher can be reported. */
  inspectOutput: string;
  /** Decrypted bytes — present only when `stage` is "decrypt" and it succeeded. */
  bytes: ArrayBuffer | null;
}

/** What qpdf reported about the encryption it removed. */
export interface PdfEncryptionInfo {
  /** Standard security handler revision, e.g. 6. */
  revision: number | null;
  /** Cipher label, e.g. "AESv3". */
  method: string | null;
  /** Whether the supplied password was the user or the owner password. */
  suppliedPassword: "user" | "owner" | null;
}

/**
 * Parse the output of `qpdf --show-encryption` into a summary for the UI.
 * Every field is best-effort: qpdf's output format varies by revision, and a
 * missing field should never fail an otherwise successful unlock.
 */
export function parseEncryptionInfo(output: string): PdfEncryptionInfo | null {
  if (!output.trim() || /file is not encrypted/i.test(output)) return null;

  const revisionMatch = output.match(/^\s*R\s*=\s*(\d+)\s*$/m);
  const methodMatch = output.match(/file encryption method:\s*(\S+)/i);
  const suppliedOwner = /supplied password is owner password/i.test(output);
  const suppliedUser = /supplied password is user password/i.test(output);

  return {
    revision: revisionMatch ? Number(revisionMatch[1]) : null,
    method: methodMatch ? methodMatch[1] : null,
    suppliedPassword: suppliedOwner ? "owner" : suppliedUser ? "user" : null,
  };
}

/** Turn the parsed encryption info into a short phrase like "AES-256 (revision 6)". */
export function describeEncryption(info: PdfEncryptionInfo | null): string {
  if (!info) return "Encrypted";

  const cipherLabels: Record<string, string> = {
    AESv3: "AES-256",
    AESv2: "AES-128",
    RC4: "RC4",
    none: "no cipher",
  };

  const cipher = info.method
    ? (cipherLabels[info.method] ?? info.method)
    : "Encrypted";
  return info.revision !== null
    ? `${cipher} (revision ${info.revision})`
    : cipher;
}

const PDF_HEADER = "%PDF-";

/**
 * qpdf exits 0 on success and 3 when the operation succeeded but printed
 * warnings — a cross-reference table it had to repair, say. Both leave usable
 * output, so only anything else is a real failure. `public/pdf/qpdf-worker.js`
 * mirrors this to decide whether to continue past the inspect pass.
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
 * Classify qpdf's combined stdout/stderr into an actionable error.
 * Ordering matters: password failures are checked first because a wrong
 * password also tends to produce downstream structural complaints.
 */
export function classifyQpdfError(
  output: string,
  exitCode: number,
): PdfUnlockFailure {
  const detail = output.trim();
  const lower = detail.toLowerCase();

  const fail = (
    code: PdfUnlockErrorCode,
    message: string,
  ): PdfUnlockFailure => ({ ok: false, code, message, detail });

  if (lower.includes("invalid password")) {
    return fail(
      "invalid-password",
      "Incorrect password. Check for typos, and note that PDF passwords are case-sensitive.",
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
    lower.includes("unsupported encryption") ||
    lower.includes("unsupported security handler") ||
    lower.includes("unknown security handler")
  ) {
    return fail(
      "unsupported-encryption",
      "This PDF uses a security handler that cannot be removed with a password — typically enterprise DRM such as Adobe LiveCycle or FileOpen.",
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

/**
 * qpdf reports an unencrypted file on a successful (exit 0) run, so this is a
 * distinct case from the failures handled by `classifyQpdfError`.
 */
export function isNotEncrypted(output: string): boolean {
  return /file is not encrypted/i.test(output);
}

/**
 * qpdf names the file it is complaining about, which is the worker's scratch
 * path rather than anything the reader chose. Strip it.
 */
const WORKER_FILE_PREFIX = /^(?:in|out)\.pdf:\s*/i;

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

  // Both passes read the same file, so a structural problem is reported twice.
  return [...new Set(warnings)];
}

/**
 * Turn a raw worker report into the final result shown to the user.
 *
 * qpdf is run in two passes. The first (`--show-encryption`) authenticates and
 * reveals what protection is present; the second (`--decrypt`) writes the
 * cleaned file. Splitting them is what lets a wrong password be reported as a
 * wrong password rather than as a generic failure.
 */
export function interpretWorkerResponse(
  response: PdfUnlockWorkerResponse,
): PdfUnlockResult {
  const { stage, exitCode, bytes } = response;
  // Scrub once, here, so no raw qpdf text can reach the UI unredacted.
  const output = redactQpdfSecrets(response.output);
  const inspectOutput = redactQpdfSecrets(response.inspectOutput);

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

    // The inspect pass succeeded, so this message means there was no
    // protection to remove in the first place.
    if (isNotEncrypted(output)) {
      return {
        ok: false,
        code: "not-encrypted",
        message:
          "This PDF has no password on it — there is nothing to remove. You can open it as-is.",
        detail: output,
      };
    }

    // The worker should have continued to the decrypt pass.
    return {
      ok: false,
      code: "worker-failed",
      message: "The PDF engine stopped unexpectedly.",
      detail: output,
    };
  }

  if (!isQpdfSuccess(exitCode)) {
    return classifyQpdfError(output, exitCode);
  }

  if (!bytes || bytes.byteLength === 0) {
    return {
      ok: false,
      code: "unknown",
      message: "Decryption finished but produced no output.",
      detail: output,
    };
  }

  return {
    ok: true,
    bytes: new Uint8Array(bytes),
    // Warnings can come from either pass; extractWarnings de-duplicates.
    warnings: extractWarnings(`${inspectOutput}\n${output}`),
    encryption: parseEncryptionInfo(inspectOutput),
  };
}

/** Build the download filename for an unlocked file: `report.pdf` -> `report-unlocked.pdf`. */
export function unlockedFileName(originalName: string): string {
  const trimmed = originalName.trim();
  if (!trimmed) return "unlocked.pdf";

  const withoutExtension = trimmed.replace(/\.pdf$/i, "");
  const base = withoutExtension.length > 0 ? withoutExtension : "unlocked";
  return `${base}-unlocked.pdf`;
}

/** Human-readable byte size for the UI. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Validate a request before spinning up the worker, so obvious problems
 * surface instantly instead of after a 1.3 MB WASM download.
 */
/**
 * Checks everything knowable *without* reading the file.
 *
 * Must be called before `file.arrayBuffer()`. Validating the decoded bytes
 * instead means an oversized file is fully allocated in page memory before
 * being refused — the freeze the limit exists to prevent.
 */
export function validateRequestMetadata(
  fileSize: number,
  passwordLength: number,
): PdfUnlockFailure | null {
  const fail = (
    code: PdfUnlockErrorCode,
    message: string,
  ): PdfUnlockFailure => ({ ok: false, code, message, detail: "" });

  if (fileSize === 0) {
    return fail("empty-file", "That file is empty.");
  }

  if (fileSize > MAX_PDF_BYTES) {
    return fail(
      "too-large",
      `That file is ${formatBytes(fileSize)}. The limit is ${formatBytes(MAX_PDF_BYTES)} so the browser tab stays responsive.`,
    );
  }

  if (passwordLength > MAX_PASSWORD_LENGTH) {
    return fail("invalid-password", "That password is unreasonably long.");
  }

  return null;
}

export function validateRequest(
  bytes: Uint8Array,
  password: string,
): PdfUnlockFailure | null {
  const fail = (
    code: PdfUnlockErrorCode,
    message: string,
  ): PdfUnlockFailure => ({ ok: false, code, message, detail: "" });

  if (bytes.length === 0) {
    return fail("empty-file", "That file is empty.");
  }

  if (bytes.length > MAX_PDF_BYTES) {
    return fail(
      "too-large",
      `That file is ${formatBytes(bytes.length)}. The limit is ${formatBytes(MAX_PDF_BYTES)} so the browser tab stays responsive.`,
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return fail("invalid-password", "That password is unreasonably long.");
  }

  if (!looksLikePdf(bytes)) {
    return fail(
      "not-a-pdf",
      "This file is not a PDF. Check that you selected the right file.",
    );
  }

  return null;
}
