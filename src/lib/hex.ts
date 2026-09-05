import {
  bytesToHex as sharedBytesToHex,
  bytesToText as sharedBytesToText,
  hexToBytes as sharedHexToBytes,
  textToBytes as sharedTextToBytes,
} from "./bytes";

export type TextEncodingMode = "utf8" | "latin1" | "hex";

interface EncodeHexOptions {
  inputEncoding?: TextEncodingMode;
  uppercase?: boolean;
}

interface DecodeHexOptions {
  outputEncoding?: TextEncodingMode;
}

export function encodeHex(
  input: string,
  options: EncodeHexOptions = {},
): string {
  const { inputEncoding = "utf8", uppercase = false } = options;
  return sharedBytesToHex(sharedTextToBytes(input, inputEncoding), uppercase);
}

export function decodeHex(
  input: string,
  options: DecodeHexOptions = {},
): string {
  const { outputEncoding = "utf8" } = options;
  return sharedBytesToText(sharedHexToBytes(input), outputEncoding);
}

export function isValidHex(input: string): boolean {
  const normalized = input.replace(/\s+/g, "");
  return normalized.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(normalized);
}

export async function fileToHex(
  file: File,
  options: { uppercase?: boolean } = {},
): Promise<string> {
  const buffer = await file.arrayBuffer();
  return sharedBytesToHex(new Uint8Array(buffer), options.uppercase ?? false);
}
