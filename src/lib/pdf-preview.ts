/**
 * Pure helpers for the PDF page preview.
 *
 * Rendering itself needs pdf.js, a canvas and a live document, none of which
 * belong in a unit test. What *is* testable — how many thumbnails to draw, how
 * big to draw them, which pages to light up, and what a failure should say —
 * lives here, so the component is left doing only the parts that genuinely
 * need a browser.
 *
 * pdf.js is used for the preview and for the page count; qpdf still performs
 * the split. The two agree on page counts for any file either can open, and
 * where they somehow would not, `classifyQpdfError` already turns qpdf's "out
 * of range" into a range error the reader can act on.
 */

/**
 * Most thumbnails to draw for one document.
 *
 * Matches `MAX_SPLIT_OUTPUTS`: past a couple of hundred pages a contact sheet
 * stops being something anyone reads, and every thumbnail is a canvas the tab
 * has to keep. A longer document still splits fine — only the preview is
 * capped, and `previewNotice` says so rather than letting the grid just stop.
 */
export const MAX_PREVIEW_PAGES = 200;

/** Width each thumbnail is rendered at, in CSS pixels. */
export const THUMBNAIL_WIDTH = 120;

/** Pages that get a thumbnail, in order. */
export function previewPageNumbers(
  pageCount: number,
  cap = MAX_PREVIEW_PAGES,
): number[] {
  if (pageCount < 1) return [];
  const shown = Math.min(pageCount, cap);
  return Array.from({ length: shown }, (_, index) => index + 1);
}

/** Sentence shown when the document is longer than the preview cap. */
export function previewNotice(
  pageCount: number,
  cap = MAX_PREVIEW_PAGES,
): string | null {
  if (pageCount <= cap) return null;
  return `Showing the first ${cap} of ${pageCount} pages. Pages beyond ${cap} can still be selected by typing their numbers.`;
}

/**
 * Scale to pass pdf.js so a page comes out `targetWidth` CSS pixels wide.
 *
 * `pageWidth` is the width of the page's own unscaled viewport, which varies
 * per page — a landscape insert in a portrait document is the usual case, and
 * scaling every page by one factor would make it overflow its cell.
 */
export function thumbnailScale(
  pageWidth: number,
  targetWidth = THUMBNAIL_WIDTH,
): number {
  if (!Number.isFinite(pageWidth) || pageWidth <= 0) return 1;
  return targetWidth / pageWidth;
}

/**
 * Pages to highlight, as a set for lookup.
 *
 * A selection may name the same page more than once and may run backwards;
 * neither matters for highlighting, where the only question a thumbnail asks
 * is "am I in it?".
 */
export function highlightSet(pages: number[] | null): Set<number> {
  return new Set(pages ?? []);
}

/**
 * Turn a pdf.js failure into something worth reading.
 *
 * Only the cases a reader can act on are named. Anything else keeps the
 * preview quiet and lets the tool carry on without it — a thumbnail grid is
 * an aid, and losing it should never take the splitter down with it.
 */
export function classifyPreviewError(error: unknown): {
  /** True when the document is protected, which the tool refuses outright. */
  encrypted: boolean;
  message: string;
} {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  const text = error instanceof Error ? error.message : String(error);

  if (name === "PasswordException" || /password/i.test(text)) {
    return {
      encrypted: true,
      message:
        "This PDF is password-protected. Splitting it would drop that protection from every piece, so remove the password first with the PDF Password Remover.",
    };
  }

  if (name === "InvalidPDFException" || /invalid pdf/i.test(text)) {
    return {
      encrypted: false,
      message: "This PDF appears to be damaged and could not be read.",
    };
  }

  return {
    encrypted: false,
    message: "Page previews are unavailable for this file.",
  };
}
