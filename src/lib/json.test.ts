import { describe, expect, it } from "vitest";
import { shouldShowValidJsonStatus, sortJsonKeys } from "./json";

describe("json status", () => {
  it("does not show valid status for oversized input", () => {
    expect(
      shouldShowValidJsonStatus({
        input: '{"a":1}',
        hasError: false,
        oversized: true,
      }),
    ).toBe(false);
  });

  it("shows valid status only for non-empty non-oversized inputs without errors", () => {
    expect(
      shouldShowValidJsonStatus({
        input: '{"a":1}',
        hasError: false,
        oversized: false,
      }),
    ).toBe(true);
  });

  it("sorts keys without losing a __proto__ key", () => {
    const sorted = sortJsonKeys(JSON.parse('{"b":2,"__proto__":{"a":1}}'));
    expect(JSON.stringify(sorted)).toBe('{"__proto__":{"a":1},"b":2}');
    expect(Object.getPrototypeOf(sorted)).toBe(Object.prototype);
  });
});
