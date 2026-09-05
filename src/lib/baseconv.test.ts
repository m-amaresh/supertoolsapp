import { describe, expect, it } from "vitest";
import { convertBase } from "./baseconv";

describe("baseconv", () => {
  it("converts negative values with base prefixes", () => {
    const hex = convertBase("-0xFF", "hex");
    expect(hex.error).toBeNull();
    expect(hex.dec).toBe("-255");
    expect(hex.bin).toBe("-11111111");

    const bin = convertBase("-0b1010", "bin");
    expect(bin.error).toBeNull();
    expect(bin.dec).toBe("-10");
    expect(bin.hex).toBe("-A");

    const oct = convertBase("-0o77", "oct");
    expect(oct.error).toBeNull();
    expect(oct.dec).toBe("-63");
    expect(oct.hex).toBe("-3F");
  });
});
