import { describe, expect, it } from "vitest";
import { convertDelimitedToJson, convertJsonToDelimited } from "./csv";

describe("csv", () => {
  it("converts CSV with headers to JSON objects", () => {
    const input = 'name,role\n"Alice","Developer"\n"Bob","QA"';
    const output = convertDelimitedToJson(input, {
      format: "csv",
      hasHeader: true,
      indent: 2,
    });

    expect(JSON.parse(output)).toEqual([
      { name: "Alice", role: "Developer" },
      { name: "Bob", role: "QA" },
    ]);
  });

  it("handles escaped quotes and embedded newlines", () => {
    const input = 'name,note\n"Alice","Line 1\nLine ""2"""';
    const output = convertDelimitedToJson(input, {
      format: "csv",
      hasHeader: true,
      indent: 2,
    });

    expect(JSON.parse(output)).toEqual([
      { name: "Alice", note: 'Line 1\nLine "2"' },
    ]);
  });

  it("rejects malformed quote usage", () => {
    expect(() =>
      convertDelimitedToJson('name\nA"B"C', {
        format: "csv",
        hasHeader: false,
        indent: 2,
      }),
    ).toThrow(/quote/i);
  });

  it("converts JSON objects to TSV with header", () => {
    const json = JSON.stringify([
      { name: "Alice", score: 10 },
      { name: "Bob", score: 20 },
    ]);

    const output = convertJsonToDelimited(json, {
      format: "tsv",
      includeHeader: true,
    });

    expect(output).toBe("name\tscore\nAlice\t10\nBob\t20");
  });

  it("converts JSON arrays to CSV rows", () => {
    const json = JSON.stringify([
      ["name", "score"],
      ["Alice", 10],
    ]);

    const output = convertJsonToDelimited(json, {
      format: "csv",
      includeHeader: false,
    });

    expect(output).toBe("name,score\nAlice,10");
  });
});
