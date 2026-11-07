import { describe, expect, it } from "vitest";
import { computeDiff, getDiffStats } from "./diff";

describe("diff", () => {
  it("returns equal lines for identical inputs", () => {
    const lines = computeDiff("a\nb", "a\nb", {
      ignoreWhitespace: false,
      ignoreCase: false,
      trimLines: false,
    });

    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.type === "equal")).toBe(true);
    expect(getDiffStats(lines)).toEqual({ added: 0, removed: 0, unchanged: 2 });
  });

  it("detects additions and removals", () => {
    const lines = computeDiff("a\nb", "a\nc", {
      ignoreWhitespace: false,
      ignoreCase: false,
      trimLines: false,
    });

    const stats = getDiffStats(lines);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(1);
    expect(stats.unchanged).toBe(1);
  });

  it("respects normalization options", () => {
    const lines = computeDiff("Hello   ", " hello", {
      ignoreWhitespace: true,
      ignoreCase: true,
      trimLines: true,
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].type).toBe("equal");
  });

  it("treats CRLF, CR and LF line endings alike", () => {
    const options = {
      ignoreWhitespace: false,
      ignoreCase: false,
      trimLines: false,
    };
    const lines = computeDiff("a\r\nb\r\nc", "a\nb\rc", options);
    expect(lines.every((line) => line.type === "equal")).toBe(true);
    expect(lines.map((line) => line.text)).toEqual(["a", "b", "c"]);
  });

  it("diffs inputs at the line limit", () => {
    const options = {
      ignoreWhitespace: false,
      ignoreCase: false,
      trimLines: false,
    };
    const left = Array.from({ length: 3000 }, (_, i) => `line ${i}`);
    const right = left.filter((_, i) => i % 3 !== 0);
    const stats = getDiffStats(
      computeDiff(left.join("\n"), right.join("\n"), options),
    );
    expect(stats).toEqual({ added: 0, removed: 1000, unchanged: 2000 });
  });
});
