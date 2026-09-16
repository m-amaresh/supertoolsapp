import { describe, expect, it } from "vitest";
import {
  archiveFileName,
  buildChunkArgs,
  buildCountArgs,
  buildExtractArgs,
  chunkCount,
  chunkFileName,
  classifyQpdfError,
  compareChunkNames,
  declaresEncryption,
  describeResult,
  extractedFileName,
  fileStem,
  interpretWorkerResponse,
  isNotEncrypted,
  MAX_CHUNK_SIZE,
  MAX_PDF_BYTES,
  MAX_SPLIT_OUTPUTS,
  type PdfSplitWorkerResponse,
  parsePageCount,
  parsePageRange,
  SPLIT_INPUT_PATH,
  SPLIT_OUTPUT_PATH,
  summarizePages,
  validateChunkSize,
  validateRequest,
  validateRequestMetadata,
} from "./pdf-split";

const pdfBytes = (body = "") =>
  new TextEncoder().encode(`%PDF-1.7\n${body}`) as Uint8Array;

/** Unwrap a successful parse, failing loudly rather than returning undefined. */
const pagesOf = (spec: string, total: number): number[] => {
  const result = parsePageRange(spec, total);
  if (!result.ok)
    throw new Error(`expected "${spec}" to parse: ${result.message}`);
  return result.pages;
};

describe("pdf-split: page range parsing", () => {
  it("reads a single page", () => {
    expect(pagesOf("5", 10)).toEqual([5]);
  });

  it("reads an ascending run", () => {
    expect(pagesOf("2-6", 10)).toEqual([2, 3, 4, 5, 6]);
  });

  it("keeps a descending run in the order given", () => {
    expect(pagesOf("6-2", 10)).toEqual([6, 5, 4, 3, 2]);
  });

  it("reads a comma list", () => {
    expect(pagesOf("1,3,5", 10)).toEqual([1, 3, 5]);
  });

  it("tolerates whitespace anywhere", () => {
    expect(pagesOf(" 1-3 , 8 ", 10)).toEqual([1, 2, 3, 8]);
  });

  it("resolves z to the last page", () => {
    expect(pagesOf("z", 10)).toEqual([10]);
    expect(pagesOf("8-z", 10)).toEqual([8, 9, 10]);
  });

  it("resolves rN counting back from the end", () => {
    expect(pagesOf("r1", 10)).toEqual([10]);
    expect(pagesOf("r3-z", 10)).toEqual([8, 9, 10]);
  });

  it("does not de-duplicate, matching qpdf", () => {
    // Verified against qpdf 12.2.0: "1,1,2" really does produce three pages.
    expect(pagesOf("1,1,2", 10)).toEqual([1, 1, 2]);
    expect(pagesOf("1-3,3-5", 10)).toEqual([1, 2, 3, 3, 4, 5]);
  });

  it("does not sort, matching qpdf", () => {
    expect(pagesOf("2-4,1", 10)).toEqual([2, 3, 4, 1]);
  });

  it("applies an exclusion to what came before it", () => {
    expect(pagesOf("1-z,x2-3", 5)).toEqual([1, 4, 5]);
  });

  it("applies several exclusions in order", () => {
    expect(pagesOf("1-6,x2,x5", 6)).toEqual([1, 3, 4, 6]);
  });

  it("rejects a leading exclusion, as qpdf does", () => {
    const result = parsePageRange("x1-2", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("bad-range");
      expect(result.message).toContain("cannot start with an exclusion");
    }
  });

  it("rejects page 0", () => {
    const result = parsePageRange("0", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("numbered from 1");
  });

  it("rejects a page past the end and says how long the document is", () => {
    const result = parsePageRange("11", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("10 pages");
      expect(result.message).toContain("page 11 does not exist");
    }
  });

  it("rejects an rN that counts back past the start", () => {
    const result = parsePageRange("r11", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("past the start");
  });

  it("rejects an empty spec", () => {
    const result = parsePageRange("   ", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("no-selection");
  });

  it("rejects a stray comma", () => {
    const result = parsePageRange("1,,3", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("stray comma");
  });

  it("rejects a three-part range", () => {
    const result = parsePageRange("1-2-3", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("not a page range");
  });

  it("rejects non-numeric junk", () => {
    const result = parsePageRange("abc", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("not a page number");
  });

  it("reports a selection that excludes everything it includes", () => {
    const result = parsePageRange("1-3,x1-3", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("no-selection");
  });

  it("handles a single-page document", () => {
    expect(pagesOf("z", 1)).toEqual([1]);
    expect(pagesOf("1", 1)).toEqual([1]);
    const result = parsePageRange("2", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("1 page,");
  });

  it("refuses to work against a document with no pages", () => {
    const result = parsePageRange("1", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("no pages");
  });
});

describe("pdf-split: chunk sizing", () => {
  it("counts chunks with a remainder", () => {
    expect(chunkCount(10, 3)).toBe(4);
    expect(chunkCount(10, 5)).toBe(2);
    expect(chunkCount(1, 1)).toBe(1);
  });

  it("returns nothing for nonsense input", () => {
    expect(chunkCount(0, 5)).toBe(0);
    expect(chunkCount(10, 0)).toBe(0);
  });

  it("accepts a sane size", () => {
    expect(validateChunkSize(5, 100)).toBeNull();
  });

  it("rejects a non-integer or zero size", () => {
    expect(validateChunkSize(0, 10)?.code).toBe("bad-chunk-size");
    expect(validateChunkSize(1.5, 10)?.code).toBe("bad-chunk-size");
    expect(validateChunkSize(-2, 10)?.code).toBe("bad-chunk-size");
  });

  it("rejects a size past the ceiling", () => {
    expect(validateChunkSize(MAX_CHUNK_SIZE + 1, 10)?.code).toBe(
      "bad-chunk-size",
    );
  });

  it("refuses a split that would produce too many files, and says the minimum", () => {
    const failure = validateChunkSize(1, MAX_SPLIT_OUTPUTS * 3);
    expect(failure?.code).toBe("too-many-outputs");
    expect(failure?.message).toContain("at least 3 pages per file");
  });

  it("allows exactly the cap", () => {
    expect(validateChunkSize(1, MAX_SPLIT_OUTPUTS)).toBeNull();
  });
});

describe("pdf-split: qpdf argument construction", () => {
  it("passes resolved page numbers, not the reader's spec", () => {
    const args = buildExtractArgs(
      [1, 2, 5],
      SPLIT_INPUT_PATH,
      SPLIT_OUTPUT_PATH,
    );
    expect(args).toEqual(["in.pdf", "--pages", ".", "1,2,5", "--", "out.pdf"]);
  });

  it("preserves page order in the argument", () => {
    const args = buildExtractArgs(
      [3, 1, 2],
      SPLIT_INPUT_PATH,
      SPLIT_OUTPUT_PATH,
    );
    expect(args).toContain("3,1,2");
  });

  it("builds the chunk arguments", () => {
    expect(buildChunkArgs(2, SPLIT_INPUT_PATH, SPLIT_OUTPUT_PATH)).toEqual([
      "--split-pages=2",
      "in.pdf",
      "out.pdf",
    ]);
  });

  it("builds the count arguments", () => {
    expect(buildCountArgs(SPLIT_INPUT_PATH)).toEqual([
      "--show-npages",
      "in.pdf",
    ]);
  });

  it("never puts a reader filename in argv", () => {
    const args = [
      ...buildExtractArgs([1], SPLIT_INPUT_PATH, SPLIT_OUTPUT_PATH),
      ...buildChunkArgs(1, SPLIT_INPUT_PATH, SPLIT_OUTPUT_PATH),
    ];
    expect(args.every((arg) => !arg.includes("report"))).toBe(true);
  });
});

describe("pdf-split: output naming", () => {
  it("strips the extension case-insensitively", () => {
    expect(fileStem("Report.PDF")).toBe("Report");
    expect(fileStem("report")).toBe("report");
    expect(fileStem("  ")).toBe("document");
  });

  it("puts a simple range in the extracted name", () => {
    expect(extractedFileName("report.pdf", "1-5")).toBe("report-pages-1-5.pdf");
  });

  it("replaces separators in a list", () => {
    expect(extractedFileName("report.pdf", "1,3,5")).toBe(
      "report-pages-1_3_5.pdf",
    );
  });

  it("keeps a spec that is exactly at the length limit", () => {
    // Sanitises to "1-5_8-12_15-20_25-30", 20 characters.
    expect(extractedFileName("report.pdf", "1-5,8-12,15-20,25-30")).toBe(
      "report-pages-1-5_8-12_15-20_25-30.pdf",
    );
  });

  it("falls back for a spec too long to be a filename", () => {
    // One character more than the case above.
    expect(extractedFileName("report.pdf", "1-5,8-12,15-20,25-300")).toBe(
      "report-pages.pdf",
    );
  });

  it("falls back when the spec had inner whitespace", () => {
    // "1-5, 8" and "1-5,8" would otherwise produce different filenames for
    // the same selection.
    expect(extractedFileName("report.pdf", "1-5, 8")).toBe("report-pages.pdf");
  });

  it("maps a qpdf chunk name onto the reader's filename", () => {
    expect(chunkFileName("out-01-02.pdf", "report.pdf")).toBe(
      "report-01-02.pdf",
    );
    expect(chunkFileName("out-7.pdf", "My Report.pdf")).toBe("My Report-7.pdf");
  });

  it("returns null for a name that is not qpdf's", () => {
    expect(chunkFileName("something-else.pdf", "report.pdf")).toBeNull();
    expect(chunkFileName("out.pdf", "report.pdf")).toBeNull();
  });

  it("names the archive", () => {
    expect(archiveFileName("report.pdf")).toBe("report-split.zip");
  });
});

describe("pdf-split: chunk ordering", () => {
  it("sorts by the leading page number, not by string", () => {
    const names = ["out-10.pdf", "out-9.pdf", "out-1.pdf"];
    expect([...names].sort(compareChunkNames)).toEqual([
      "out-1.pdf",
      "out-9.pdf",
      "out-10.pdf",
    ]);
  });

  it("keeps zero-padded names in order too", () => {
    const names = ["out-03-04.pdf", "out-01-02.pdf", "out-05-06.pdf"];
    expect([...names].sort(compareChunkNames)).toEqual([
      "out-01-02.pdf",
      "out-03-04.pdf",
      "out-05-06.pdf",
    ]);
  });
});

describe("pdf-split: qpdf output parsing", () => {
  it("reads a page count", () => {
    expect(parsePageCount(" 12 \n")).toBe(12);
  });

  it("returns null for anything else", () => {
    expect(parsePageCount("twelve")).toBeNull();
    expect(parsePageCount("")).toBeNull();
  });

  it("recognises an unencrypted report", () => {
    expect(isNotEncrypted("File is not encrypted")).toBe(true);
    expect(isNotEncrypted("R = 6")).toBe(false);
  });
});

describe("pdf-split: qpdf error classification", () => {
  it("reads an invalid password as a protected input", () => {
    const result = classifyQpdfError("in.pdf: invalid password", 2);
    expect(result.code).toBe("encrypted");
    expect(result.message).toContain("PDF Password Remover");
  });

  it("reads an out-of-range complaint as a bad selection", () => {
    expect(classifyQpdfError("number 11 out of range", 2).code).toBe(
      "bad-range",
    );
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

  it("falls back to the first line", () => {
    expect(classifyQpdfError("qpdf: something odd", 2).message).toBe(
      "something odd",
    );
  });

  it("falls back to the exit code with no output", () => {
    expect(classifyQpdfError("  ", 9).message).toBe("qpdf exited with code 9.");
  });
});

describe("pdf-split: worker response interpretation", () => {
  const bytesOf = (...values: number[]) => new Uint8Array(values).buffer;

  const response = (
    overrides: Partial<PdfSplitWorkerResponse> = {},
  ): PdfSplitWorkerResponse => ({
    stage: "split",
    exitCode: 0,
    output: "",
    pageCount: 10,
    files: [{ name: "out.pdf", bytes: bytesOf(1, 2, 3) }],
    ...overrides,
  });

  it("reports a startup failure as an engine problem", () => {
    const result = interpretWorkerResponse(
      response({ stage: "startup", exitCode: -1, files: [] }),
      "report.pdf",
      "extract",
      "1",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("worker-failed");
  });

  it("refuses a protected document rather than silently unprotecting it", () => {
    const result = interpretWorkerResponse(
      response({ stage: "inspect", exitCode: 0, output: "R = 6", files: [] }),
      "report.pdf",
      "chunks",
      "",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("encrypted");
      expect(result.message).toContain("every piece");
    }
  });

  it("reports an unreadable page count", () => {
    const result = interpretWorkerResponse(
      response({ stage: "count", exitCode: 0, pageCount: null, files: [] }),
      "report.pdf",
      "extract",
      "1",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown-page-count");
  });

  it("names an extracted selection after the spec", () => {
    const result = interpretWorkerResponse(
      response(),
      "report.pdf",
      "extract",
      "1-5",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pieces).toHaveLength(1);
      expect(result.pieces[0].name).toBe("report-pages-1-5.pdf");
      expect(Array.from(result.pieces[0].bytes)).toEqual([1, 2, 3]);
    }
  });

  it("renames and orders chunk output", () => {
    const result = interpretWorkerResponse(
      response({
        files: [
          { name: "out-03-04.pdf", bytes: bytesOf(3) },
          { name: "out-01-02.pdf", bytes: bytesOf(1) },
        ],
      }),
      "report.pdf",
      "chunks",
      "",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pieces.map((p) => p.name)).toEqual([
        "report-01-02.pdf",
        "report-03-04.pdf",
      ]);
      expect(Array.from(result.pieces[0].bytes)).toEqual([1]);
    }
  });

  it("keeps an unexpected qpdf name rather than dropping the file", () => {
    const result = interpretWorkerResponse(
      response({ files: [{ name: "surprise.pdf", bytes: bytesOf(9) }] }),
      "report.pdf",
      "chunks",
      "",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.pieces[0].name).toBe("surprise.pdf");
  });

  it("fails when the split produced nothing", () => {
    const result = interpretWorkerResponse(
      response({ files: [] }),
      "report.pdf",
      "chunks",
      "",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unknown");
  });

  it("accepts exit code 3 and surfaces the warning", () => {
    const result = interpretWorkerResponse(
      response({
        exitCode: 3,
        output: "in.pdf: WARNING: file had an invalid cross-reference table",
      }),
      "report.pdf",
      "extract",
      "1",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([
        "file had an invalid cross-reference table",
      ]);
    }
  });

  it("redacts secrets qpdf may have printed", () => {
    const result = interpretWorkerResponse(
      response({
        stage: "inspect",
        exitCode: 0,
        output: "R = 6\nuser password = letmein",
        files: [],
      }),
      "report.pdf",
      "chunks",
      "",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.detail).not.toContain("letmein");
      expect(result.detail).toContain("[hidden]");
    }
  });
});

describe("pdf-split: validation", () => {
  it("accepts a reasonable file", () => {
    expect(validateRequestMetadata(1024)).toBeNull();
    expect(validateRequest(pdfBytes())).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(validateRequestMetadata(0)?.code).toBe("empty-file");
    expect(validateRequest(new Uint8Array(0))?.code).toBe("empty-file");
  });

  it("rejects an oversized file before it is read", () => {
    expect(validateRequestMetadata(MAX_PDF_BYTES + 1)?.code).toBe("too-large");
  });

  it("rejects a file that is not a PDF", () => {
    const bytes = new TextEncoder().encode("just some text");
    expect(validateRequest(bytes)?.code).toBe("not-a-pdf");
  });
});

describe("pdf-split: presentation helpers", () => {
  it("describes one file in the singular", () => {
    expect(describeResult(1)).toBe("1 PDF ready to download.");
  });

  it("describes several in the plural", () => {
    expect(describeResult(2)).toBe("2 PDFs ready to download.");
  });
});

describe("pdf-split: page summaries", () => {
  it("lists a short selection", () => {
    expect(summarizePages([2, 3, 4])).toBe("2, 3, 4");
  });

  it("keeps the order rather than sorting", () => {
    expect(summarizePages([4, 3, 2])).toBe("4, 3, 2");
  });

  it("shows repeats, because the document really has them twice", () => {
    expect(summarizePages([1, 1, 3])).toBe("1, 1, 3");
  });

  it("lists exactly at the limit", () => {
    const pages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(summarizePages(pages)).toBe("1, 2, 3, 4, 5, 6, 7, 8, 9, 10");
  });

  it("gives up past the limit, where a list is noise", () => {
    expect(summarizePages([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])).toBeNull();
  });

  it("returns nothing for an empty selection", () => {
    expect(summarizePages([])).toBeNull();
  });
});

describe("pdf-split: fast encryption detection", () => {
  const bytes = (text: string) => new TextEncoder().encode(text) as Uint8Array;

  it("spots an encrypted trailer", () => {
    expect(
      declaresEncryption(bytes("trailer<</Size 8/Root 1 0 R/Encrypt 7 0 R>>")),
    ).toBe(true);
  });

  it("tolerates the whitespace qpdf writes", () => {
    expect(declaresEncryption(bytes("/Encrypt   12   0   R"))).toBe(true);
  });

  it("says no for an ordinary trailer", () => {
    expect(declaresEncryption(bytes("trailer<</Size 8/Root 1 0 R>>"))).toBe(
      false,
    );
  });

  it("does not fire on the bare word, which appears in innocent places", () => {
    // A bookmark title or an uncompressed content stream may well say this.
    expect(declaresEncryption(bytes("(How to /Encrypt a PDF) Tj"))).toBe(false);
    expect(declaresEncryption(bytes("/EncryptMetadata false"))).toBe(false);
  });

  it("says no for an empty chunk", () => {
    expect(declaresEncryption(new Uint8Array(0))).toBe(false);
  });
});
