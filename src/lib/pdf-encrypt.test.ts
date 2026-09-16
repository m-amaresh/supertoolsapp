import { describe, expect, it } from "vitest";
import {
  AES128_PASSWORD_BYTES,
  AES256_PASSWORD_BYTES,
  buildEncryptArgs,
  classifyQpdfError,
  DEFAULT_PERMISSIONS,
  describeRestrictions,
  describeStrength,
  effectiveOwnerPassword,
  interpretWorkerResponse,
  isNotEncrypted,
  MAX_PASSWORD_LENGTH,
  MAX_PDF_BYTES,
  modifyOption,
  type PdfEncryptOptions,
  type PdfEncryptWorkerResponse,
  passwordTruncationWarning,
  protectedFileName,
  validateRequest,
  validateRequestMetadata,
} from "./pdf-encrypt";

const pdfBytes = (body = "") =>
  new TextEncoder().encode(`%PDF-1.7\n${body}`) as Uint8Array;

const options = (
  overrides: Partial<PdfEncryptOptions> = {},
): PdfEncryptOptions => ({
  userPassword: "hunter2",
  ownerPassword: "",
  strength: "aes256",
  permissions: { ...DEFAULT_PERMISSIONS },
  ...overrides,
});

describe("pdf-encrypt: qpdf argument construction", () => {
  it("puts the paths after the -- that closes the --encrypt group", () => {
    const args = buildEncryptArgs(options(), "in.pdf", "out.pdf");
    expect(args[0]).toBe("--encrypt");
    expect(args.slice(-3)).toEqual(["--", "in.pdf", "out.pdf"]);
  });

  it("sends both passwords so an insecure empty owner password is impossible", () => {
    const args = buildEncryptArgs(
      options({ userPassword: "s3cret" }),
      "i",
      "o",
    );
    expect(args).toContain("--user-password=s3cret");
    expect(args).toContain("--owner-password=s3cret");
    expect(args).not.toContain("--allow-insecure");
  });

  it("keeps a distinct owner password when one is given", () => {
    const args = buildEncryptArgs(
      options({ userPassword: "open-me", ownerPassword: "admin" }),
      "i",
      "o",
    );
    expect(args).toContain("--user-password=open-me");
    expect(args).toContain("--owner-password=admin");
  });

  it("requests 256-bit keys for aes256 and does not pass --use-aes", () => {
    const args = buildEncryptArgs(options({ strength: "aes256" }), "i", "o");
    expect(args).toContain("--bits=256");
    // AES is the only cipher V5/R6 defines; qpdf rejects the flag at 256 bits.
    expect(args.some((arg) => arg.startsWith("--use-aes"))).toBe(false);
  });

  it("forces AES on at 128 bits, where qpdf would otherwise write RC4", () => {
    const args = buildEncryptArgs(options({ strength: "aes128" }), "i", "o");
    expect(args).toContain("--bits=128");
    expect(args).toContain("--use-aes=y");
  });

  it("maps a fully permissive selection onto qpdf's allow-everything flags", () => {
    const args = buildEncryptArgs(options(), "i", "o");
    expect(args).toContain("--print=full");
    expect(args).toContain("--modify=all");
    expect(args).toContain("--extract=y");
  });

  it("maps a fully restrictive selection onto qpdf's deny flags", () => {
    const args = buildEncryptArgs(
      options({
        permissions: {
          print: false,
          copy: false,
          modify: false,
          annotate: false,
        },
      }),
      "i",
      "o",
    );
    expect(args).toContain("--print=none");
    expect(args).toContain("--modify=none");
    expect(args).toContain("--extract=n");
  });

  it("passes a password containing shell metacharacters through untouched", () => {
    // callMain takes an argv array, so nothing is ever parsed by a shell —
    // but a regression to string concatenation would surface here.
    const nasty = `a b"c'd;$(e)\`f\\g`;
    const args = buildEncryptArgs(options({ userPassword: nasty }), "i", "o");
    expect(args).toContain(`--user-password=${nasty}`);
  });

  it("denies commenting even when editing is allowed", () => {
    // Regression: --modify=all grants annotation on the way past, so emitting
    // the level alone produced a file that allowed commenting while the UI
    // listed it as restricted.
    const args = buildEncryptArgs(
      options({ permissions: { ...DEFAULT_PERMISSIONS, annotate: false } }),
      "i",
      "o",
    );
    expect(args).toContain("--modify=all");
    expect(args).toContain("--annotate=n");
    // The permission is described to the reader as covering form filling too,
    // and qpdf tracks that as a separate bit.
    expect(args).toContain("--form=n");
  });

  it("does not bother denying commenting when it is allowed", () => {
    const args = buildEncryptArgs(options(), "i", "o");
    expect(args.some((arg) => arg.startsWith("--annotate"))).toBe(false);
  });

  it("leaves the annotate-only level to speak for itself", () => {
    // --modify=annotate already means "comment yes, edit no"; adding
    // --annotate=n on top would contradict it.
    const args = buildEncryptArgs(
      options({ permissions: { ...DEFAULT_PERMISSIONS, modify: false } }),
      "i",
      "o",
    );
    expect(args).toContain("--modify=annotate");
    expect(args).not.toContain("--annotate=n");
    expect(args).not.toContain("--form=n");
  });

  it("emits no duplicate flags", () => {
    const args = buildEncryptArgs(options({ strength: "aes128" }), "i", "o");
    const flags = args
      .filter((arg) => arg.startsWith("--") && arg.includes("="))
      .map((arg) => arg.slice(0, arg.indexOf("=")));
    expect(new Set(flags).size).toBe(flags.length);
  });
});

describe("pdf-encrypt: owner password fallback", () => {
  it("falls back to the open password when none is given", () => {
    expect(effectiveOwnerPassword(options({ userPassword: "abc" }))).toBe(
      "abc",
    );
  });

  it("prefers an explicit owner password", () => {
    expect(
      effectiveOwnerPassword(
        options({ userPassword: "abc", ownerPassword: "xyz" }),
      ),
    ).toBe("xyz");
  });
});

describe("pdf-encrypt: modify level collapsing", () => {
  it("allows everything when editing is permitted", () => {
    expect(modifyOption({ ...DEFAULT_PERMISSIONS })).toBe("all");
  });

  it("drops to annotate-only when editing is denied but commenting is not", () => {
    expect(modifyOption({ ...DEFAULT_PERMISSIONS, modify: false })).toBe(
      "annotate",
    );
  });

  it("denies the whole family when both are off", () => {
    expect(
      modifyOption({ ...DEFAULT_PERMISSIONS, modify: false, annotate: false }),
    ).toBe("none");
  });

  it("still reports all when editing is allowed but commenting is not", () => {
    // The level cannot express that combination on its own; buildEncryptArgs
    // adds --annotate=n after it. See the argument tests below.
    expect(modifyOption({ ...DEFAULT_PERMISSIONS, annotate: false })).toBe(
      "all",
    );
  });
});

describe("pdf-encrypt: password truncation warnings", () => {
  it("stays quiet for an ordinary password", () => {
    expect(passwordTruncationWarning("hunter2", "aes256")).toBeNull();
    expect(passwordTruncationWarning("hunter2", "aes128")).toBeNull();
  });

  it("stays quiet exactly at the limit", () => {
    expect(
      passwordTruncationWarning("a".repeat(AES256_PASSWORD_BYTES), "aes256"),
    ).toBeNull();
    expect(
      passwordTruncationWarning("a".repeat(AES128_PASSWORD_BYTES), "aes128"),
    ).toBeNull();
  });

  it("warns one byte past the limit", () => {
    const warning = passwordTruncationWarning(
      "a".repeat(AES256_PASSWORD_BYTES + 1),
      "aes256",
    );
    expect(warning).toContain("127");
    expect(warning).toContain("128 bytes");
  });

  it("applies the much tighter 32-byte limit to AES-128", () => {
    const password = "a".repeat(40);
    expect(passwordTruncationWarning(password, "aes256")).toBeNull();
    expect(passwordTruncationWarning(password, "aes128")).toContain("32");
  });

  it("counts UTF-8 bytes rather than characters", () => {
    // 12 emoji at 4 bytes each is 48 bytes — under the AES-256 limit by
    // character count, over the AES-128 one by byte count.
    const password = "🔒".repeat(12);
    expect(password.length).toBeLessThan(AES128_PASSWORD_BYTES);
    expect(passwordTruncationWarning(password, "aes128")).toContain("48 bytes");
  });
});

describe("pdf-encrypt: qpdf error classification", () => {
  it("reads an invalid password as an already-protected input", () => {
    const result = classifyQpdfError("in.pdf: invalid password", 2);
    expect(result.code).toBe("already-encrypted");
    expect(result.message).toContain("PDF Password Remover");
  });

  it("detects a non-PDF", () => {
    expect(classifyQpdfError("in.pdf: can't find PDF header", 2).code).toBe(
      "not-a-pdf",
    );
  });

  it("detects a damaged file", () => {
    expect(classifyQpdfError("in.pdf: can't find startxref", 2).code).toBe(
      "damaged",
    );
  });

  it("falls back to the first line of output", () => {
    const result = classifyQpdfError("qpdf: something went sideways", 2);
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("something went sideways");
  });

  it("falls back to the exit code when there is no output at all", () => {
    expect(classifyQpdfError("   ", 9).message).toBe(
      "qpdf exited with code 9.",
    );
  });

  it("keeps the raw output as detail", () => {
    expect(classifyQpdfError("in.pdf: invalid password", 2).detail).toBe(
      "in.pdf: invalid password",
    );
  });
});

describe("pdf-encrypt: unencrypted input detection", () => {
  it("recognises qpdf's phrasing", () => {
    expect(isNotEncrypted("File is not encrypted")).toBe(true);
  });

  it("does not match an encryption report", () => {
    expect(isNotEncrypted("R = 6\nfile encryption method: AESv3")).toBe(false);
  });
});

describe("pdf-encrypt: worker response interpretation", () => {
  const response = (
    overrides: Partial<PdfEncryptWorkerResponse> = {},
  ): PdfEncryptWorkerResponse => ({
    stage: "encrypt",
    exitCode: 0,
    output: "",
    bytes: new Uint8Array([1, 2, 3]).buffer,
    ...overrides,
  });

  it("reports a startup failure as an engine problem", () => {
    const result = interpretWorkerResponse(
      response({ stage: "startup", exitCode: -1, bytes: null }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("worker-failed");
  });

  it("refuses a file that is already protected", () => {
    const result = interpretWorkerResponse(
      response({
        stage: "inspect",
        exitCode: 0,
        output: "R = 6\nfile encryption method: AESv3",
        bytes: null,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("already-encrypted");
  });

  it("refuses a file qpdf could not open without a password", () => {
    const result = interpretWorkerResponse(
      response({
        stage: "inspect",
        exitCode: 2,
        output: "in.pdf: invalid password",
        bytes: null,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("already-encrypted");
  });

  it("treats a stalled inspect pass as an engine problem", () => {
    const result = interpretWorkerResponse(
      response({
        stage: "inspect",
        exitCode: 0,
        output: "File is not encrypted",
        bytes: null,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("worker-failed");
  });

  it("returns the encrypted bytes on success", () => {
    const result = interpretWorkerResponse(response());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.from(result.bytes)).toEqual([1, 2, 3]);
      expect(result.warnings).toEqual([]);
    }
  });

  it("accepts exit code 3, which means it succeeded with warnings", () => {
    const result = interpretWorkerResponse(
      response({
        exitCode: 3,
        output: "in.pdf: WARNING: file had an invalid cross-reference table",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([
        "file had an invalid cross-reference table",
      ]);
    }
  });

  it("fails when the encrypt pass produced no bytes", () => {
    const result = interpretWorkerResponse(response({ bytes: null }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });

  it("fails on an empty output buffer", () => {
    const result = interpretWorkerResponse(
      response({ bytes: new ArrayBuffer(0) }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });

  it("redacts secrets qpdf may have printed", () => {
    const result = interpretWorkerResponse(
      response({
        stage: "inspect",
        exitCode: 0,
        output: "R = 6\nuser password = letmein",
        bytes: null,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).not.toContain("letmein");
      expect(result.detail).toContain("[hidden]");
    }
  });
});

describe("pdf-encrypt: presentation helpers", () => {
  it("names the output after the input", () => {
    expect(protectedFileName("report.pdf")).toBe("report-protected.pdf");
  });

  it("is case-insensitive about the extension", () => {
    expect(protectedFileName("Report.PDF")).toBe("Report-protected.pdf");
  });

  it("handles a name with no extension", () => {
    expect(protectedFileName("report")).toBe("report-protected.pdf");
  });

  it("falls back for an empty name", () => {
    expect(protectedFileName("   ")).toBe("protected.pdf");
  });

  it("describes both ciphers with their revision", () => {
    expect(describeStrength("aes256")).toBe("AES-256 (revision 6)");
    expect(describeStrength("aes128")).toBe("AES-128 (revision 4)");
  });

  it("lists nothing when every action is permitted", () => {
    expect(describeRestrictions({ ...DEFAULT_PERMISSIONS })).toEqual([]);
  });

  it("lists each denied action", () => {
    expect(
      describeRestrictions({
        print: false,
        copy: false,
        modify: true,
        annotate: true,
      }),
    ).toEqual(["printing", "copying text and images"]);
  });
});

describe("pdf-encrypt: pre-read validation", () => {
  it("accepts a well-formed request", () => {
    expect(validateRequestMetadata(1024, "hunter2", "hunter2")).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(validateRequestMetadata(0, "a", "a")?.code).toBe("empty-file");
  });

  it("rejects a file over the size limit", () => {
    expect(validateRequestMetadata(MAX_PDF_BYTES + 1, "a", "a")?.code).toBe(
      "too-large",
    );
  });

  it("rejects a missing password", () => {
    expect(validateRequestMetadata(1024, "", "")?.code).toBe("no-password");
  });

  it("rejects a mistyped confirmation", () => {
    const failure = validateRequestMetadata(1024, "hunter2", "hunter3");
    expect(failure?.code).toBe("password-mismatch");
  });

  it("rejects an absurdly long password", () => {
    const password = "a".repeat(MAX_PASSWORD_LENGTH + 1);
    expect(validateRequestMetadata(1024, password, password)?.code).toBe(
      "password-too-long",
    );
  });

  it("checks size before the password, so a huge file fails fast", () => {
    expect(validateRequestMetadata(MAX_PDF_BYTES + 1, "", "")?.code).toBe(
      "too-large",
    );
  });
});

describe("pdf-encrypt: full validation", () => {
  it("accepts a PDF with a password", () => {
    expect(validateRequest(pdfBytes(), options())).toBeNull();
  });

  it("rejects a file that is not a PDF", () => {
    const bytes = new TextEncoder().encode("just some text");
    expect(validateRequest(bytes, options())?.code).toBe("not-a-pdf");
  });

  it("rejects an empty buffer", () => {
    expect(validateRequest(new Uint8Array(0), options())?.code).toBe(
      "empty-file",
    );
  });

  it("rejects a missing password", () => {
    expect(
      validateRequest(pdfBytes(), options({ userPassword: "" }))?.code,
    ).toBe("no-password");
  });

  it("rejects an over-long owner password too", () => {
    const failure = validateRequest(
      pdfBytes(),
      options({ ownerPassword: "a".repeat(MAX_PASSWORD_LENGTH + 1) }),
    );
    expect(failure?.code).toBe("password-too-long");
  });
});
