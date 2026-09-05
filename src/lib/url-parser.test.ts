import { describe, expect, it } from "vitest";
import {
  buildUrlFromParts,
  isNeutralUrlBuilderState,
  parseUrlParts,
} from "./url-parser";

describe("url-parser", () => {
  it("parses URL fields and query params", () => {
    const parsed = parseUrlParts(
      "https://user:pass@example.com:8443/path/to?a=1&b=two#frag",
    );

    expect(parsed.protocol).toBe("https:");
    expect(parsed.hostname).toBe("example.com");
    expect(parsed.port).toBe("8443");
    expect(parsed.pathname).toBe("/path/to");
    expect(parsed.hash).toBe("frag");
    expect(parsed.username).toBe("user");
    expect(parsed.password).toBe("pass");
    expect(parsed.params).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "two" },
    ]);
  });

  it("builds URL from editable parts", () => {
    const url = buildUrlFromParts({
      protocol: "https",
      hostname: "api.example.com",
      port: "443",
      pathname: "v1/users",
      hash: "section",
      params: [
        { key: "q", value: "john doe" },
        { key: "page", value: "2" },
      ],
    });

    expect(url).toBe(
      "https://api.example.com/v1/users?q=john+doe&page=2#section",
    );
  });

  it("validates malformed URLs", () => {
    expect(() => parseUrlParts("example.com/path")).toThrow(/protocol/i);
    expect(() =>
      buildUrlFromParts({
        protocol: "https",
        hostname: "example.com",
        port: "abc",
      }),
    ).toThrow(/Port must be numeric/);
  });

  // Neutrality is a property of the builder alone. It used to also depend on
  // the separate Input URL field, which is what made typing a valid URL raise
  // "Hostname is required" against a builder the user had not touched.
  it("recognizes the cleared builder state as neutral", () => {
    expect(
      isNeutralUrlBuilderState({
        hostname: "",
        port: "",
        pathname: "/",
        hash: "",
        username: "",
        password: "",
        params: [{ key: "", value: "" }],
      }),
    ).toBe(true);
  });

  it("is not neutral once a builder field is filled", () => {
    expect(
      isNeutralUrlBuilderState({
        hostname: "example.com",
        port: "",
        pathname: "/",
        hash: "",
        username: "",
        password: "",
        params: [{ key: "", value: "" }],
      }),
    ).toBe(false);
  });
});
