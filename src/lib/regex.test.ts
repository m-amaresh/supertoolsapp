import { describe, expect, it } from "vitest";
import {
  regexFlagStateFromFlags,
  regexFlagsToString,
  regexPresets,
} from "./regex";

describe("regex flags", () => {
  it("preserves unicode flags from presets", () => {
    const hashtagPreset = regexPresets.find(
      (preset) => preset.name === "Hashtag",
    );

    if (!hashtagPreset) {
      throw new Error("Hashtag preset not found");
    }

    const flagState = regexFlagStateFromFlags(hashtagPreset.flags);

    expect(flagState).toEqual({
      g: true,
      i: false,
      m: false,
      s: false,
      u: true,
    });
    expect(regexFlagsToString(flagState)).toBe("gu");
  });
});
