import { describe, expect, it } from "vitest";
import {
  generatePalette,
  hexToRgb,
  parseColor,
  rgbToHex,
  rgbToHsl,
} from "./color";

describe("color", () => {
  it("normalizes hex input", () => {
    expect(parseColor("#f60")).toMatchObject({
      hex: "#ff6600",
      rgb: { r: 255, g: 102, b: 0 },
      error: null,
    });
  });

  it("parses rgb input", () => {
    expect(parseColor("rgb(255, 102, 0)")).toMatchObject({
      hex: "#ff6600",
      rgb: { r: 255, g: 102, b: 0 },
      hsl: { h: 24, s: 100, l: 50 },
      error: null,
    });
  });

  it("parses hsl input", () => {
    expect(parseColor("hsl(24, 100%, 50%)")).toMatchObject({
      hex: "#ff6600",
      rgb: { r: 255, g: 102, b: 0 },
      hsl: { h: 24, s: 100, l: 50 },
      error: null,
    });
  });

  it("parses oklch percentage input", () => {
    const result = parseColor("oklch(65% 0.2 30)");
    expect(result.error).toBeNull();
    expect(result.oklch).toEqual({ l: 0.65, c: 0.2, h: 30 });
    expect(result.hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("rejects invalid color input", () => {
    expect(parseColor("rgb(999, 0, 0)").error).toBe(
      "Unrecognized color format",
    );
    expect(parseColor("not-a-color").error).toBe("Unrecognized color format");
  });

  it("creates an evenly spaced palette for saturated colors", () => {
    expect(generatePalette("#ff0000", 4)).toEqual([
      "#ff0000",
      "#80ff00",
      "#00ffff",
      "#7f00ff",
    ]);
  });

  it("creates a lightness ramp for near-neutral colors", () => {
    const palette = generatePalette("#808080", 4);
    expect(palette).toEqual(["#333333", "#666666", "#999999", "#cccccc"]);
  });

  it("exposes stable primitive conversions", () => {
    expect(hexToRgb("#abcdef")).toEqual({ r: 171, g: 205, b: 239 });
    expect(rgbToHex(171, 205, 239)).toBe("#abcdef");
    expect(rgbToHsl(255, 102, 0)).toEqual({ h: 24, s: 100, l: 50 });
  });
});
