import { describe, expect, it } from "vitest";
import { escapeString, unescapeString } from "./escape";

describe("escape", () => {
  it("escapes and unescapes html", () => {
    const raw = `<div class="x">Tom & Jerry</div>`;
    const escaped = escapeString(raw, "html");
    expect(escaped).toContain("&lt;div");
    expect(unescapeString(escaped, "html")).toBe(raw);
  });

  it("escapes and unescapes json sequences", () => {
    const raw = 'line1\n"quoted"';
    const escaped = escapeString(raw, "json");
    expect(escaped).toContain("\\n");
    expect(unescapeString(escaped, "json")).toBe(raw);
  });

  it("handles invalid url decode safely", () => {
    const malformed = "%E0%A4%A";
    expect(unescapeString(malformed, "url")).toBe(malformed);
  });

  it("escapes and unescapes regex control characters", () => {
    const raw = "a+b?";
    const escaped = escapeString(raw, "regex");
    expect(escaped).toBe("a\\+b\\?");
    expect(unescapeString(escaped, "regex")).toBe(raw);
  });
});
