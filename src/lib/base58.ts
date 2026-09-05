import { bytesToText, textToBytes, toArrayBuffer } from "./bytes";

export type Base58TextEncoding = "utf8" | "latin1" | "hex";
export type Base58Variant = "base58" | "base58check";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map(
  BASE58_ALPHABET.split("").map((ch, index) => [ch, index]),
);

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  const buffer = await subtle.digest("SHA-256", toArrayBuffer(bytes));
  return new Uint8Array(buffer);
}

// Base58Check checksum: first 4 bytes of SHA-256(SHA-256(payload)).
async function checksum4(bytes: Uint8Array): Promise<Uint8Array> {
  const first = await sha256(bytes);
  const second = await sha256(first);
  return second.slice(0, 4);
}

// Encode raw bytes to Base58 (Bitcoin alphabet). Leading zero bytes map to
// leading '1' characters to preserve byte-level round-trip fidelity.
export function encodeBase58Bytes(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";

  let leadingZeros = 0;
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) {
    leadingZeros++;
  }
  if (leadingZeros === bytes.length) {
    return "1".repeat(leadingZeros);
  }

  const digits: number[] = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      const value = digits[j] * 256 + carry;
      digits[j] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let output = "1".repeat(leadingZeros);
  for (let i = digits.length - 1; i >= 0; i--) {
    output += BASE58_ALPHABET[digits[i]];
  }

  return output;
}

// Decode a Base58 string back to raw bytes. Leading '1' chars become zero bytes.
export function decodeBase58ToBytes(input: string): Uint8Array {
  const trimmed = input.trim();
  if (!trimmed) return new Uint8Array();

  let leadingOnes = 0;
  while (leadingOnes < trimmed.length && trimmed[leadingOnes] === "1") {
    leadingOnes++;
  }

  const bytes: number[] = [0];
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    const mapped = BASE58_INDEX.get(ch);
    if (mapped === undefined) {
      throw new Error("Invalid Base58 input");
    }

    let carry = mapped;
    for (let j = 0; j < bytes.length; j++) {
      const value = bytes[j] * 58 + carry;
      bytes[j] = value & 0xff;
      carry = value >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  const dataLength = bytes.length === 1 && bytes[0] === 0 ? 0 : bytes.length;
  const output = new Uint8Array(leadingOnes + dataLength);
  for (let i = 0; i < leadingOnes; i++) {
    output[i] = 0;
  }
  for (let i = 0; i < dataLength; i++) {
    output[leadingOnes + i] = bytes[bytes.length - 1 - i];
  }

  return output;
}

export async function encodeBase58CheckBytes(
  bytes: Uint8Array,
): Promise<string> {
  const sum = await checksum4(bytes);
  return encodeBase58Bytes(concatBytes(bytes, sum));
}

export async function decodeBase58CheckToBytes(
  input: string,
): Promise<Uint8Array> {
  const decoded = decodeBase58ToBytes(input);
  if (decoded.length < 4) {
    throw new Error("Invalid Base58Check payload");
  }
  const payload = decoded.slice(0, -4);
  const provided = decoded.slice(-4);
  const expected = await checksum4(payload);
  if (!equalBytes(provided, expected)) {
    throw new Error("Invalid Base58Check checksum");
  }
  return payload;
}

export async function encodeBase58(
  input: string,
  options: { inputEncoding?: Base58TextEncoding; variant?: Base58Variant } = {},
): Promise<string> {
  const { inputEncoding = "utf8", variant = "base58" } = options;
  const bytes = textToBytes(input, inputEncoding);
  if (variant === "base58") {
    return encodeBase58Bytes(bytes);
  }
  return encodeBase58CheckBytes(bytes);
}

export async function decodeBase58(
  input: string,
  options: {
    outputEncoding?: Base58TextEncoding;
    variant?: Base58Variant;
  } = {},
): Promise<string> {
  const { outputEncoding = "utf8", variant = "base58" } = options;
  const bytes =
    variant === "base58"
      ? decodeBase58ToBytes(input)
      : await decodeBase58CheckToBytes(input);
  return bytesToText(bytes, outputEncoding, { utf8Fatal: true });
}
