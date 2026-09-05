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
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) {
    base64 += "=".repeat(4 - pad);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
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

  // Strip "Bearer " prefix if present
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
    header = JSON.parse(headerRaw);
  } catch {
    return { ...empty, error: "Failed to decode JWT header" };
  }

  try {
    payloadRaw = base64UrlDecode(payloadB64);
    payload = JSON.parse(payloadRaw);
  } catch {
    return { ...empty, error: "Failed to decode JWT payload" };
  }

  let isExpired: boolean | null = null;
  let expiresAt: Date | null = null;
  let issuedAt: Date | null = null;
  let notBefore: Date | null = null;

  if (typeof payload.exp === "number") {
    expiresAt = new Date(payload.exp * 1000);
    isExpired = Date.now() > payload.exp * 1000;
  }

  if (typeof payload.iat === "number") {
    issuedAt = new Date(payload.iat * 1000);
  }

  if (typeof payload.nbf === "number") {
    notBefore = new Date(payload.nbf * 1000);
  }

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
