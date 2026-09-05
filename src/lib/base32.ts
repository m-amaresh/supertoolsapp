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

export function decodeBase32(
  input: string,
  options: Base32DecodeOptions = {},
): string {
  const { outputEncoding = "utf8" } = options;
  const normalized = input.replace(/\s+/g, "").toUpperCase();

  if (!/^[A-Z2-7=]*$/.test(normalized)) {
    throw new Error("Invalid Base32 string");
  }

  const withoutPadding = normalized.replace(/=+$/, "");
  const bytes: number[] = [];

  let bits = 0;
  let value = 0;

  for (const ch of withoutPadding) {
    const mapped = BASE32_LOOKUP.get(ch);
    if (mapped === undefined) {
      throw new Error("Invalid Base32 string");
    }

    value = (value << 5) | mapped;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return sharedBytesToText(new Uint8Array(bytes), outputEncoding);
}

export function isValidBase32(input: string): boolean {
  const normalized = input.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z2-7=]*$/.test(normalized);
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
