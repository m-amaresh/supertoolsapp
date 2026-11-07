import {
  bytesToText as sharedBytesToText,
  textToBytes as sharedTextToBytes,
} from "./bytes";
import type { TextEncodingMode } from "./hex";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BASE32_LOOKUP = new Map(
  BASE32_ALPHABET.split("").map((ch, i) => [ch, i]),
);

interface Base32EncodeOptions {
  inputEncoding?: TextEncodingMode;
  padding?: boolean;
  lowercase?: boolean;
}

interface Base32DecodeOptions {
  outputEncoding?: TextEncodingMode;
}

// Encode bytes into Base32 by consuming input 5 bits at a time.
// Leftover bits at the end are left-padded with zeros to form the last symbol.
function encodeBytes(
  bytes: Uint8Array,
  padding: boolean,
  lowercase: boolean,
): string {
  let bits = 0;
  let value = 0;
  const parts: string[] = [];

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      parts.push(BASE32_ALPHABET[(value >>> (bits - 5)) & 31]);
      bits -= 5;
    }
  }

  if (bits > 0) {
    parts.push(BASE32_ALPHABET[(value << (5 - bits)) & 31]);
  }

  let output = parts.join("");

  if (padding) {
    while (output.length % 8 !== 0) {
      output += "=";
    }
  }

  return lowercase ? output.toLowerCase() : output;
}

export function encodeBase32(
  input: string,
  options: Base32EncodeOptions = {},
): string {
  const { inputEncoding = "utf8", padding = true, lowercase = false } = options;
  const bytes = sharedTextToBytes(input, inputEncoding);
  return encodeBytes(bytes, padding, lowercase);
}

// Padding a final quantum of N leftover characters needs (RFC 4648 §6).
const PADDING_FOR_REMAINDER: Record<number, number> = {
  0: 0,
  2: 6,
  4: 4,
  5: 3,
  7: 1,
};

// Strict RFC 4648 decode: rejects lengths no encoder produces, padding
// anywhere but the end (or the wrong amount of it), and leftover bits that
// would otherwise be dropped silently.
function decodeBytes(input: string): Uint8Array {
  const normalized = input.replace(/\s+/g, "").toUpperCase();
  const match = normalized.match(/^([A-Z2-7]*)(=*)$/);
  if (!match) {
    throw new Error("Invalid Base32 string");
  }

  const [, body, padding] = match;
  const expectedPadding = PADDING_FOR_REMAINDER[body.length % 8];
  if (expectedPadding === undefined) {
    throw new Error("Invalid Base32 length");
  }
  if (padding.length > 0 && padding.length !== expectedPadding) {
    throw new Error("Invalid Base32 padding");
  }

  const bytes = new Uint8Array(Math.floor((body.length * 5) / 8));
  let bits = 0;
  let value = 0;
  let index = 0;

  for (const ch of body) {
    const mapped = BASE32_LOOKUP.get(ch);
    if (mapped === undefined) {
      throw new Error("Invalid Base32 string");
    }

    value = ((value << 5) | mapped) & 0xfff;
    bits += 5;

    if (bits >= 8) {
      bytes[index++] = (value >>> (bits - 8)) & 0xff;
      bits -= 8;
    }
  }

  if ((value & ((1 << bits) - 1)) !== 0) {
    throw new Error("Invalid Base32 string: non-zero trailing bits");
  }

  return bytes;
}

export function decodeBase32(
  input: string,
  options: Base32DecodeOptions = {},
): string {
  const { outputEncoding = "utf8" } = options;
  return sharedBytesToText(decodeBytes(input), outputEncoding);
}

export function isValidBase32(input: string): boolean {
  try {
    decodeBytes(input);
    return true;
  } catch {
    return false;
  }
}

export async function fileToBase32(
  file: File,
  options: { padding?: boolean; lowercase?: boolean } = {},
): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return encodeBytes(
    bytes,
    options.padding ?? true,
    options.lowercase ?? false,
  );
}
