import { base64ToBytes, base64UrlToBase64 } from "./bytes";

export interface JwtDecoded {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  headerRaw: string;
  payloadRaw: string;
}

export interface JwtResult {
  decoded: JwtDecoded | null;
  error: string | null;
  isExpired: boolean | null;
  expiresAt: Date | null;
  issuedAt: Date | null;
  notBefore: Date | null;
}

// Decode a base64url segment to a UTF-8 string. JWT segments are JSON, which
// RFC 8259 mandates be UTF-8 — invalid UTF-8 is a decode failure, not a
// silent fallback to Latin-1 (which produces mojibake that looks successful).
function base64UrlDecode(str: string): string {
  const bytes = base64ToBytes(base64UrlToBase64(str));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

// RFC 7519 §7.2: the JOSE header and the claims set must both be JSON
// objects; `null`, arrays and primitives are malformed tokens.
function parseJsonObject(text: string): Record<string, unknown> {
  const value: unknown = JSON.parse(text);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Not a JSON object");
  }
  return value as Record<string, unknown>;
}

// A NumericDate (seconds since the epoch) as a Date, or null when the claim is
// absent, not a number, or outside the range a Date can represent.
function numericDate(value: unknown): Date | null {
  if (typeof value !== "number") return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Decode a JWT without signature verification (inspection only).
// Strips a "Bearer " prefix if present. Extracts exp/iat/nbf timestamps.
export function decodeJwt(token: string): JwtResult {
  const empty: JwtResult = {
    decoded: null,
    error: null,
    isExpired: null,
    expiresAt: null,
    issuedAt: null,
    notBefore: null,
  };

  const trimmed = token.trim();
  if (!trimmed) return empty;

  const cleaned = trimmed.replace(/^Bearer\s+/i, "");

  const parts = cleaned.split(".");
  if (parts.length !== 3) {
    return {
      ...empty,
      error: `Invalid JWT format: expected 3 parts separated by dots, got ${parts.length}`,
    };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  let headerRaw: string;
  let payloadRaw: string;

  try {
    headerRaw = base64UrlDecode(headerB64);
    header = parseJsonObject(headerRaw);
  } catch {
    return { ...empty, error: "Failed to decode JWT header" };
  }

  try {
    payloadRaw = base64UrlDecode(payloadB64);
    payload = parseJsonObject(payloadRaw);
  } catch {
    return { ...empty, error: "Failed to decode JWT payload" };
  }

  let isExpired: boolean | null = null;
  let expiresAt: Date | null = null;
  let issuedAt: Date | null = null;
  let notBefore: Date | null = null;

  expiresAt = numericDate(payload.exp);
  if (expiresAt) isExpired = Date.now() > expiresAt.getTime();
  issuedAt = numericDate(payload.iat);
  notBefore = numericDate(payload.nbf);

  return {
    decoded: {
      header,
      payload,
      signature: signatureB64,
      headerRaw: JSON.stringify(header, null, 2),
      payloadRaw: JSON.stringify(payload, null, 2),
    },
    error: null,
    isExpired,
    expiresAt,
    issuedAt,
    notBefore,
  };
}
