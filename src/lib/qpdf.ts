/** Shared qpdf limits, exit-code handling, and output sanitization. */

/** Transferred bytes and MEMFS copies coexist on the JS heap until released. */
export const MAX_PDF_BYTES = 100 * 1024 * 1024;

const PDF_HEADER = "%PDF-";

/** qpdf exit 3 means success with warnings; workers mirror this rule. */
export function isQpdfSuccess(exitCode: number): boolean {
  return exitCode === 0 || exitCode === 3;
}

/** Scrub passwords that `qpdf --show-encryption` may print into the details panel. */
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

/** Match a trailer's indirect `/Encrypt N N R` reference, not a bare text occurrence. */
const TRAILER_ENCRYPT = /\/Encrypt\s+\d+\s+\d+\s+R/;

/**
 * Fast encryption hint for head/tail chunks; qpdf makes the final decision.
 * The trailer is at the end, or also at the front for linearized PDFs.
 */
export function declaresEncryption(bytes: Uint8Array): boolean {
  // latin1 is byte-preserving, and TextDecoder handles a chunk of any size —
  // String.fromCharCode(...bytes) would risk blowing the argument limit.
  const text = new TextDecoder("latin1").decode(bytes);
  return TRAILER_ENCRYPT.test(text);
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
