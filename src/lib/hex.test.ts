import { describe, expect, it } from "vitest";
import { decodeHex, encodeHex, isValidHex } from "./hex";

describe("hex", () => {
  it("encodes and decodes utf8 text", () => {
    expect(encodeHex("Hello")).toBe("48656c6c6f");
    expect(decodeHex("48656c6c6f")).toBe("Hello");
  });

  it("supports latin1 round-trip", () => {
    const text = "éñ";
    const encoded = encodeHex(text, { inputEncoding: "latin1" });
    expect(decodeHex(encoded, { outputEncoding: "latin1" })).toBe(text);
  });

  it("validates and rejects malformed input", () => {
    expect(isValidHex("00ffAA")).toBe(true);
    expect(isValidHex("00ffA")).toBe(false);
    expect(() => decodeHex("abc")).toThrow(/length must be even/);
    expect(() => decodeHex("zz")).toThrow(/invalid characters/);
  });

  it("rejects latin1 out-of-range characters", () => {
    expect(() => encodeHex("€", { inputEncoding: "latin1" })).toThrow(
      /Latin-1 range/,
    );
  });
});
