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

  it("decodes every RFC 4648 test vector, padded and unpadded", () => {
    const vectors: Array<[string, string]> = [
      ["f", "MY======"],
      ["fo", "MZXQ===="],
      ["foo", "MZXW6==="],
      ["foob", "MZXW6YQ="],
      ["fooba", "MZXW6YTB"],
      ["foobar", "MZXW6YTBOI======"],
    ];
    for (const [plain, encoded] of vectors) {
      expect(decodeBase32(encoded)).toBe(plain);
      expect(decodeBase32(encoded.replace(/=+$/, ""))).toBe(plain);
    }
  });

  it("rejects lengths, padding and trailing bits no encoder produces", () => {
    expect(() => decodeBase32("A")).toThrow(/length/);
    expect(() => decodeBase32("MZX")).toThrow(/length/);
    expect(() => decodeBase32("MY=====")).toThrow(/padding/);
    expect(() => decodeBase32("AB=CD")).toThrow();
    expect(() => decodeBase32("MZ")).toThrow(/trailing bits/);
    expect(isValidBase32("AB=CD")).toBe(false);
    expect(isValidBase32("A")).toBe(false);
    expect(isValidBase32("MZXW6YQ=")).toBe(true);
  });
});
