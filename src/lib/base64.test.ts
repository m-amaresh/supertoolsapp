import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64, isValidBase64 } from "./base64";

describe("base64", () => {
  it("round-trips utf8 text", () => {
    const input = "Hello, world ✓";
    const encoded = encodeBase64(input, { inputEncoding: "utf8" });
    expect(decodeBase64(encoded, { outputEncoding: "utf8" })).toBe(input);
  });

  it("supports url-safe variant", () => {
    const input = "hello+/=?";
    const encoded = encodeBase64(input, { variant: "url" });
    expect(encoded).not.toContain("=");
    expect(
      decodeBase64(encoded, { outputEncoding: "utf8", variant: "url" }),
    ).toBe(input);
  });

  it("encodes and decodes hex payloads", () => {
    const hex = "48656c6c6f";
    const encoded = encodeBase64(hex, { inputEncoding: "hex" });
    expect(decodeBase64(encoded, { outputEncoding: "hex" })).toBe(hex);
  });

  it("rejects latin1 out-of-range characters", () => {
    expect(() => encodeBase64("€", { inputEncoding: "latin1" })).toThrow(
      /Latin-1 range/,
    );
  });

  it("validates base64 format", () => {
    expect(isValidBase64("aGVsbG8=")).toBe(true);
    expect(isValidBase64("aGVsbG8*=")).toBe(false);
  });
});
