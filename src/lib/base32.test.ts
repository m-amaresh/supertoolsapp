import { describe, expect, it } from "vitest";
import { decodeBase32, encodeBase32, isValidBase32 } from "./base32";

describe("base32", () => {
  it("encodes known RFC4648 vector", () => {
    expect(encodeBase32("foo")).toBe("MZXW6===");
  });

  it("round-trips with lowercase output", () => {
    const encoded = encodeBase32("hello", { lowercase: true });
    expect(encoded).toBe(encoded.toLowerCase());
    expect(decodeBase32(encoded)).toBe("hello");
  });

  it("supports hex input/output", () => {
    const encoded = encodeBase32("48656c6c6f", { inputEncoding: "hex" });
    expect(decodeBase32(encoded, { outputEncoding: "hex" })).toBe("48656c6c6f");
  });

  it("rejects invalid characters", () => {
    expect(() => decodeBase32("MZXW6===!")).toThrow(/Invalid Base32/);
    expect(isValidBase32("MZXW6===")).toBe(true);
    expect(isValidBase32("MZXW6===!")).toBe(false);
  });
});
