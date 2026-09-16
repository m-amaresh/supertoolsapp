/**
 * Types and pure helpers for the PDF password protection tool.
 *
 * The encryption itself runs in a Web Worker (`public/pdf/qpdf-encrypt-worker.js`)
 * driving a WebAssembly build of qpdf. Everything in this file is framework-
 * and DOM-independent so it can be unit tested directly.
 *
 * This is the inverse of `pdf-unlock.ts`: that tool takes a password off a
 * document, this one puts a password on. The two share `qpdf.ts` for
 * everything that is really "how qpdf behaves" rather than "what this tool
 * means", which is what stops them drifting into two conventions for the same
 * engine.
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

// Re-exported so this module stays the single import for the encrypt tool and
// its tests. The implementations are shared with the other PDF tools.
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

/**
 * How much of the password the PDF format actually hashes.
 *
 * These are limits of the file format, not of this tool. AES-256 (revision 6)
 * runs the first 127 **bytes** of the UTF-8 password through its hash and
 * ignores the rest. The older 128-bit handler (revision 4) is worse: it pads
 * or truncates to exactly 32 bytes, and encodes them as PDFDocEncoding, so
 * characters outside Latin-1 are mangled rather than merely dropped.
 *
 * A reader given the full password still opens the file — it truncates
 * identically — so this is not a correctness bug. It is a false sense of
 * strength, which is worth saying out loud when a passphrase exceeds it.
 */
export const AES256_PASSWORD_BYTES = 127;
export const AES128_PASSWORD_BYTES = 32;

/**
 * Cipher to protect the document with.
 *
 * 40-bit RC4 is deliberately not offered. qpdf can still write it, but it is
 * broken rather than merely dated, and a tool that presents it as a choice
 * invites someone to pick it.
 */
export type PdfEncryptionStrength = "aes256" | "aes128";

/** What the recipient may do with the document once they have opened it. */
export interface PdfEncryptPermissions {
  /** Print at full resolution. */
  print: boolean;
  /** Select and copy text, and extract images. */
  copy: boolean;
  /** Change page content, insert, rotate or delete pages. */
  modify: boolean;
  /** Add comments and fill in form fields without editing the document. */
  annotate: boolean;
}

export interface PdfEncryptOptions {
  /** Password required to open the document. Must not be empty. */
  userPassword: string;
  /**
   * Password that lifts the permission restrictions.
   *
   * Empty means "use the open password for both", which is what the tool does
   * unless the reader deliberately sets a different one. See
   * `effectiveOwnerPassword` for why an empty owner password is never sent to
   * qpdf as-is.
   */
  ownerPassword: string;
  strength: PdfEncryptionStrength;
  permissions: PdfEncryptPermissions;
}

/** Everything allowed — the default, since a password alone is the usual ask. */
export const DEFAULT_PERMISSIONS: PdfEncryptPermissions = {
  print: true,
  copy: true,
  modify: true,
  annotate: true,
};

export type PdfEncryptErrorCode =
  | "no-password"
  | "password-mismatch"
  | "password-too-long"
  | "not-a-pdf"
  | "already-encrypted"
  | "damaged"
  | "too-large"
  | "empty-file"
  | "worker-failed"
  | "unknown";

export interface PdfEncryptSuccess {
  ok: true;
  /** Encrypted PDF bytes, carrying an /Encrypt dictionary. */
  bytes: Uint8Array;
  /** Non-fatal qpdf warnings, if any (e.g. a repaired cross-reference table). */
  warnings: string[];
}

export interface PdfEncryptFailure {
  ok: false;
  code: PdfEncryptErrorCode;
  message: string;
  /** Raw qpdf output, useful for the details panel. */
  detail: string;
}

export type PdfEncryptResult = PdfEncryptSuccess | PdfEncryptFailure;

/** Message posted to the worker. `bytes` is transferred, not copied. */
export interface PdfEncryptWorkerRequest {
  bytes: ArrayBuffer;
  /** Pre-built qpdf argv, minus the input and output paths. */
  args: string[];
}

/**
 * Message posted back by the worker.
 *
 * As with the unlock tool, the worker is a thin runner: it reports which qpdf
 * pass it reached, that pass's exit code and the raw console output. All
 * interpretation happens here on the main thread via `interpretWorkerResponse`,
 * which keeps the decision-making in this tested module rather than in the
 * untyped worker.
 */
export interface PdfEncryptWorkerResponse {
  /** Which stage the worker reached before reporting back. */
  stage: "startup" | "inspect" | "encrypt";
  /** Exit code of the qpdf invocation for that stage. */
  exitCode: number;
  /** Combined stdout/stderr captured from qpdf. */
  output: string;
  /** Encrypted bytes — present only when `stage` is "encrypt" and it succeeded. */
  bytes: ArrayBuffer | null;
}

/**
 * The owner password actually sent to qpdf.
 *
 * Falling back to the open password is a security decision, not a convenience.
 * A PDF with a user password and an *empty* owner password can be opened with
 * no password at all by any reader that tries the owner password first — the
 * document looks protected and is not. qpdf refuses that combination outright
 * at 256-bit unless `--allow-insecure` is passed, and this tool never passes
 * it, because it never needs to: both passwords are always non-empty.
 */
export function effectiveOwnerPassword(options: PdfEncryptOptions): string {
  return options.ownerPassword.length > 0
    ? options.ownerPassword
    : options.userPassword;
}

/**
 * The `--modify` level for a permission set.
 *
 * The level alone cannot say "may edit the content but may not comment": it
 * runs all -> annotate -> none, and `all` grants annotation on the way past.
 * `buildEncryptArgs` therefore follows the level with an explicit
 * `--annotate=n` for that one combination — verified against qpdf 12.2.0,
 * which reports "modify annotations: not allowed, modify other: allowed".
 */
export function modifyOption(
  permissions: PdfEncryptPermissions,
): "all" | "annotate" | "none" {
  if (permissions.modify) return "all";
  return permissions.annotate ? "annotate" : "none";
}

/**
 * Build the qpdf argument list for an encryption run.
 *
 * This is the whole contract with the engine, which is why it is a pure
 * function with its own tests rather than string concatenation inside the
 * worker.
 */
export function buildEncryptArgs(
  options: PdfEncryptOptions,
  inputPath: string,
  outputPath: string,
): string[] {
  const { userPassword, strength, permissions } = options;
  const ownerPassword = effectiveOwnerPassword(options);

  const args = [
    "--encrypt",
    `--user-password=${userPassword}`,
    `--owner-password=${ownerPassword}`,
    `--bits=${strength === "aes256" ? "256" : "128"}`,
  ];

  // qpdf's `--use-aes` defaults to "n" for compatibility, so `--bits=128`
  // on its own produces RC4-128, not AES-128. Passing it explicitly is what
  // makes the "AES-128" label true. The flag is 128-bit only — at 256 bits
  // AES is the only cipher the format defines, and qpdf rejects the option.
  if (strength === "aes128") {
    args.push("--use-aes=y");
  }

  args.push(
    `--print=${permissions.print ? "full" : "none"}`,
    `--modify=${modifyOption(permissions)}`,
    `--extract=${permissions.copy ? "y" : "n"}`,
  );

  // The one combination the level cannot express. Without these the UI would
  // list commenting as restricted while the file happily allowed it.
  //
  // Both flags, because the permission covers both: `annotate` is described to
  // the reader as "add comments and fill in form fields", and qpdf tracks those
  // as separate bits — `--annotate=n` alone still leaves "modify forms:
  // allowed". Verified against qpdf 12.2.0, which reports annotations and
  // forms denied while "modify other" stays allowed, so editing is unaffected.
  if (permissions.modify && !permissions.annotate) {
    args.push("--annotate=n", "--form=n");
  }

  args.push(
    // `--` closes the --encrypt option group; the paths follow it.
    "--",
    inputPath,
    outputPath,
  );

  return args;
}

/** Bytes the PDF format will actually hash for the chosen cipher. */
export function passwordByteLimit(strength: PdfEncryptionStrength): number {
  return strength === "aes256" ? AES256_PASSWORD_BYTES : AES128_PASSWORD_BYTES;
}

/**
 * Warn when the format will silently ignore part of the password.
 *
 * Returns null when the whole password is used, which is the common case —
 * the limits only bite on passphrases, and on AES-128 more often than people
 * expect.
 */
export function passwordTruncationWarning(
  password: string,
  strength: PdfEncryptionStrength,
): string | null {
  const bytes = new TextEncoder().encode(password).length;
  const limit = passwordByteLimit(strength);
  if (bytes <= limit) return null;

  const cipher = strength === "aes256" ? "AES-256" : "AES-128";
  return `${cipher} hashes only the first ${limit} bytes of a password, and yours is ${bytes} bytes. The extra characters add no protection. Readers truncate it the same way, so the document still opens with the full password you typed.`;
}

/**
 * Classify qpdf's combined stdout/stderr into an actionable error.
 *
 * Ordering matters: an encrypted input tends to produce a password complaint
 * first and a structural one afterwards, so the password cases are checked
 * before the generic damage cases.
 */
export function classifyQpdfError(
  output: string,
  exitCode: number,
): PdfEncryptFailure {
  const detail = output.trim();
  const lower = detail.toLowerCase();

  const fail = (
    code: PdfEncryptErrorCode,
    message: string,
  ): PdfEncryptFailure => ({ ok: false, code, message, detail });

  if (lower.includes("invalid password")) {
    return fail(
      "already-encrypted",
      "This PDF already has a password on it. Remove the existing password first with the PDF Password Remover, then protect it again here.",
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

/**
 * qpdf prints this on a successful inspect pass over a file with no
 * protection, which is exactly the input this tool wants.
 */
export function isNotEncrypted(output: string): boolean {
  return /file is not encrypted/i.test(output);
}

/**
 * Turn a raw worker report into the final result shown to the user.
 *
 * qpdf runs in two passes. The first (`--show-encryption`) establishes that
 * the input is not already protected; the second writes the encrypted copy.
 * Splitting them is what lets "you already have a password on this" be
 * reported as itself rather than as a failed encryption.
 */
export function interpretWorkerResponse(
  response: PdfEncryptWorkerResponse,
): PdfEncryptResult {
  const { stage, exitCode, bytes } = response;
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
    // A failed inspect pass on an encrypted file is the common path here:
    // qpdf cannot read it without the password, and says so.
    if (!isQpdfSuccess(exitCode)) return classifyQpdfError(output, exitCode);

    // The inspect pass succeeded and the file *is* encrypted — an owner
    // password with no user password reads fine without a credential.
    // Re-encrypting it would silently drop the existing protection.
    if (!isNotEncrypted(output)) {
      return {
        ok: false,
        code: "already-encrypted",
        message:
          "This PDF already has protection on it. Remove it first with the PDF Password Remover, then add a new password here.",
        detail: output,
      };
    }

    // The worker should have continued to the encrypt pass.
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
      message: "Encryption finished but produced no output.",
      detail: output,
    };
  }

  return {
    ok: true,
    bytes: new Uint8Array(bytes),
    warnings: extractWarnings(output),
  };
}

/** Build the download filename: `report.pdf` -> `report-protected.pdf`. */
export function protectedFileName(originalName: string): string {
  const trimmed = originalName.trim();
  if (!trimmed) return "protected.pdf";

  const withoutExtension = trimmed.replace(/\.pdf$/i, "");
  const base = withoutExtension.length > 0 ? withoutExtension : "protected";
  return `${base}-protected.pdf`;
}

/** Short phrase describing what was applied, for the success alert. */
export function describeStrength(strength: PdfEncryptionStrength): string {
  return strength === "aes256"
    ? "AES-256 (revision 6)"
    : "AES-128 (revision 4)";
}

/**
 * List the restrictions that were applied, for display.
 * Empty when the recipient may do everything — the usual case.
 */
export function describeRestrictions(
  permissions: PdfEncryptPermissions,
): string[] {
  const restrictions: string[] = [];
  if (!permissions.print) restrictions.push("printing");
  if (!permissions.copy) restrictions.push("copying text and images");
  if (!permissions.modify) restrictions.push("editing");
  if (!permissions.annotate) restrictions.push("commenting and form filling");
  return restrictions;
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
  userPassword: string,
  confirmPassword: string,
): PdfEncryptFailure | null {
  const fail = (
    code: PdfEncryptErrorCode,
    message: string,
  ): PdfEncryptFailure => ({ ok: false, code, message, detail: "" });

  if (fileSize === 0) {
    return fail("empty-file", "That file is empty.");
  }

  if (fileSize > MAX_PDF_BYTES) {
    return fail(
      "too-large",
      `That file is ${formatBytes(fileSize)}. The limit is ${formatBytes(MAX_PDF_BYTES)} so the browser tab stays responsive.`,
    );
  }

  if (userPassword.length === 0) {
    return fail(
      "no-password",
      "Enter a password. Without one there is nothing to protect the document with.",
    );
  }

  if (userPassword.length > MAX_PASSWORD_LENGTH) {
    return fail("password-too-long", "That password is unreasonably long.");
  }

  // Checked here rather than left to the worker: getting this wrong produces a
  // file nobody can open, and the original may be the only other copy.
  if (userPassword !== confirmPassword) {
    return fail(
      "password-mismatch",
      "The two passwords do not match. Retype the confirmation.",
    );
  }

  return null;
}

/** Full validation, once the bytes are in hand. */
export function validateRequest(
  bytes: Uint8Array,
  options: PdfEncryptOptions,
): PdfEncryptFailure | null {
  const fail = (
    code: PdfEncryptErrorCode,
    message: string,
  ): PdfEncryptFailure => ({ ok: false, code, message, detail: "" });

  if (bytes.length === 0) {
    return fail("empty-file", "That file is empty.");
  }

  if (bytes.length > MAX_PDF_BYTES) {
    return fail(
      "too-large",
      `That file is ${formatBytes(bytes.length)}. The limit is ${formatBytes(MAX_PDF_BYTES)} so the browser tab stays responsive.`,
    );
  }

  if (options.userPassword.length === 0) {
    return fail(
      "no-password",
      "Enter a password. Without one there is nothing to protect the document with.",
    );
  }

  if (
    options.userPassword.length > MAX_PASSWORD_LENGTH ||
    options.ownerPassword.length > MAX_PASSWORD_LENGTH
  ) {
    return fail("password-too-long", "That password is unreasonably long.");
  }

  if (!looksLikePdf(bytes)) {
    return fail(
      "not-a-pdf",
      "This file is not a PDF. Check that you selected the right file.",
    );
  }

  return null;
}
