import { describe, expect, it } from "vitest";
import { parseTimestamp } from "./timestamp";

describe("parseTimestamp", () => {
  it("reads bare numbers as seconds, or milliseconds past year 3000", () => {
    expect(parseTimestamp("1700000000")?.toISOString()).toBe(
      "2023-11-14T22:13:20.000Z",
    );
    expect(parseTimestamp("1700000000000")?.toISOString()).toBe(
      "2023-11-14T22:13:20.000Z",
    );
  });

  it("returns null for numbers outside the Date range", () => {
    expect(parseTimestamp("99999999999999999")).toBeNull();
    expect(parseTimestamp("9".repeat(400))).toBeNull();
  });
});
