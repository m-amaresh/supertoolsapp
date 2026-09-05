import { describe, expect, it } from "vitest";
import { bytesToBase64 } from "./bytes";
import { signRsaSha256, verifyRsaSha256 } from "./rsa";

function derToPem(label: string, der: Uint8Array): string {
  const b64 = bytesToBase64(der);
  const lines = b64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

describe("rsa", () => {
  it("signs and verifies with generated RSA keypair", async () => {
    const subtle = globalThis.crypto.subtle;
    const keyPair = await subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );

    const pkcs8 = new Uint8Array(
      await subtle.exportKey("pkcs8", keyPair.privateKey),
    );
    const spki = new Uint8Array(
      await subtle.exportKey("spki", keyPair.publicKey),
    );

    const privatePem = derToPem("PRIVATE KEY", pkcs8);
    const publicPem = derToPem("PUBLIC KEY", spki);

    const message = "supertools rsa test";
    const signature = await signRsaSha256(message, privatePem, {
      messageEncoding: "utf8",
      signatureEncoding: "base64",
    });

    const ok = await verifyRsaSha256(message, signature, publicPem, {
      messageEncoding: "utf8",
      signatureEncoding: "base64",
    });

    expect(ok).toBe(true);
  });

  it("fails verification when message is modified", async () => {
    const subtle = globalThis.crypto.subtle;
    const keyPair = await subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );

    const pkcs8 = new Uint8Array(
      await subtle.exportKey("pkcs8", keyPair.privateKey),
    );
    const spki = new Uint8Array(
      await subtle.exportKey("spki", keyPair.publicKey),
    );

    const privatePem = derToPem("PRIVATE KEY", pkcs8);
    const publicPem = derToPem("PUBLIC KEY", spki);

    const signature = await signRsaSha256("original", privatePem);
    const ok = await verifyRsaSha256("tampered", signature, publicPem);

    expect(ok).toBe(false);
  });
});
