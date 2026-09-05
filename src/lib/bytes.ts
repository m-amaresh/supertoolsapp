// Shared byte-level primitives used across encoding, hashing, and crypto tools.
export type ByteTextEncoding = "utf8" | "latin1" | "hex";

export function bytesToHex(bytes: Uint8Array, uppercase = false): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return uppercase ? hex.toUpperCase() : hex;
}

export function hexToBytes(input: string): Uint8Array {
  const normalized = input.replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]*$/.test(normalized)) {
    throw new Error("Hex input contains invalid characters");
  }
  if (normalized.length % 2 !== 0) {
    throw new Error("Hex input length must be even");
  }

  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

export function textToBytes(
  input: string,
  encoding: ByteTextEncoding,
): Uint8Array {
  if (encoding === "utf8") {
    return new TextEncoder().encode(input);
  }
  if (encoding === "latin1") {
    return Uint8Array.from(input, (char) => {
      const code = char.codePointAt(0) ?? 0;
      if (code > 0xff) {
        throw new Error(
          "Input contains characters outside the Latin-1 range (U+0000\u2013U+00FF)",
        );
      }
      return code;
    });
  }
  return hexToBytes(input);
}

export function bytesToText(
  bytes: Uint8Array,
  encoding: ByteTextEncoding,
  options: { utf8Fatal?: boolean; hexUppercase?: boolean } = {},
): string {
  if (encoding === "hex") {
    return bytesToHex(bytes, options.hexUppercase ?? false);
  }
  if (encoding === "utf8") {
    return new TextDecoder("utf-8", {
      fatal: options.utf8Fatal ?? false,
    }).decode(bytes);
  }
  return Array.from(bytes, (b) => String.fromCodePoint(b)).join("");
}

// btoa() can't handle large byte arrays in a single call, so we chunk
// the input into 8KB slices of Latin-1 characters before encoding.
export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
  }
  return btoa(parts.join(""));
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function base64ToBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBase64(base64Url: string): string {
  if (!base64Url || !/^[A-Za-z0-9\-_]+$/.test(base64Url)) {
    throw new Error("Invalid base64url payload");
  }
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad === 0) return base64;
  return `${base64}${"=".repeat(4 - pad)}`;
}

// Web Crypto methods require a dedicated ArrayBuffer, not a view that may
// share a larger underlying buffer. This copies into a clean buffer.
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
