import { describe, expect, it } from "vitest";
import {
  generateQrMatrix,
  matrixToSvg,
  qrErrorCorrectionOptions,
  qrPresets,
} from "./qrcode";

describe("qrcode", () => {
  it("generates a square boolean matrix for a URL", async () => {
    const matrix = await generateQrMatrix("https://example.com");
    expect(matrix.size).toBeGreaterThanOrEqual(21);
    expect(matrix.modules).toHaveLength(matrix.size);
    expect(matrix.modules[0]).toHaveLength(matrix.size);
    expect(matrix.errorCorrection).toBe("M");
    // Finder pattern: top-left 7x7 has a known shape.
    expect(matrix.modules[0][0]).toBe(true);
    expect(matrix.modules[0][6]).toBe(true);
    expect(matrix.modules[0][7]).toBe(false);
  });

  it("respects the error correction level", async () => {
    const low = await generateQrMatrix("hello", { errorCorrection: "L" });
    const high = await generateQrMatrix("hello", { errorCorrection: "H" });
    expect(low.errorCorrection).toBe("L");
    expect(high.errorCorrection).toBe("H");
    expect(high.size).toBeGreaterThanOrEqual(low.size);
  });

  it("rejects empty input", async () => {
    await expect(generateQrMatrix("")).rejects.toThrow(/required/i);
  });

  it("rejects oversized input", async () => {
    const huge = "a".repeat(3000);
    await expect(generateQrMatrix(huge)).rejects.toThrow(/too large/i);
  });

  it("renders a matrix to an SVG with the expected viewBox", async () => {
    const matrix = await generateQrMatrix("hello");
    const svg = matrixToSvg(matrix, { margin: 2, moduleSize: 8 });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    const expectedSize = (matrix.size + 4) * 8;
    expect(svg).toContain(`viewBox="0 0 ${expectedSize} ${expectedSize}"`);
  });

  it("ships sane preset and option lists", () => {
    expect(qrErrorCorrectionOptions).toHaveLength(4);
    expect(qrPresets.some((preset) => preset.name === "Wi-Fi")).toBe(true);
  });
});
