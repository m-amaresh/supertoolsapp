import { describe, expect, it } from "vitest";
import {
  estimateEntropyBits,
  generatePassword,
  generatePasswords,
} from "./password";

const strongOptions = {
  length: 16,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeSimilar: false,
  excludeChars: "",
} as const;

describe("password", () => {
  it("generates password with all selected character groups", () => {
    const password = generatePassword(strongOptions);
    expect(password).toHaveLength(16);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
  });

  it("respects excludeSimilar and excludeChars", () => {
    const password = generatePassword({
      ...strongOptions,
      includeSymbols: false,
      excludeSimilar: true,
      excludeChars: "ABCxyz9",
      length: 24,
    });

    expect(/[Il1O0o]/.test(password)).toBe(false);
    expect(/[ABCxyz9]/.test(password)).toBe(false);
  });

  it("validates bulk count bounds", () => {
    expect(() => generatePasswords(strongOptions, 0)).toThrow(
      /between 1 and 200/,
    );
    expect(() => generatePasswords(strongOptions, 201)).toThrow(
      /between 1 and 200/,
    );
    expect(generatePasswords(strongOptions, 3)).toHaveLength(3);
  });

  it("estimates entropy", () => {
    expect(estimateEntropyBits(strongOptions)).toBeGreaterThan(0);
    expect(
      estimateEntropyBits({
        ...strongOptions,
        includeUppercase: false,
        includeLowercase: false,
        includeNumbers: false,
        includeSymbols: false,
      }),
    ).toBe(0);
  });
});
