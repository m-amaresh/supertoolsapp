/**
 * Interpret qpdf worker results and validate PDF unlock requests. Unlocking
 * removes encryption from a file the user can already open; it does not recover
 * passwords.
 */

import {
  extractWarnings,
  formatBytes,
  isQpdfSuccess,
  looksLikePdf,
  MAX_PDF_BYTES,
  redactQpdfSecrets,
  stripProgramPrefix,
} from "./qpdf";

// Keep shared qpdf helpers available through the tool module.
export {
  extractWarnings,
  formatBytes,
  isQpdfSuccess,
  looksLikePdf,
  MAX_PDF_BYTES,
  redactQpdfSecrets,
  stripProgramPrefix,
};

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
  bytes: Uint8Array;
  /** User or owner password. Empty string means "try with no password". */
  password: string;
}

export interface PdfUnlockSuccess {
  ok: true;
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
  /** Sanitized qpdf output for the details panel. */
  detail: string;
}

export type PdfUnlockResult = PdfUnlockSuccess | PdfUnlockFailure;

/** Message posted to the worker. `bytes` is transferred, not copied. */
export interface PdfUnlockWorkerRequest {
  bytes: ArrayBuffer;
  password: string;
}

/** Raw worker report; `interpretWorkerResponse` classifies it on the main thread. */
export interface PdfUnlockWorkerResponse {
  stage: "startup" | "inspect" | "decrypt";
  exitCode: number;
  output: string;
  /** Output of the inspect pass, retained so the cipher can be reported. */
  inspectOutput: string;
  /** Present only after a successful decrypt stage. */
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
