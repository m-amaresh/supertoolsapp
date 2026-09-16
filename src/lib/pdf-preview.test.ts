import { describe, expect, it } from "vitest";
import {
  classifyPreviewError,
  highlightSet,
  MAX_PREVIEW_PAGES,
  previewNotice,
  previewPageNumbers,
  THUMBNAIL_WIDTH,
  thumbnailScale,
} from "./pdf-preview";

describe("pdf-preview: which pages get a thumbnail", () => {
  it("lists every page of a short document", () => {
    expect(previewPageNumbers(3)).toEqual([1, 2, 3]);
  });

  it("starts at page 1, not 0", () => {
    expect(previewPageNumbers(1)).toEqual([1]);
  });

  it("returns nothing for an empty document", () => {
    expect(previewPageNumbers(0)).toEqual([]);
    expect(previewPageNumbers(-4)).toEqual([]);
  });

  it("stops at the cap", () => {
    expect(previewPageNumbers(500, 10)).toHaveLength(10);
    expect(previewPageNumbers(500, 10).at(-1)).toBe(10);
  });

  it("caps at MAX_PREVIEW_PAGES by default", () => {
    expect(previewPageNumbers(MAX_PREVIEW_PAGES + 50)).toHaveLength(
      MAX_PREVIEW_PAGES,
    );
  });
});

describe("pdf-preview: the truncation notice", () => {
  it("stays quiet when every page is shown", () => {
    expect(previewNotice(10)).toBeNull();
    expect(previewNotice(MAX_PREVIEW_PAGES)).toBeNull();
  });

  it("says how many were shown and that the rest are still selectable", () => {
    const notice = previewNotice(500, 200);
    expect(notice).toContain("first 200 of 500");
    expect(notice).toContain("can still be selected");
  });
});

describe("pdf-preview: thumbnail scaling", () => {
  it("scales a page down to the target width", () => {
    expect(thumbnailScale(600, 120)).toBeCloseTo(0.2);
  });

  it("scales a narrow page up", () => {
    expect(thumbnailScale(60, 120)).toBeCloseTo(2);
  });

  it("uses the default target width", () => {
    expect(thumbnailScale(THUMBNAIL_WIDTH)).toBeCloseTo(1);
  });

  it("falls back to 1 for a nonsense width, rather than dividing by zero", () => {
    expect(thumbnailScale(0)).toBe(1);
    expect(thumbnailScale(-10)).toBe(1);
    expect(thumbnailScale(Number.NaN)).toBe(1);
  });
});

describe("pdf-preview: highlight lookup", () => {
  it("builds a set from the selection", () => {
    expect([...highlightSet([1, 3, 5])]).toEqual([1, 3, 5]);
  });

  it("collapses repeats, which do not matter for highlighting", () => {
    expect(highlightSet([1, 1, 2]).size).toBe(2);
  });

  it("ignores order, which does not matter either", () => {
    expect(highlightSet([3, 2, 1]).has(2)).toBe(true);
  });

  it("treats no selection as nothing highlighted", () => {
    expect(highlightSet(null).size).toBe(0);
  });
});

describe("pdf-preview: failure classification", () => {
  it("flags a protected document as the tool's business", () => {
    const result = classifyPreviewError({
      name: "PasswordException",
      message: "No password given",
    });
    expect(result.encrypted).toBe(true);
    expect(result.message).toContain("PDF Password Remover");
  });

  it("recognises a password complaint without the exception name", () => {
    expect(classifyPreviewError(new Error("Password required")).encrypted).toBe(
      true,
    );
  });

  it("names a damaged file", () => {
    const result = classifyPreviewError({
      name: "InvalidPDFException",
      message: "Invalid PDF structure",
    });
    expect(result.encrypted).toBe(false);
    expect(result.message).toContain("damaged");
  });

  it("keeps anything else quiet, so the splitter carries on without previews", () => {
    const result = classifyPreviewError(new Error("worker died"));
    expect(result.encrypted).toBe(false);
    expect(result.message).toContain("Page previews are unavailable");
  });

  it("survives a thrown non-error", () => {
    expect(classifyPreviewError("something odd").encrypted).toBe(false);
    expect(classifyPreviewError(null).encrypted).toBe(false);
  });
});
