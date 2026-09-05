import {
  type ByteTextEncoding,
  base64ToBase64Url,
  base64ToBytes,
  base64UrlToBase64,
  bytesToBase64,
  bytesToHex,
  hexToBytes,
  textToBytes,
  toArrayBuffer,
} from "./bytes";

export type RsaSignatureEncoding = "base64" | "base64url" | "hex";

// All sign/verify operations use RSASSA-PKCS1-v1_5 with SHA-256.
// The hash is intentionally fixed; callers have no algorithm parameter.
const RSA_SIGN_ALG: RsaHashedImportParams = {
  name: "RSASSA-PKCS1-v1_5",
  hash: "SHA-256",
};

function requireSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  return subtle;
}

// Extract the label and DER-encoded bytes from a PEM block.
function parsePem(pem: string): { label: string; der: Uint8Array } {
  const trimmed = pem.trim();
  const match = trimmed.match(
    /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]+?)-----END \1-----/,
  );

  if (!match) {
    throw new Error("Invalid PEM format");
  }

  const label = match[1];
  const base64Body = match[2].replace(/\s+/g, "");

  if (!base64Body) {
    throw new Error("PEM body is empty");
  }

  return {
    label,
    der: base64ToBytes(base64Body),
  };
}

export async function importRsaPrivateKeyFromPem(
  pem: string,
): Promise<CryptoKey> {
  const subtle = requireSubtle();
  const { label, der } = parsePem(pem);

  if (label !== "PRIVATE KEY") {
    throw new Error("Expected PKCS#8 private key PEM (BEGIN PRIVATE KEY)");
  }

  return subtle.importKey("pkcs8", toArrayBuffer(der), RSA_SIGN_ALG, false, [
    "sign",
  ]);
}

export async function importRsaPublicKeyFromPem(
  pem: string,
): Promise<CryptoKey> {
  const subtle = requireSubtle();
  const { label, der } = parsePem(pem);

  if (label !== "PUBLIC KEY") {
    throw new Error("Expected SPKI public key PEM (BEGIN PUBLIC KEY)");
  }

  return subtle.importKey("spki", toArrayBuffer(der), RSA_SIGN_ALG, false, [
    "verify",
  ]);
}

export function encodeSignature(
  signature: Uint8Array,
  encoding: RsaSignatureEncoding,
): string {
  if (encoding === "hex") {
    return bytesToHex(signature);
  }

  const base64 = bytesToBase64(signature);
  return encoding === "base64" ? base64 : base64ToBase64Url(base64);
}

export function decodeSignature(
  input: string,
  encoding: RsaSignatureEncoding,
): Uint8Array {
  const normalized = input.trim().replace(/\s+/g, "");
  if (!normalized) {
    throw new Error("Signature is required");
  }

  if (encoding === "hex") {
    return hexToBytes(normalized);
  }

  if (encoding === "base64") {
    return base64ToBytes(normalized);
  }

  return base64ToBytes(base64UrlToBase64(normalized));
}

// Sign a message with RSASSA-PKCS1-v1_5 / SHA-256 using a PEM private key.
export async function signRsaSha256(
  message: string,
  privateKeyPem: string,
  options: {
    messageEncoding?: ByteTextEncoding;
    signatureEncoding?: RsaSignatureEncoding;
  } = {},
): Promise<string> {
  const subtle = requireSubtle();
  const messageEncoding = options.messageEncoding ?? "utf8";
  const signatureEncoding = options.signatureEncoding ?? "base64";

  const key = await importRsaPrivateKeyFromPem(privateKeyPem);
  const messageBytes = textToBytes(message, messageEncoding);

  const signature = await subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    toArrayBuffer(messageBytes),
  );

  return encodeSignature(new Uint8Array(signature), signatureEncoding);
}

// Verify an RSASSA-PKCS1-v1_5 / SHA-256 signature using a PEM public key.
export async function verifyRsaSha256(
  message: string,
  signatureInput: string,
  publicKeyPem: string,
  options: {
    messageEncoding?: ByteTextEncoding;
    signatureEncoding?: RsaSignatureEncoding;
  } = {},
): Promise<boolean> {
  const subtle = requireSubtle();
  const messageEncoding = options.messageEncoding ?? "utf8";
  const signatureEncoding = options.signatureEncoding ?? "base64";

  const key = await importRsaPublicKeyFromPem(publicKeyPem);
  const messageBytes = textToBytes(message, messageEncoding);
  const signatureBytes = decodeSignature(signatureInput, signatureEncoding);

  return subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    toArrayBuffer(signatureBytes),
    toArrayBuffer(messageBytes),
  );
}
