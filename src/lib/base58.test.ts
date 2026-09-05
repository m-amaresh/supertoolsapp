import { describe, expect, it } from "vitest";
import {
  decodeBase58,
  decodeBase58CheckToBytes,
  decodeBase58ToBytes,
  encodeBase58,
  encodeBase58Bytes,
  encodeBase58CheckBytes,
} from "./base58";
import { bytesToText, textToBytes } from "./bytes";

describe("base58", () => {
  it("encodes and decodes standard base58 text", async () => {
    const encoded = await encodeBase58("hello world", {
      inputEncoding: "utf8",
      variant: "base58",
    });
    expect(encoded).toBe("StV1DL6CwTryKyV");

    const decoded = await decodeBase58(encoded, {
      outputEncoding: "utf8",
      variant: "base58",
    });
    expect(decoded).toBe("hello world");
  });

  it("preserves leading zero bytes", () => {
    const bytes = new Uint8Array([0, 0, 1, 2, 3]);
    const encoded = encodeBase58Bytes(bytes);
    const decoded = decodeBase58ToBytes(encoded);
    expect(decoded).toEqual(bytes);
  });

  it("encodes and decodes all-zero payloads correctly", () => {
    const oneZero = new Uint8Array([0]);
    const twoZeros = new Uint8Array([0, 0]);

    expect(encodeBase58Bytes(oneZero)).toBe("1");
    expect(encodeBase58Bytes(twoZeros)).toBe("11");
    expect(decodeBase58ToBytes("1")).toEqual(oneZero);
    expect(decodeBase58ToBytes("11")).toEqual(twoZeros);
  });

  it("encodes and verifies base58check payloads", async () => {
    const payload = textToBytes("00010203", "hex");
    const encoded = await encodeBase58CheckBytes(payload);
    const decoded = await decodeBase58CheckToBytes(encoded);
    expect(bytesToText(decoded, "hex")).toBe("00010203");
  });

  it("rejects invalid base58check checksum", async () => {
    const payload = new Uint8Array([0, 1, 2, 3]);
    const encoded = await encodeBase58CheckBytes(payload);
    const tampered = `${encoded.slice(0, -1)}1`;
    await expect(decodeBase58CheckToBytes(tampered)).rejects.toThrow(
      /checksum/,
    );
  });
});
