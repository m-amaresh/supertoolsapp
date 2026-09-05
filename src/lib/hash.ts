import {
  base64ToBase64Url,
  bytesToBase64,
  bytesToHex,
  textToBytes,
  toArrayBuffer,
} from "./bytes";

export type HashAlgorithm =
  | "MD5"
  | "SHA-1"
  | "SHA-256"
  | "SHA-512"
  | "SHA3-256";
export type HashTextEncoding = "utf8" | "latin1" | "hex";
export type HashOutputEncoding = "hex" | "base64" | "base64url";

interface HashOptions {
  inputEncoding?: HashTextEncoding;
  outputEncoding?: HashOutputEncoding;
}

interface HmacOptions {
  inputEncoding?: HashTextEncoding;
  keyEncoding?: HashTextEncoding;
  outputEncoding?: HashOutputEncoding;
}

interface ByteHashOptions {
  outputEncoding?: HashOutputEncoding;
}

interface ByteHmacOptions {
  keyEncoding?: HashTextEncoding;
  outputEncoding?: HashOutputEncoding;
}

// Yield to the event loop every 64 blocks (4 KB) to stay within the ~16 ms
// frame budget on slower devices. 1024 blocks (64 KB) was too coarse.
const MD5_YIELD_BLOCK_INTERVAL = 64;

// Lazy-loaded @noble/hashes modules. Cached on success, reset on failure
// so a transient import error doesn't permanently break the session.
let sha3ModulePromise: Promise<typeof import("@noble/hashes/sha3.js")> | null =
  null;
let hmacModulePromise: Promise<typeof import("@noble/hashes/hmac.js")> | null =
  null;

async function getSha3Module() {
  if (!sha3ModulePromise) {
    sha3ModulePromise = import("@noble/hashes/sha3.js").catch((err) => {
      sha3ModulePromise = null;
      throw err;
    });
  }
  return sha3ModulePromise;
}

async function getHmacModule() {
  if (!hmacModulePromise) {
    hmacModulePromise = import("@noble/hashes/hmac.js").catch((err) => {
      hmacModulePromise = null;
      throw err;
    });
  }
  return hmacModulePromise;
}

async function yieldToEventLoop() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function computeSha3(inputBytes: Uint8Array): Promise<Uint8Array> {
  const { sha3_256 } = await getSha3Module();
  return sha3_256(inputBytes);
}

async function computeHmacSha3(
  key: Uint8Array,
  message: Uint8Array,
): Promise<Uint8Array> {
  const [{ hmac }, { sha3_256 }] = await Promise.all([
    getHmacModule(),
    getSha3Module(),
  ]);
  return hmac(sha3_256, key, message);
}

// Pure-JS MD5 (RFC 1321). Needed because Web Crypto doesn't expose MD5.
// Yields to the event loop every 1024 blocks to avoid freezing the UI on large inputs.
async function md5(data: Uint8Array): Promise<Uint8Array> {
  function leftRotate(x: number, c: number): number {
    return (x << c) | (x >>> (32 - c));
  }

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5,
    9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11,
    16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10,
    15, 21,
  ];

  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a,
    0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340,
    0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8,
    0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92,
    0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];

  // Pre-processing: adding padding bits
  const bitLen = data.length * 8;
  const msgLen = data.length;
  // Number of bytes after padding (must be 64-byte aligned, with 8 bytes for length)
  const padLen =
    (msgLen + 8) % 64 === 0
      ? msgLen + 8
      : msgLen + 8 + (64 - ((msgLen + 8) % 64));
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[msgLen] = 0x80;

  // Append original length in bits as 64-bit little-endian
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen & 0xffffffff, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  let blockCount = 0;
  for (let offset = 0; offset < padded.length; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(offset + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;

      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      F = (F + A + K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + leftRotate(F, s[i])) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;

    blockCount++;
    if (blockCount % MD5_YIELD_BLOCK_INTERVAL === 0) {
      await yieldToEventLoop();
    }
  }

  const result = new Uint8Array(16);
  const resultView = new DataView(result.buffer);
  resultView.setUint32(0, a0, true);
  resultView.setUint32(4, b0, true);
  resultView.setUint32(8, c0, true);
  resultView.setUint32(12, d0, true);
  return result;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return bytesToHex(new Uint8Array(buffer));
}

function encodeDigest(
  bytes: Uint8Array,
  outputEncoding: HashOutputEncoding,
): string {
  if (outputEncoding === "hex") {
    return bytesToHex(bytes);
  }

  const base64 = bytesToBase64(bytes);
  if (outputEncoding === "base64") return base64;

  return base64ToBase64Url(base64);
}

export async function generateHash(
  input: string,
  algorithm: HashAlgorithm,
  options: HashOptions = {},
): Promise<string> {
  const { inputEncoding = "utf8", outputEncoding = "hex" } = options;
  const inputBytes = textToBytes(input, inputEncoding);

  if (algorithm === "MD5") {
    return encodeDigest(await md5(inputBytes), outputEncoding);
  }

  if (algorithm === "SHA3-256") {
    return encodeDigest(await computeSha3(inputBytes), outputEncoding);
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const hashBuffer = await subtle.digest(algorithm, toArrayBuffer(inputBytes));
  if (outputEncoding === "hex") return bufferToHex(hashBuffer);
  return encodeDigest(new Uint8Array(hashBuffer), outputEncoding);
}

// Collect results from Promise.allSettled into a HashAlgorithm-keyed record,
// substituting a fallback string for any rejected promise.
async function settleAllAlgorithms(
  tasks: Promise<string>[],
): Promise<Record<HashAlgorithm, string>> {
  const results = await Promise.allSettled(tasks);
  const output = {} as Record<HashAlgorithm, string>;
  for (let i = 0; i < hashAlgorithms.length; i++) {
    const result = results[i];
    output[hashAlgorithms[i]] =
      result.status === "fulfilled"
        ? result.value
        : "Unavailable in this browser/context";
  }
  return output;
}

export async function generateAllHashes(
  input: string,
  options: HashOptions = {},
): Promise<Record<HashAlgorithm, string>> {
  return settleAllAlgorithms(
    hashAlgorithms.map((algorithm) => generateHash(input, algorithm, options)),
  );
}

export async function generateHashFromBytes(
  inputBytes: Uint8Array,
  algorithm: HashAlgorithm,
  options: ByteHashOptions = {},
): Promise<string> {
  const { outputEncoding = "hex" } = options;

  if (algorithm === "MD5") {
    return encodeDigest(await md5(inputBytes), outputEncoding);
  }

  if (algorithm === "SHA3-256") {
    return encodeDigest(await computeSha3(inputBytes), outputEncoding);
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const hashBuffer = await subtle.digest(algorithm, toArrayBuffer(inputBytes));
  if (outputEncoding === "hex") return bufferToHex(hashBuffer);
  return encodeDigest(new Uint8Array(hashBuffer), outputEncoding);
}

export async function generateAllHashesFromBytes(
  inputBytes: Uint8Array,
  options: ByteHashOptions = {},
): Promise<Record<HashAlgorithm, string>> {
  return settleAllAlgorithms(
    hashAlgorithms.map((algorithm) =>
      generateHashFromBytes(inputBytes, algorithm, options),
    ),
  );
}

export async function generateHmac(
  input: string,
  key: string,
  algorithm: HashAlgorithm,
  options: HmacOptions = {},
): Promise<string> {
  const {
    inputEncoding = "utf8",
    keyEncoding = "utf8",
    outputEncoding = "hex",
  } = options;

  if (algorithm === "MD5") {
    throw new Error("HMAC-MD5 is not supported in this tool");
  }

  const keyData = textToBytes(key, keyEncoding);
  const messageData = textToBytes(input, inputEncoding);

  if (algorithm === "SHA3-256") {
    return encodeDigest(
      await computeHmacSha3(keyData, messageData),
      outputEncoding,
    );
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }

  const cryptoKey = await subtle.importKey(
    "raw",
    toArrayBuffer(keyData),
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"],
  );

  const signature = await subtle.sign(
    "HMAC",
    cryptoKey,
    toArrayBuffer(messageData),
  );
  if (outputEncoding === "hex") return bufferToHex(signature);
  return encodeDigest(new Uint8Array(signature), outputEncoding);
}

export async function generateAllHmacs(
  input: string,
  key: string,
  options: HmacOptions = {},
): Promise<Record<HashAlgorithm, string>> {
  return settleAllAlgorithms(
    hashAlgorithms.map((algorithm) =>
      generateHmac(input, key, algorithm, options),
    ),
  );
}

export async function generateHmacFromBytes(
  inputBytes: Uint8Array,
  key: string,
  algorithm: HashAlgorithm,
  options: ByteHmacOptions = {},
): Promise<string> {
  const { keyEncoding = "utf8", outputEncoding = "hex" } = options;

  if (algorithm === "MD5") {
    throw new Error("HMAC-MD5 is not supported in this tool");
  }

  const keyData = textToBytes(key, keyEncoding);

  if (algorithm === "SHA3-256") {
    return encodeDigest(
      await computeHmacSha3(keyData, inputBytes),
      outputEncoding,
    );
  }

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  const cryptoKey = await subtle.importKey(
    "raw",
    toArrayBuffer(keyData),
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"],
  );

  const signature = await subtle.sign(
    "HMAC",
    cryptoKey,
    toArrayBuffer(inputBytes),
  );
  if (outputEncoding === "hex") return bufferToHex(signature);
  return encodeDigest(new Uint8Array(signature), outputEncoding);
}

export async function generateAllHmacsFromBytes(
  inputBytes: Uint8Array,
  key: string,
  options: ByteHmacOptions = {},
): Promise<Record<HashAlgorithm, string>> {
  return settleAllAlgorithms(
    hashAlgorithms.map((algorithm) =>
      generateHmacFromBytes(inputBytes, key, algorithm, options),
    ),
  );
}

export const hashAlgorithms: HashAlgorithm[] = [
  "MD5",
  "SHA-1",
  "SHA-256",
  "SHA-512",
  "SHA3-256",
];
