import { describe, expect, it } from "vitest";
import { shouldShowValidJsonStatus } from "./json";

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
});
