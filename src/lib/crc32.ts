import { textToBytes as sharedTextToBytes } from "./bytes";
import type { TextEncodingMode } from "./hex";

// Pre-computed CRC32 lookup table using the standard IEEE polynomial (0xEDB88320,
// bit-reversed form of 0x04C11DB7). Each entry represents 8 iterations of the
// XOR-shift for a given byte value, turning the per-byte CRC step into a single
// table lookup.
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) {
    crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  CRC32_TABLE[i] = crc >>> 0;
}

// Seed with 0xFFFFFFFF and finalize with XOR — standard CRC32 convention.
export function crc32FromBytes(bytes: Uint8Array): number {
  return crc32Finalize(crc32Update(0xffffffff, bytes));
}

export function crc32Update(seed: number, bytes: Uint8Array): number {
  let crc = seed >>> 0;
  for (const byte of bytes) {
    const index = (crc ^ byte) & 0xff;
    crc = (crc >>> 8) ^ CRC32_TABLE[index];
  }
  return crc >>> 0;
}

export function crc32Finalize(crc: number): number {
  return (crc ^ 0xffffffff) >>> 0;
}

export function crc32HexFromBytes(bytes: Uint8Array, uppercase = true): string {
  const hex = crc32FromBytes(bytes).toString(16).padStart(8, "0");
  return uppercase ? hex.toUpperCase() : hex;
}

export function crc32FromText(
  input: string,
  encoding: TextEncodingMode = "utf8",
): number {
  return crc32FromBytes(sharedTextToBytes(input, encoding));
}

export function crc32HexFromText(
  input: string,
  encoding: TextEncodingMode = "utf8",
  uppercase = true,
): string {
  return crc32HexFromBytes(sharedTextToBytes(input, encoding), uppercase);
}
