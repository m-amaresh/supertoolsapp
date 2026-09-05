import {
  base64ToBytes as sharedBase64ToBytes,
  bytesToBase64 as sharedBytesToBase64,
  bytesToText as sharedBytesToText,
  textToBytes as sharedTextToBytes,
} from "./bytes";

export type Base64TextEncoding = "utf8" | "latin1" | "hex";
export type Base64Variant = "standard" | "url";

interface EncodeBase64Options {
  inputEncoding?: Base64TextEncoding;
  variant?: Base64Variant;
}

interface DecodeBase64Options {
  outputEncoding?: Base64TextEncoding;
  variant?: Base64Variant;
}

function bytesToBase64(bytes: Uint8Array, variant: Base64Variant): string {
  const standard = sharedBytesToBase64(bytes);
  if (variant === "standard") return standard;
  return standard.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

// Convert base64url back to standard base64 by restoring +/= chars
// and re-adding padding that base64url strips.
function normalizeBase64Input(input: string, variant: Base64Variant): string {
  const trimmed = input.replace(/\s/g, "");
  if (variant === "standard") return trimmed;
  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return normalized + "=".repeat(padding);
}

function base64ToBytes(input: string, variant: Base64Variant): Uint8Array {
  return sharedBase64ToBytes(normalizeBase64Input(input, variant));
}

function textToBytes(input: string, encoding: Base64TextEncoding): Uint8Array {
  return sharedTextToBytes(input, encoding);
}

function bytesToText(bytes: Uint8Array, encoding: Base64TextEncoding): string {
  return sharedBytesToText(bytes, encoding, { utf8Fatal: true });
}

export function encodeBase64(
  input: string,
  options: EncodeBase64Options = {},
): string {
  const { inputEncoding = "utf8", variant = "standard" } = options;
  try {
    const bytes = textToBytes(input, inputEncoding);
    return bytesToBase64(bytes, variant);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to encode to Base64");
  }
}

export function decodeBase64(
  input: string,
  options: DecodeBase64Options = {},
): string {
  const { outputEncoding = "utf8", variant = "standard" } = options;
  try {
    const bytes = base64ToBytes(input, variant);
    return bytesToText(bytes, outputEncoding);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Invalid Base64 string");
  }
}

export function isValidBase64(
  input: string,
  variant: Base64Variant = "standard",
): boolean {
  if (!input) return true;
  const trimmed = input.replace(/\s/g, "");
  if (!trimmed) return true;

  if (variant === "standard") {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(trimmed)) return false;
    if (trimmed.length % 4 !== 0) return false;
  } else if (!/^[A-Za-z0-9\-_]*$/.test(trimmed)) {
    return false;
  }

  try {
    base64ToBytes(trimmed, variant);
    return true;
  } catch {
    return false;
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
