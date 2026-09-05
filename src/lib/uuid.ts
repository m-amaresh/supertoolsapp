export interface UuidOptions {
  uppercase: boolean;
  hyphens: boolean;
  braces: boolean;
}

// Generate a UUID v4 using the Web Crypto API. Falls back to manual
// construction when crypto.randomUUID is unavailable (e.g. non-secure contexts).
export function generateUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version 4 (bits 12-15 of time_hi_and_version)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant 10xx (RFC 9562 variant bits in clock_seq_hi)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function formatUuid(uuid: string, options: UuidOptions): string {
  let result = uuid;

  if (!options.hyphens) {
    result = result.replace(/-/g, "");
  }

  if (options.uppercase) {
    result = result.toUpperCase();
  }

  if (options.braces) {
    result = `{${result}}`;
  }

  return result;
}

export function generateBulkUuids(
  count: number,
  options: UuidOptions,
): string[] {
  const uuids: string[] = [];
  const safeCount = Math.min(Math.max(1, count), 1000);

  for (let i = 0; i < safeCount; i++) {
    uuids.push(formatUuid(generateUuid(), options));
  }

  return uuids;
}
