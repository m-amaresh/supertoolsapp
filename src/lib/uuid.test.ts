import { describe, expect, it } from "vitest";
import { formatUuid, generateBulkUuids, generateUuid } from "./uuid";

describe("uuid", () => {
  it("generates v4 uuid format", () => {
    const uuid = generateUuid();
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("formats uuid with options", () => {
    const base = "123e4567-e89b-42d3-a456-426614174000";
    expect(
      formatUuid(base, { uppercase: true, hyphens: true, braces: false }),
    ).toBe("123E4567-E89B-42D3-A456-426614174000");
    expect(
      formatUuid(base, { uppercase: false, hyphens: false, braces: true }),
    ).toBe("{123e4567e89b42d3a456426614174000}");
  });

  it("clamps bulk generation count", () => {
    const many = generateBulkUuids(5000, {
      uppercase: false,
      hyphens: true,
      braces: false,
    });
    expect(many).toHaveLength(1000);
  });

  it("produces unique values in a batch", () => {
    const batch = generateBulkUuids(100, {
      uppercase: false,
      hyphens: true,
      braces: false,
    });
    expect(new Set(batch).size).toBe(100);
  });
});
