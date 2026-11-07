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

    expect(parsed.v).toBe(2);
    expect(parsed.alg).toBe("A256GCM");
    expect(parsed.kdf).toBe("PBKDF2-SHA256");
    expect(parsed.ct.length).toBeGreaterThan(0);
  });

  it.each([
    ["name", { name: "report.html" }],
    ["type", { type: "text/html" }],
    ["removed name", { name: undefined }],
    ["downgrade to v1", { v: 1 as const }],
  ])("fails when the %s is changed", async (_label, change) => {
    const payload = await encryptBytesAesGcm(textToBytes("pdf", "utf8"), "pw", {
      iterations: 100_000,
      name: "report.pdf",
      type: "application/pdf",
    });
    await expect(
      decryptPayloadAesGcm({ ...payload, ...change }, "pw"),
    ).rejects.toThrow(/Decryption failed/);
  });

  it("still decrypts legacy v1 payloads without additional data", async () => {
    const salt = new Uint8Array(16).fill(1);
    const iv = new Uint8Array(12).fill(2);
    const base = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode("pw"),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
      base,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode("legacy"),
    );
    const b64url = (bytes: Uint8Array) =>
      Buffer.from(bytes).toString("base64url");
    const payload = parseAesPayload(
      JSON.stringify({
        v: 1,
        alg: "A256GCM",
        kdf: "PBKDF2-SHA256",
        it: 100_000,
        salt: b64url(salt),
        iv: b64url(iv),
        ct: b64url(new Uint8Array(ct)),
        name: "old.txt",
      }),
    );
    const decrypted = await decryptPayloadAesGcm(payload, "pw");
    expect(bytesToText(decrypted, "utf8")).toBe("legacy");
  });

  it("omits over-long metadata so the payload still round-trips", async () => {
    const payload = await encryptBytesAesGcm(textToBytes("x", "utf8"), "pw", {
      iterations: 100_000,
      name: "a".repeat(600),
    });
    expect(payload.name).toBeUndefined();
    const parsed = parseAesPayload(serializeAesPayload(payload));
    await expect(decryptPayloadAesGcm(parsed, "pw")).resolves.toBeDefined();
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
