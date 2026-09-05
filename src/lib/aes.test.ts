import { describe, expect, it } from "vitest";
import {
  bytesToText,
  decryptPayloadAesGcm,
  encryptBytesAesGcm,
  parseAesPayload,
  serializeAesPayload,
  textToBytes,
} from "./aes";

describe("aes", () => {
  it("round-trips encrypted payload", async () => {
    const plaintext = textToBytes("supertools secret", "utf8");
    const payload = await encryptBytesAesGcm(plaintext, "passphrase", {
      iterations: 100_000,
      name: "test.txt",
      type: "text/plain",
    });

    const decrypted = await decryptPayloadAesGcm(payload, "passphrase");
    expect(bytesToText(decrypted, "utf8")).toBe("supertools secret");
  });

  it("fails with wrong passphrase", async () => {
    const payload = await encryptBytesAesGcm(
      textToBytes("data", "utf8"),
      "correct",
      { iterations: 100_000 },
    );
    await expect(decryptPayloadAesGcm(payload, "wrong")).rejects.toThrow(
      /Decryption failed/,
    );
  });

  it("serializes and parses payload", async () => {
    const payload = await encryptBytesAesGcm(textToBytes("abc", "utf8"), "pw", {
      iterations: 100_000,
    });

    const serialized = serializeAesPayload(payload);
    const parsed = parseAesPayload(serialized);

    expect(parsed.v).toBe(1);
    expect(parsed.alg).toBe("A256GCM");
    expect(parsed.kdf).toBe("PBKDF2-SHA256");
    expect(parsed.ct.length).toBeGreaterThan(0);
  });

  it("rejects latin1 out-of-range characters", () => {
    expect(() => textToBytes("€", "latin1")).toThrow(/Latin-1 range/);
  });

  it("rejects malformed serialized payload", () => {
    expect(() => parseAesPayload("not-a-payload")).toThrow(
      /Invalid encrypted payload format/,
    );
  });
});
