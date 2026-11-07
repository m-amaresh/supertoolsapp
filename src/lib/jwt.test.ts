import { describe, expect, it } from "vitest";
import { decodeJwt } from "./jwt";

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (header: unknown, payload: unknown) =>
  `${b64url(header)}.${b64url(payload)}.sig`;

describe("decodeJwt", () => {
  it("decodes header, payload and NumericDate claims", () => {
    const result = decodeJwt(
      `Bearer ${token({ alg: "HS256" }, { sub: "1", iat: 1_700_000_000 })}`,
    );
    expect(result.error).toBeNull();
    expect(result.decoded?.header.alg).toBe("HS256");
    expect(result.issuedAt?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
  });

  it.each([null, [], 42, "text"])(
    "rejects a payload that is %j instead of an object",
    (payload) => {
      const result = decodeJwt(token({ alg: "HS256" }, payload));
      expect(result.decoded).toBeNull();
      expect(result.error).toBe("Failed to decode JWT payload");
    },
  );

  it("rejects a null header", () => {
    const result = decodeJwt(token(null, {}));
    expect(result.decoded).toBeNull();
    expect(result.error).toBe("Failed to decode JWT header");
  });

  it("ignores NumericDate claims a Date cannot represent", () => {
    const result = decodeJwt(token({ alg: "none" }, { exp: 1e20, iat: 1e20 }));
    expect(result.error).toBeNull();
    expect(result.expiresAt).toBeNull();
    expect(result.isExpired).toBeNull();
    expect(result.issuedAt).toBeNull();
  });
});
