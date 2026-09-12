import { describe, expect, it } from "vitest";
import {
  buildInspectArgs,
  buildMergeArgs,
  classifyMergeError,
  describeMerge,
  findOffendingIndex,
  interpretMergeResponse,
  isEncrypted,
  MAX_MERGE_FILES,
  MAX_PDF_BYTES,
  MAX_TOTAL_MERGE_BYTES,
  MERGE_OUTPUT_PATH,
  MIN_MERGE_FILES,
  mergedFileName,
  moveItem,
  type PdfMergeWorkerResponse,
  resolveScratchNames,
  scratchName,
  validateBytes,
  validateSelection,
} from "./pdf-merge";

const pdfBytes = (body = "") =>
  new TextEncoder().encode(`%PDF-1.7\n${body}`) as Uint8Array;

const response = (
  overrides: Partial<PdfMergeWorkerResponse> = {},
): PdfMergeWorkerResponse => ({
  stage: "merge",
  exitCode: 0,
  output: "",
  pageCount: 3,
  encryptedIndexes: [],
  bytes: pdfBytes().buffer as ArrayBuffer,
  ...overrides,
});

describe("pdf-merge: qpdf argv", () => {
  it("passes every input as an explicit --file= token", () => {
    // qpdf 11 onward rejects a bare filename in a --pages list with "invalid
    // range syntax", so the shorthand older docs show cannot be used.
    expect(buildMergeArgs(3)).toEqual([
      "in0.pdf",
      "--decrypt",
      "--pages",
      "--file=in0.pdf",
      "--file=in1.pdf",
      "--file=in2.pdf",
      "--",
      "out.pdf",
    ]);
  });

  it("always decrypts, so one input cannot restrict the whole output", () => {
    // qpdf carries the *primary input's* encryption into the output. Without
    // --decrypt, merging a file that opens freely but forbids printing gave an
    // AES-256 result that forbade printing — applying one document's
    // restrictions to every other document's pages.
    expect(buildMergeArgs(2)).toContain("--decrypt");
  });

  it("uses the first input as the primary input, not --empty", () => {
    // The merged document inherits the first file's document-level metadata.
    const args = buildMergeArgs(2);
    expect(args[0]).toBe(scratchName(0));
    expect(args).not.toContain("--empty");
  });

  it("lists the first file's pages exactly once despite it being primary", () => {
    const args = buildMergeArgs(2);
    expect(args.filter((arg) => arg === "--file=in0.pdf")).toHaveLength(1);
  });

  it("terminates the page list before the output path", () => {
    const args = buildMergeArgs(2);
    expect(args.at(-2)).toBe("--");
    expect(args.at(-1)).toBe(MERGE_OUTPUT_PATH);
  });

  it("inspects an input without rewriting it", () => {
    expect(buildInspectArgs(2)).toEqual(["--show-encryption", "in2.pdf"]);
  });

  it("never puts a reader's filename in argv", () => {
    // Scratch paths are what qpdf sees, so a file called "--encrypt" or "1-5"
    // cannot be read as an option or a page range. Every token is either a
    // qpdf option or an inN.pdf/out.pdf scratch path.
    for (const arg of buildMergeArgs(4)) {
      expect(arg).toMatch(
        /^(?:--(?:pages|decrypt|file=in\d+\.pdf)?|in\d+\.pdf|out\.pdf)$/,
      );
    }
  });
});

describe("pdf-merge: scratch name resolution", () => {
  const names = ["alpha.pdf", "beta.pdf"];

  it("substitutes the reader's filenames back into qpdf output", () => {
    expect(resolveScratchNames("in1.pdf: invalid password", names)).toBe(
      "beta.pdf: invalid password",
    );
  });

  it("does not let in1.pdf eat the prefix of in10.pdf", () => {
    const many = Array.from({ length: 11 }, (_, i) => `doc${i}.pdf`);
    expect(resolveScratchNames("in1.pdf and in10.pdf", many)).toBe(
      "doc1.pdf and doc10.pdf",
    );
  });

  it("leaves an index with no matching file untouched", () => {
    expect(resolveScratchNames("in7.pdf failed", names)).toBe("in7.pdf failed");
  });

  it("leaves output paths alone", () => {
    expect(resolveScratchNames("out.pdf written", names)).toBe(
      "out.pdf written",
    );
  });
});

describe("pdf-merge: identifying the file at fault", () => {
  it("reads the index out of a qpdf message", () => {
    expect(findOffendingIndex("qpdf: in2.pdf: invalid password")).toBe(2);
  });

  it("blames the file that failed, not one that merely warned", () => {
    const output = [
      "WARNING: in0.pdf: file is damaged",
      "qpdf: in2.pdf: invalid password",
    ].join("\n");
    expect(findOffendingIndex(output)).toBe(2);
  });

  it("falls back to a warning line when nothing else names a file", () => {
    expect(findOffendingIndex("WARNING: in1.pdf: something odd")).toBe(1);
  });

  it("returns null when qpdf named no input", () => {
    expect(findOffendingIndex("qpdf: out of memory")).toBeNull();
  });
});

describe("pdf-merge: qpdf error classification", () => {
  const names = ["alpha.pdf", "beta.pdf"];

  it("reports an encrypted input by name", () => {
    const result = classifyMergeError(
      "qpdf: in1.pdf: invalid password",
      2,
      names,
    );
    expect(result.code).toBe("encrypted");
    expect(result.fileName).toBe("beta.pdf");
    expect(result.message).toContain("beta.pdf");
    expect(result.message).toContain("password-protected");
  });

  it("reports a file that is not a PDF", () => {
    // A junk file produces both complaints; the header one is the real answer.
    const output = [
      "WARNING: in1.pdf: can't find PDF header",
      "qpdf: in1.pdf: can't find startxref",
    ].join("\n");
    const result = classifyMergeError(output, 2, names);
    expect(result.code).toBe("not-a-pdf");
    expect(result.fileName).toBe("beta.pdf");
  });

  it("reports a truncated file as damaged", () => {
    const result = classifyMergeError(
      "qpdf: in0.pdf: can't find startxref",
      2,
      names,
    );
    expect(result.code).toBe("damaged");
    expect(result.fileName).toBe("alpha.pdf");
  });

  it("resolves scratch names in the detail panel too", () => {
    const result = classifyMergeError(
      "qpdf: in0.pdf: can't find startxref",
      2,
      names,
    );
    expect(result.detail).toContain("alpha.pdf");
    expect(result.detail).not.toContain("in0.pdf");
  });

  it("does not name a file when qpdf did not", () => {
    const result = classifyMergeError("qpdf: out of memory", 2, names);
    expect(result.code).toBe("unknown");
    expect(result.fileName).toBeNull();
    expect(result.message).toBe("out of memory");
  });

  it("falls back to the exit code when there is no output at all", () => {
    const result = classifyMergeError("", 2, names);
    expect(result.message).toBe("qpdf exited with code 2.");
  });
});

describe("pdf-merge: worker response interpretation", () => {
  const names = ["alpha.pdf", "beta.pdf"];

  it("reports a worker that never started", () => {
    const result = interpretMergeResponse(
      response({ stage: "startup", exitCode: -1, bytes: null }),
      names,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("worker-failed");
  });

  it("classifies a failing exit code", () => {
    const result = interpretMergeResponse(
      response({
        exitCode: 2,
        output: "qpdf: in1.pdf: invalid password",
        bytes: null,
      }),
      names,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("encrypted");
  });

  it("treats exit code 3 as success, since qpdf warns on repairable files", () => {
    const result = interpretMergeResponse(
      response({ exitCode: 3, output: "WARNING: in0.pdf: repaired xref" }),
      names,
    );
    expect(result.ok).toBe(true);
  });

  it("keeps the reader's filename in a warning", () => {
    const result = interpretMergeResponse(
      response({ exitCode: 3, output: "WARNING: in0.pdf: repaired xref" }),
      names,
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.warnings).toEqual(["alpha.pdf: repaired xref"]);
  });

  it("rejects a successful run that produced nothing", () => {
    const result = interpretMergeResponse(
      response({ bytes: new ArrayBuffer(0) }),
      names,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });

  it("carries the page count through on success", () => {
    const result = interpretMergeResponse(response({ pageCount: 12 }), names);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pageCount).toBe(12);
      expect(result.bytes.length).toBeGreaterThan(0);
    }
  });

  it("accepts a missing page count rather than failing the merge", () => {
    const result = interpretMergeResponse(response({ pageCount: null }), names);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pageCount).toBeNull();
  });
});

describe("pdf-merge: selection validation", () => {
  const file = (name: string, size = 1024) => ({ name, size });

  it("passes a well-formed selection", () => {
    expect(validateSelection([file("a.pdf"), file("b.pdf")])).toBeNull();
  });

  it("rejects a single file, which would be a no-op", () => {
    const result = validateSelection([file("a.pdf")]);
    expect(result?.code).toBe("too-few-files");
  });

  it("rejects more files than the limit", () => {
    const many = Array.from({ length: MAX_MERGE_FILES + 1 }, (_, i) =>
      file(`f${i}.pdf`),
    );
    expect(validateSelection(many)?.code).toBe("too-many-files");
  });

  it("rejects an empty file and names it", () => {
    const result = validateSelection([file("a.pdf"), file("b.pdf", 0)]);
    expect(result?.code).toBe("empty-file");
    expect(result?.fileName).toBe("b.pdf");
  });

  it("rejects a file over the per-file limit", () => {
    const result = validateSelection([
      file("a.pdf"),
      file("huge.pdf", MAX_PDF_BYTES + 1),
    ]);
    expect(result?.code).toBe("file-too-large");
    expect(result?.fileName).toBe("huge.pdf");
  });

  it("rejects a selection over the combined limit", () => {
    const half = Math.ceil(MAX_TOTAL_MERGE_BYTES / 2);
    // Each file is under the per-file cap; only the total is too big.
    const result = validateSelection([
      file("a.pdf", Math.min(half, MAX_PDF_BYTES)),
      file("b.pdf", Math.min(half, MAX_PDF_BYTES)),
      file("c.pdf", MAX_PDF_BYTES),
    ]);
    expect(result?.code).toBe("total-too-large");
  });

  it("checks sizes without reading a byte of the files", () => {
    // The guard takes name and size only, so an oversized selection is
    // refused before it is allocated in page memory.
    expect(MIN_MERGE_FILES).toBe(2);
    expect(validateSelection([file("a.pdf"), file("b.pdf")])).toBeNull();
  });
});

describe("pdf-merge: byte validation", () => {
  it("accepts a buffer with a PDF header", () => {
    expect(validateBytes(pdfBytes(), "a.pdf")).toBeNull();
  });

  it("rejects a file that is not a PDF and names it", () => {
    const result = validateBytes(
      new TextEncoder().encode("not a pdf"),
      "notes.txt",
    );
    expect(result?.code).toBe("not-a-pdf");
    expect(result?.fileName).toBe("notes.txt");
    expect(result?.message).toContain("notes.txt");
  });
});

describe("pdf-merge: reordering", () => {
  const items = ["a", "b", "c"];

  it("moves an item up", () => {
    expect(moveItem(items, 1, 0)).toEqual(["b", "a", "c"]);
  });

  it("moves an item down", () => {
    expect(moveItem(items, 0, 1)).toEqual(["b", "a", "c"]);
  });

  it("moves across the whole list", () => {
    expect(moveItem(items, 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("treats the first row's up as a no-op", () => {
    expect(moveItem(items, 0, -1)).toEqual(items);
  });

  it("treats the last row's down as a no-op", () => {
    expect(moveItem(items, 2, 3)).toEqual(items);
  });

  it("does not mutate the original list", () => {
    const original = [...items];
    moveItem(items, 0, 2);
    expect(items).toEqual(original);
  });
});

describe("pdf-merge: encryption reporting", () => {
  it("treats qpdf's not-encrypted line as unprotected", () => {
    expect(isEncrypted("File is not encrypted")).toBe(false);
  });

  it("treats empty output as unprotected", () => {
    expect(isEncrypted("   ")).toBe(false);
  });

  it("detects a file that opens freely but restricts printing", () => {
    // Empty user password: it merges without ever prompting, yet --decrypt
    // still strips real restrictions from it.
    const output = [
      "R = 6",
      "P = -3376",
      "User password = ",
      "print high resolution: not allowed",
      "file encryption method: AESv3",
    ].join("\n");
    expect(isEncrypted(output)).toBe(true);
  });

  it("names the inputs whose restrictions were removed", () => {
    const result = interpretMergeResponse(response({ encryptedIndexes: [1] }), [
      "alpha.pdf",
      "beta.pdf",
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.decrypted).toEqual(["beta.pdf"]);
  });

  it("reports nothing removed when no input was protected", () => {
    const result = interpretMergeResponse(response(), ["a.pdf", "b.pdf"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.decrypted).toEqual([]);
  });

  it("ignores an index with no matching file", () => {
    const result = interpretMergeResponse(
      response({ encryptedIndexes: [0, 9] }),
      ["a.pdf", "b.pdf"],
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.decrypted).toEqual(["a.pdf"]);
  });
});

describe("pdf-merge: presentation helpers", () => {
  it("names the download after the first file", () => {
    expect(mergedFileName("report.pdf")).toBe("report-merged.pdf");
  });

  it("is case-insensitive about the extension", () => {
    expect(mergedFileName("Report.PDF")).toBe("Report-merged.pdf");
  });

  it("falls back when there is no first file", () => {
    expect(mergedFileName(undefined)).toBe("merged.pdf");
    expect(mergedFileName("   ")).toBe("merged.pdf");
  });

  it("summarises a merge", () => {
    expect(describeMerge(3, 12, 2048)).toBe("3 files · 12 pages · 2.0 KB");
  });

  it("singularises a one-page result", () => {
    expect(describeMerge(2, 1, 512)).toBe("2 files · 1 page · 512 B");
  });

  it("omits the page count when qpdf would not report it", () => {
    expect(describeMerge(2, null, 512)).toBe("2 files · 512 B");
  });
});
