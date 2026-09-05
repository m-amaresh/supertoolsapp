import {
  base64ToBase64Url,
  base64ToBytes,
  base64UrlToBase64,
  bytesToBase64,
  bytesToText as sharedBytesToText,
  textToBytes as sharedTextToBytes,
  toArrayBuffer,
} from "./bytes";

export type AesTextEncoding = "utf8" | "latin1" | "hex";

export interface AesPayload {
  v: 1;
  alg: "A256GCM";
  kdf: "PBKDF2-SHA256";
  it: number;
  salt: string;
  iv: string;
  ct: string;
  name?: string;
  type?: string;
}

const PAYLOAD_PREFIX = "st-aesgcm:";
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;
const MAX_B64URL_FIELD_LENGTH = 64 * 1024 * 1024;
const MAX_METADATA_LENGTH = 512;

export function textToBytes(
  input: string,
  encoding: AesTextEncoding,
): Uint8Array {
  return sharedTextToBytes(input, encoding);
}

export function bytesToText(
  bytes: Uint8Array,
  encoding: AesTextEncoding,
): string {
  return sharedBytesToText(bytes, encoding);
}

// Derive a 256-bit AES-GCM key from a passphrase using PBKDF2-SHA256.
async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations,
    },
    baseKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

// Encrypt arbitrary bytes with AES-256-GCM. Generates a random 16-byte salt
// and 12-byte IV, derives the key via PBKDF2, and returns a structured payload
// containing all values needed for decryption.
export async function encryptBytesAesGcm(
  plaintext: Uint8Array,
  passphrase: string,
  options: { iterations?: number; name?: string; type?: string } = {},
): Promise<AesPayload> {
  if (!passphrase) {
    throw new Error("Passphrase is required");
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const iterations = options.iterations ?? 250000;
  if (
    iterations < MIN_PBKDF2_ITERATIONS ||
    iterations > MAX_PBKDF2_ITERATIONS
  ) {
    throw new Error(
      `PBKDF2 iterations must be between ${MIN_PBKDF2_ITERATIONS} and ${MAX_PBKDF2_ITERATIONS}`,
    );
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);

  const encrypted = await subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plaintext),
  );

  return {
    v: 1,
    alg: "A256GCM",
    kdf: "PBKDF2-SHA256",
    it: iterations,
    salt: base64ToBase64Url(bytesToBase64(salt)),
    iv: base64ToBase64Url(bytesToBase64(iv)),
    ct: base64ToBase64Url(bytesToBase64(new Uint8Array(encrypted))),
    name: options.name,
    type: options.type,
  };
}

// Decrypt an AesPayload. Validates the payload structure and iteration bounds
// before attempting decryption. A wrong passphrase surfaces as a clear error.
export async function decryptPayloadAesGcm(
  payload: AesPayload,
  passphrase: string,
): Promise<Uint8Array> {
  if (!passphrase) {
    throw new Error("Passphrase is required");
  }

  if (
    payload.v !== 1 ||
    payload.alg !== "A256GCM" ||
    payload.kdf !== "PBKDF2-SHA256"
  ) {
    throw new Error("Unsupported payload format");
  }
  if (
    !Number.isInteger(payload.it) ||
    payload.it < MIN_PBKDF2_ITERATIONS ||
    payload.it > MAX_PBKDF2_ITERATIONS
  ) {
    throw new Error(
      `Invalid PBKDF2 iterations in payload (allowed ${MIN_PBKDF2_ITERATIONS}-${MAX_PBKDF2_ITERATIONS})`,
    );
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const salt = base64ToBytes(base64UrlToBase64(payload.salt));
  const iv = base64ToBytes(base64UrlToBase64(payload.iv));
  const ciphertext = base64ToBytes(base64UrlToBase64(payload.ct));
  if (salt.length !== 16) {
    throw new Error("Invalid payload salt");
  }
  if (iv.length !== 12) {
    throw new Error("Invalid payload IV");
  }
  // AES-GCM output is ciphertext || 16-byte auth tag, so the minimum valid
  // length is 16 bytes (0-byte plaintext produces just the tag).
  if (ciphertext.length < 16) {
    throw new Error("Invalid payload ciphertext");
  }
  const key = await deriveKey(passphrase, salt, payload.it);

  let decrypted: ArrayBuffer;
  try {
    decrypted = await subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    );
  } catch {
    throw new Error("Decryption failed. Check passphrase or payload integrity");
  }

  return new Uint8Array(decrypted);
}

// Serialize to the portable "st-aesgcm:<base64url>" wire format.
export function serializeAesPayload(payload: AesPayload): string {
  return `${PAYLOAD_PREFIX}${base64ToBase64Url(
    bytesToBase64(new TextEncoder().encode(JSON.stringify(payload))),
  )}`;
}

// Parse either the "st-aesgcm:" wire format or a raw JSON payload.
export function parseAesPayload(input: string): AesPayload {
  const trimmed = input.trim();

  if (trimmed.startsWith(PAYLOAD_PREFIX)) {
    const encoded = trimmed.slice(PAYLOAD_PREFIX.length);
    if (encoded.length > MAX_B64URL_FIELD_LENGTH) {
      throw new Error("Encrypted payload is too large");
    }
    const json = new TextDecoder().decode(
      base64ToBytes(base64UrlToBase64(encoded)),
    );
    return validatePayloadShape(JSON.parse(json));
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return validatePayloadShape(JSON.parse(trimmed));
  }

  throw new Error("Invalid encrypted payload format");
}

function validatePayloadShape(value: unknown): AesPayload {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid encrypted payload object");
  }

  const payload = value as Record<string, unknown>;

  const isValidB64Url = (v: unknown) =>
    typeof v === "string" &&
    v.length > 0 &&
    v.length <= MAX_B64URL_FIELD_LENGTH &&
    /^[A-Za-z0-9\-_]+$/.test(v);

  if (
    payload.v !== 1 ||
    payload.alg !== "A256GCM" ||
    payload.kdf !== "PBKDF2-SHA256" ||
    !Number.isInteger(payload.it) ||
    !isValidB64Url(payload.salt) ||
    !isValidB64Url(payload.iv) ||
    !isValidB64Url(payload.ct)
  ) {
    throw new Error("Invalid encrypted payload format");
  }

  const name =
    typeof payload.name === "string" &&
    payload.name.length <= MAX_METADATA_LENGTH
      ? payload.name
      : undefined;
  const type =
    typeof payload.type === "string" &&
    payload.type.length <= MAX_METADATA_LENGTH
      ? payload.type
      : undefined;

  return {
    v: 1,
    alg: "A256GCM",
    kdf: "PBKDF2-SHA256",
    it: payload.it as number,
    salt: payload.salt as string,
    iv: payload.iv as string,
    ct: payload.ct as string,
    name,
    type,
  };
}
