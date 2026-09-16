import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

import {
  buildChunkArgs,
  buildExtractArgs,
  chunkFileName,
  compareChunkNames,
  parsePageRange,
  SPLIT_INPUT_PATH,
  SPLIT_OUTPUT_PATH,
} from "../../src/lib/pdf-split";
import { makePdf } from "./make-pdf";
import { readPageLabels } from "./read-pdf";

/**
 * Runs the split tool's argv and its page-range parser against the real qpdf.
 *
 * `parsePageRange` reimplements qpdf's range grammar so the page count shown
 * before a run is the one the run produces. A reimplementation that disagrees
 * with the engine is worse than none at all — it would report one selection
 * and deliver another — so the central test here feeds the *same spec* to both
 * and compares the pages that actually come out.
 *
 * Counting is not enough: a reversed or duplicated selection keeps the count
 * while getting every page wrong, so these compare page labels in order.
 *
 * This lives in the e2e suite rather than beside the unit tests because it
 * instantiates the 1.3 MB WASM engine. It needs no browser and no server.
 */

const require = createRequire(import.meta.url);

type Qpdf = {
  callMain: (args: string[]) => number;
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    readdir: (path: string) => string[];
  };
};

const succeeded = (code: number) => code === 0 || code === 3;

/**
 * A fresh engine per call.
 *
 * Emscripten's MEMFS persists across `callMain` invocations, so a shared
 * instance would let one case read files another case produced.
 */
async function loadQpdf(): Promise<{ qpdf: Qpdf; output: () => string }> {
  const initQpdf = require("@neslinesli93/qpdf-wasm");
  let captured: string[] = [];
  const realLog = console.log;
  const realError = console.error;
  console.log = (...args: unknown[]) => {
    captured.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    captured.push(args.map(String).join(" "));
  };
  try {
    const qpdf: Qpdf = await initQpdf({ noInitialRun: true });
    captured = [];
    return {
      qpdf,
      output: () => {
        const text = captured.join("\n");
        captured = [];
        return text;
      },
    };
  } finally {
    console.log = realLog;
    console.error = realError;
  }
}

const TOTAL_PAGES = 10;

/** Extract with the tool's own argv, and read back which pages arrived. */
async function extractWithTool(spec: string): Promise<string[]> {
  const parsed = parsePageRange(spec, TOTAL_PAGES);
  if (!parsed.ok)
    throw new Error(`parser rejected "${spec}": ${parsed.message}`);

  const { qpdf, output } = await loadQpdf();
  qpdf.FS.writeFile(
    SPLIT_INPUT_PATH,
    new Uint8Array(makePdf("P", TOTAL_PAGES)),
  );
  const code = qpdf.callMain(
    buildExtractArgs(parsed.pages, SPLIT_INPUT_PATH, SPLIT_OUTPUT_PATH),
  );
  if (!succeeded(code)) {
    throw new Error(`qpdf rejected the arguments (exit ${code}): ${output()}`);
  }
  return readPageLabels(Buffer.from(qpdf.FS.readFile(SPLIT_OUTPUT_PATH)));
}

/**
 * Pages in the document the tool's argv produces.
 *
 * Distinct from counting labels: a page asked for twice shares its content
 * stream with the first copy, so only the count tells the two apart.
 */
async function extractPageCount(spec: string): Promise<number> {
  const parsed = parsePageRange(spec, TOTAL_PAGES);
  if (!parsed.ok)
    throw new Error(`parser rejected "${spec}": ${parsed.message}`);

  const { qpdf, output } = await loadQpdf();
  qpdf.FS.writeFile(
    SPLIT_INPUT_PATH,
    new Uint8Array(makePdf("P", TOTAL_PAGES)),
  );
  const code = qpdf.callMain(
    buildExtractArgs(parsed.pages, SPLIT_INPUT_PATH, SPLIT_OUTPUT_PATH),
  );
  if (!succeeded(code)) {
    throw new Error(`qpdf rejected the arguments (exit ${code}): ${output()}`);
  }
  output();
  qpdf.callMain(["--show-npages", SPLIT_OUTPUT_PATH]);
  return Number(output().trim());
}

/** Extract by handing qpdf the reader's raw spec, as qpdf itself reads it. */
async function extractWithQpdf(
  spec: string,
): Promise<{ ok: boolean; labels: string[]; message: string }> {
  const { qpdf, output } = await loadQpdf();
  qpdf.FS.writeFile(
    SPLIT_INPUT_PATH,
    new Uint8Array(makePdf("P", TOTAL_PAGES)),
  );
  const code = qpdf.callMain([
    SPLIT_INPUT_PATH,
    "--pages",
    ".",
    spec.replace(/\s+/g, ""),
    "--",
    SPLIT_OUTPUT_PATH,
  ]);
  const text = output();
  if (!succeeded(code)) return { ok: false, labels: [], message: text };
  return {
    ok: true,
    labels: readPageLabels(Buffer.from(qpdf.FS.readFile(SPLIT_OUTPUT_PATH))),
    message: text,
  };
}

describe("pdf-split engine: the parser agrees with qpdf", () => {
  // Every shape of the grammar the tool claims to support.
  const specs = [
    "1-3",
    "1,3,5",
    "5",
    "z",
    "8-z",
    "r1",
    "r3-z",
    "6-2",
    "1,1,2",
    "1-3,3-5",
    "2-4,1",
    "1-z,x2-3",
    "1-6,x2,x5",
    "z-1",
    "1-z",
  ];

  it.each(specs)("resolves %s to the same pages qpdf selects", async (spec) => {
    const viaQpdf = await extractWithQpdf(spec);
    expect(viaQpdf.ok, `qpdf rejected "${spec}": ${viaQpdf.message}`).toBe(
      true,
    );

    const viaTool = await extractWithTool(spec);
    expect(viaTool).toEqual(viaQpdf.labels);
  });
});

describe("pdf-split engine: selections the parser rejects", () => {
  // qpdf refuses these too. The parser stops them earlier and with a better
  // sentence, but it must not be *more* permissive than the engine.
  const specs = ["0", "11", "x1-2", "1-2-3", "abc", "r11"];

  it.each(specs)("qpdf also rejects %s", async (spec) => {
    expect(parsePageRange(spec, TOTAL_PAGES).ok).toBe(false);
    const viaQpdf = await extractWithQpdf(spec);
    expect(viaQpdf.ok).toBe(false);
  });
});

describe("pdf-split engine: extraction", () => {
  it("pulls a contiguous range in order", async () => {
    expect(await extractWithTool("2-4")).toEqual(["P2", "P3", "P4"]);
  });

  it("pulls a reversed range in reverse", async () => {
    expect(await extractWithTool("4-2")).toEqual(["P4", "P3", "P2"]);
  });

  it("repeats a page asked for twice", async () => {
    // qpdf points both page objects at one shared content stream, so the
    // label shows up once while the document genuinely has three pages.
    // The count is the thing under test here; see read-pdf.ts.
    expect(await extractPageCount("1,1,3")).toBe(3);
    expect(await extractWithTool("1,1,3")).toEqual(["P1", "P3"]);
  });

  it("honours an exclusion", async () => {
    expect(await extractWithTool("1-5,x2-3")).toEqual(["P1", "P4", "P5"]);
  });

  it("resolves z and rN against the real document length", async () => {
    expect(await extractWithTool("r2-z")).toEqual(["P9", "P10"]);
  });
});

describe("pdf-split engine: chunking", () => {
  /** Split a document and return the produced files, ordered as the UI shows them. */
  async function chunk(
    pages: number,
    size: number,
  ): Promise<{ name: string; labels: string[] }[]> {
    const { qpdf, output } = await loadQpdf();
    qpdf.FS.writeFile(SPLIT_INPUT_PATH, new Uint8Array(makePdf("P", pages)));
    const before = new Set(qpdf.FS.readdir("/"));

    const code = qpdf.callMain(
      buildChunkArgs(size, SPLIT_INPUT_PATH, SPLIT_OUTPUT_PATH),
    );
    if (!succeeded(code)) {
      throw new Error(
        `qpdf rejected the arguments (exit ${code}): ${output()}`,
      );
    }

    return qpdf.FS.readdir("/")
      .filter((name) => !before.has(name) && /\.pdf$/i.test(name))
      .sort(compareChunkNames)
      .map((name) => ({
        name,
        labels: readPageLabels(Buffer.from(qpdf.FS.readFile(name))),
      }));
  }

  it("cuts a 10-page document into 5 pieces of 2", async () => {
    const pieces = await chunk(10, 2);
    expect(pieces).toHaveLength(5);
    expect(pieces.map((p) => p.labels)).toEqual([
      ["P1", "P2"],
      ["P3", "P4"],
      ["P5", "P6"],
      ["P7", "P8"],
      ["P9", "P10"],
    ]);
  });

  it("leaves a short final piece rather than padding it", async () => {
    const pieces = await chunk(7, 3);
    expect(pieces.map((p) => p.labels.length)).toEqual([3, 3, 1]);
    expect(pieces[2].labels).toEqual(["P7"]);
  });

  it("produces one file per page at size 1", async () => {
    const pieces = await chunk(3, 1);
    expect(pieces.map((p) => p.labels)).toEqual([["P1"], ["P2"], ["P3"]]);
  });

  it("names pieces the way chunkFileName expects", async () => {
    // The mapping onto the reader's filename is a regex over qpdf's output.
    // If qpdf ever changes its naming, this is where it surfaces.
    const pieces = await chunk(10, 2);
    for (const piece of pieces) {
      expect(chunkFileName(piece.name, "report.pdf")).not.toBeNull();
    }
    expect(chunkFileName(pieces[0].name, "report.pdf")).toBe(
      "report-01-02.pdf",
    );
  });

  it("uses unpadded names below ten pages, which the UI sorts numerically", async () => {
    const pieces = await chunk(3, 1);
    expect(pieces.map((p) => p.name)).toEqual([
      "out-1.pdf",
      "out-2.pdf",
      "out-3.pdf",
    ]);
  });
});
