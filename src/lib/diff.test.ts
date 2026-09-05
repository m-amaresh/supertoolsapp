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
});
