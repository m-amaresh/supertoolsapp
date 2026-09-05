import { describe, expect, it } from "vitest";
import { generateHash, generateHmac } from "./hash";

describe("hash", () => {
  it("matches known SHA-256 vector", async () => {
    await expect(generateHash("abc", "SHA-256")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("matches known MD5 and SHA3-256 vectors", async () => {
    await expect(generateHash("abc", "MD5")).resolves.toBe(
      "900150983cd24fb0d6963f7d28e17f72",
    );
    await expect(generateHash("abc", "SHA3-256")).resolves.toBe(
      "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532",
    );
  });

  it("matches known HMAC-SHA-256 vector", async () => {
    await expect(
      generateHmac(
        "The quick brown fox jumps over the lazy dog",
        "key",
        "SHA-256",
      ),
    ).resolves.toBe(
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    );
  });

  it("rejects unsupported HMAC-MD5", async () => {
    await expect(generateHmac("abc", "key", "MD5")).rejects.toThrow(
      /not supported/,
    );
  });

  it("rejects latin1 out-of-range characters", async () => {
    await expect(
      generateHash("€", "SHA-256", { inputEncoding: "latin1" }),
    ).rejects.toThrow(/Latin-1 range/);
  });
});
