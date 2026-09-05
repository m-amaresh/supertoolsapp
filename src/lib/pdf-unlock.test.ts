import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyQpdfError,
  describeEncryption,
  extractWarnings,
  formatBytes,
  interpretWorkerResponse,
  isNotEncrypted,
  isQpdfSuccess,
  looksLikePdf,
  MAX_PASSWORD_LENGTH,
  MAX_PDF_BYTES,
  type PdfUnlockWorkerResponse,
  parseEncryptionInfo,
  redactQpdfSecrets,
  stripProgramPrefix,
  unlockedFileName,
  validateRequest,
  validateRequestMetadata,
} from "./pdf-unlock";

const pdfBytes = (body = "") =>
  new TextEncoder().encode(`%PDF-1.7\n${body}`) as Uint8Array;

describe("pdf-unlock: input detection", () => {
  it("accepts a buffer starting with the PDF header", () => {
    expect(looksLikePdf(pdfBytes())).toBe(true);
  });

  it("tolerates junk before the header, as qpdf does", () => {
    const bytes = new TextEncoder().encode(`junk junk\n%PDF-1.4\n`);
    expect(looksLikePdf(bytes)).toBe(true);
  });

  it("rejects a file with no header in the first 1024 bytes", () => {
    const bytes = new TextEncoder().encode("not a pdf at all");
    expect(looksLikePdf(bytes)).toBe(false);
  });

  it("does not scan past the first 1024 bytes", () => {
    const bytes = new TextEncoder().encode(`${"x".repeat(2000)}%PDF-1.7`);
    expect(looksLikePdf(bytes)).toBe(false);
  });
});

describe("pdf-unlock: request validation", () => {
  it("passes a well-formed request", () => {
    expect(validateRequest(pdfBytes(), "hunter2")).toBeNull();
  });

  it("allows an empty password for owner-password-only files", () => {
    expect(validateRequest(pdfBytes(), "")).toBeNull();
  });

  it("rejects an empty file", () => {
    const result = validateRequest(new Uint8Array(0), "");
    expect(result?.code).toBe("empty-file");
  });

  it("rejects a file over the size limit", () => {
    // Build a header-bearing buffer just past the cap.
    const bytes = new Uint8Array(MAX_PDF_BYTES + 1);
    bytes.set(pdfBytes(), 0);
    const result = validateRequest(bytes, "");
    expect(result?.code).toBe("too-large");
    expect(result?.message).toContain("100.00 MB");
  });

  it("rejects a non-PDF before doing any work", () => {
    const result = validateRequest(new TextEncoder().encode("hello"), "");
    expect(result?.code).toBe("not-a-pdf");
  });

  it("rejects an absurdly long password", () => {
    const result = validateRequest(pdfBytes(), "x".repeat(5000));
    expect(result?.code).toBe("invalid-password");
  });
});

describe("pdf-unlock: qpdf error classification", () => {
  it("detects a wrong password", () => {
    const result = classifyQpdfError("qpdf: in.pdf: invalid password", 2);
    expect(result.code).toBe("invalid-password");
    expect(result.message).toMatch(/case-sensitive/);
  });

  it("prefers the password diagnosis over structural noise", () => {
    const output = [
      "WARNING: in.pdf: can't find startxref",
      "qpdf: in.pdf: invalid password",
    ].join("\n");
    expect(classifyQpdfError(output, 2).code).toBe("invalid-password");
  });

  it("detects a file that is not a PDF", () => {
    const output = "WARNING: in.pdf: can't find PDF header";
    expect(classifyQpdfError(output, 2).code).toBe("not-a-pdf");
  });

  it("detects a damaged file", () => {
    const output = "qpdf: in.pdf: can't find startxref";
    expect(classifyQpdfError(output, 2).code).toBe("damaged");
  });

  it("detects an unsupported security handler", () => {
    const output = "qpdf: in.pdf: unsupported encryption filter";
    const result = classifyQpdfError(output, 2);
    expect(result.code).toBe("unsupported-encryption");
    expect(result.message).toMatch(/DRM/);
  });

  it("falls back to the first output line for unknown failures", () => {
    const result = classifyQpdfError("qpdf: something strange happened", 2);
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("something strange happened");
  });

  it("falls back to the exit code when there is no output", () => {
    const result = classifyQpdfError("", 9);
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("qpdf exited with code 9.");
  });

  it("preserves raw output as detail", () => {
    expect(classifyQpdfError("qpdf: in.pdf: invalid password", 2).detail).toBe(
      "qpdf: in.pdf: invalid password",
    );
  });
});

describe("pdf-unlock: output parsing", () => {
  it("recognises an unencrypted file", () => {
    expect(isNotEncrypted("File is not encrypted")).toBe(true);
    expect(isNotEncrypted("R = 6")).toBe(false);
  });

  it("strips the program prefix qpdf prepends", () => {
    expect(stripProgramPrefix("qpdf: in.pdf: invalid password")).toBe(
      "in.pdf: invalid password",
    );
    expect(stripProgramPrefix("no prefix here")).toBe("no prefix here");
  });

  it("extracts warnings and drops the WARNING label", () => {
    const output = [
      "WARNING: in.pdf: file is damaged",
      "R = 6",
      "WARNING: in.pdf: recovered cross-reference table",
    ].join("\n");
    expect(extractWarnings(output)).toEqual([
      "file is damaged",
      "recovered cross-reference table",
    ]);
  });

  it("returns no warnings for clean output", () => {
    expect(extractWarnings("R = 6\nP = -4")).toEqual([]);
  });

  it("reports a warning once when both passes emit it", () => {
    const warning = "WARNING: in.pdf: reported number of objects (45) is not";
    expect(extractWarnings(`${warning}\nR = 4\n${warning}`)).toEqual([
      "reported number of objects (45) is not",
    ]);
  });

  it("ignores the summary line qpdf prints after a run that warned", () => {
    const output = [
      "WARNING: in.pdf: reported number of objects (45) is not",
      "qpdf: operation succeeded with warnings",
      "qpdf: operation succeeded with warnings; resulting file may have some problems",
    ].join("\n");
    expect(extractWarnings(output)).toEqual([
      "reported number of objects (45) is not",
    ]);
  });

  it("treats only 0 and 3 as qpdf success", () => {
    expect(isQpdfSuccess(0)).toBe(true);
    expect(isQpdfSuccess(3)).toBe(true);
    expect(isQpdfSuccess(2)).toBe(false);
    expect(isQpdfSuccess(-1)).toBe(false);
  });

  it("redacts the user password qpdf prints for an owner-password unlock", () => {
    const output = [
      "R = 4",
      "User password = hunter2",
      "Supplied password is owner password",
    ].join("\n");
    const redacted = redactQpdfSecrets(output);
    expect(redacted).not.toContain("hunter2");
    expect(redacted).toContain("User password = [hidden]");
    // The lines the UI actually reads must survive untouched.
    expect(redacted).toContain("Supplied password is owner password");
    expect(redacted).toContain("R = 4");
  });
});

describe("pdf-unlock: encryption summary", () => {
  const aes256Output = [
    "R = 6",
    "P = -4",
    "User password = secret",
    "Supplied password is user password",
    "stream encryption method: AESv3",
    "string encryption method: AESv3",
    "file encryption method: AESv3",
  ].join("\n");

  it("parses revision, cipher, and which password was supplied", () => {
    expect(parseEncryptionInfo(aes256Output)).toEqual({
      revision: 6,
      method: "AESv3",
      suppliedPassword: "user",
    });
  });

  it("recognises an owner password", () => {
    const output = aes256Output.replace(
      "Supplied password is user password",
      "Supplied password is owner password",
    );
    expect(parseEncryptionInfo(output)?.suppliedPassword).toBe("owner");
  });

  it("returns null for unencrypted or empty output", () => {
    expect(parseEncryptionInfo("File is not encrypted")).toBeNull();
    expect(parseEncryptionInfo("   ")).toBeNull();
  });

  it("tolerates missing fields", () => {
    expect(parseEncryptionInfo("R = 4")).toEqual({
      revision: 4,
      method: null,
      suppliedPassword: null,
    });
  });

  it("describes known ciphers in familiar terms", () => {
    expect(
      describeEncryption({
        revision: 6,
        method: "AESv3",
        suppliedPassword: "user",
      }),
    ).toBe("AES-256 (revision 6)");
    expect(
      describeEncryption({
        revision: 4,
        method: "AESv2",
        suppliedPassword: null,
      }),
    ).toBe("AES-128 (revision 4)");
    expect(
      describeEncryption({
        revision: 3,
        method: "RC4",
        suppliedPassword: null,
      }),
    ).toBe("RC4 (revision 3)");
  });

  it("falls back gracefully for unknown or absent info", () => {
    expect(describeEncryption(null)).toBe("Encrypted");
    expect(
      describeEncryption({
        revision: null,
        method: "Blowfish",
        suppliedPassword: null,
      }),
    ).toBe("Blowfish");
  });
});

describe("pdf-unlock: worker response interpretation", () => {
  const aes256Inspect = [
    "R = 6",
    "Supplied password is user password",
    "file encryption method: AESv3",
  ].join("\n");

  const response = (
    overrides: Partial<PdfUnlockWorkerResponse>,
  ): PdfUnlockWorkerResponse => ({
    stage: "decrypt",
    exitCode: 0,
    output: "",
    inspectOutput: aes256Inspect,
    bytes: new Uint8Array([1, 2, 3]).buffer,
    ...overrides,
  });

  it("reports a successful decrypt with the cipher that was removed", () => {
    const result = interpretWorkerResponse(response({}));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.from(result.bytes)).toEqual([1, 2, 3]);
    expect(result.encryption?.method).toBe("AESv3");
    expect(result.warnings).toEqual([]);
  });

  it("treats exit code 3 as success with warnings", () => {
    const result = interpretWorkerResponse(
      response({
        exitCode: 3,
        output: "WARNING: in.pdf: recovered cross-reference table",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual(["recovered cross-reference table"]);
  });

  it("unlocks a file whose structure made qpdf warn on both passes", () => {
    const warning =
      "WARNING: in.pdf: reported number of objects (45) is not one plus the highest object number (43)";
    const result = interpretWorkerResponse(
      response({
        exitCode: 3,
        output: warning,
        inspectOutput: `${warning}\n${aes256Inspect}`,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.encryption?.method).toBe("AESv3");
    expect(result.warnings).toEqual([
      "reported number of objects (45) is not one plus the highest object number (43)",
    ]);
  });

  it("keeps the document's own password out of the failure detail", () => {
    const result = interpretWorkerResponse(
      response({
        stage: "decrypt",
        exitCode: 2,
        output: "qpdf: in.pdf: something broke\nUser password = hunter2",
        bytes: null,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).not.toContain("hunter2");
  });

  it("surfaces a wrong password from the inspect pass", () => {
    const result = interpretWorkerResponse(
      response({
        stage: "inspect",
        exitCode: 2,
        output: "qpdf: in.pdf: invalid password",
        bytes: null,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("invalid-password");
  });

  it("reports a file that was never encrypted", () => {
    const result = interpretWorkerResponse(
      response({
        stage: "inspect",
        exitCode: 0,
        output: "File is not encrypted",
        inspectOutput: "File is not encrypted",
        bytes: null,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("not-encrypted");
  });

  it("reports engine startup failures", () => {
    const result = interpretWorkerResponse(
      response({ stage: "startup", exitCode: -1, output: "boom", bytes: null }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("worker-failed");
    expect(result.detail).toBe("boom");
  });

  it("fails a decrypt that produced no bytes", () => {
    const result = interpretWorkerResponse(response({ bytes: null }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unknown");
  });

  it("fails a decrypt that errored", () => {
    const result = interpretWorkerResponse(
      response({
        exitCode: 2,
        output: "qpdf: in.pdf: can't find startxref",
        bytes: null,
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("damaged");
  });
});

describe("pdf-unlock: presentation helpers", () => {
  it("derives the unlocked filename", () => {
    expect(unlockedFileName("report.pdf")).toBe("report-unlocked.pdf");
    expect(unlockedFileName("Q3 Report.PDF")).toBe("Q3 Report-unlocked.pdf");
    expect(unlockedFileName("no-extension")).toBe("no-extension-unlocked.pdf");
  });

  it("handles empty or extension-only names", () => {
    expect(unlockedFileName("")).toBe("unlocked.pdf");
    expect(unlockedFileName("   ")).toBe("unlocked.pdf");
    expect(unlockedFileName(".pdf")).toBe("unlocked-unlocked.pdf");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
  });
});

describe("pre-read validation", () => {
  it("rejects an oversized file from its size alone", () => {
    const failure = validateRequestMetadata(MAX_PDF_BYTES + 1, 0);
    expect(failure?.code).toBe("too-large");
  });

  it("rejects an empty file from its size alone", () => {
    expect(validateRequestMetadata(0, 0)?.code).toBe("empty-file");
  });

  it("rejects an over-long password before reading anything", () => {
    const failure = validateRequestMetadata(1024, MAX_PASSWORD_LENGTH + 1);
    expect(failure?.code).toBe("invalid-password");
  });

  it("accepts a file within the limit", () => {
    expect(validateRequestMetadata(1024, 8)).toBeNull();
  });

  it("still rejects oversized buffers if one reaches validateRequest", () => {
    const failure = validateRequest(new Uint8Array(MAX_PDF_BYTES + 1), "");
    expect(failure?.code).toBe("too-large");
  });

  /**
   * The point of `validateRequestMetadata` is *when* it runs. Asserting only
   * that it returns the right code would stay green if the page went back to
   * reading the file first, which is the defect this guards.
   */
  it("is called before the file is read", () => {
    const page = readFileSync(
      join(import.meta.dirname, "../app/tools/pdf/unlock/page.tsx"),
      "utf8",
    );
    const check = page.indexOf("validateRequestMetadata(");
    const read = page.indexOf("await file.arrayBuffer()");

    expect(
      check,
      "page.tsx does not call validateRequestMetadata",
    ).toBeGreaterThan(-1);
    expect(read, "page.tsx does not read the file").toBeGreaterThan(-1);
    expect(
      check,
      "the size check must precede file.arrayBuffer(), or an oversized file " +
        "is allocated in page memory before being refused",
    ).toBeLessThan(read);
  });
});
