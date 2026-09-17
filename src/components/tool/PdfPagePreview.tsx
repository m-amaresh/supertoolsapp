"use client";

import { useMemo } from "react";
import { usePdfDocument } from "@/hooks/usePdfDocument";
import {
  highlightSet,
  previewNotice,
  previewPageNumbers,
  THUMBNAIL_WIDTH,
} from "@/lib/pdf-preview";
import { cn } from "@/lib/utils";
import { PdfPageCanvas } from "./PdfPageCanvas";

/**
 * A contact sheet of a PDF's pages, with the current selection lit up.
 *
 * The point is to answer "is this range what I meant?" without decoding the
 * range grammar. `x`, `z` and backwards runs all do something hard to picture
 * from the spec alone; seeing four pages go dark says it immediately.
 *
 * Highlighting is one-way, from the typed range to the page. Clicking a
 * thumbnail opens it to read; it deliberately does *not* toggle selection. A
 * set of clicked pages cannot express a reversed range or a repeated page,
 * both of which this tool supports, so a two-way binding would have to
 * silently discard selections the reader had already typed.
 *
 * Opening and releasing the document is `usePdfDocument`'s job and drawing a
 * page is `PdfPageCanvas`'s, so what is left here is the grid and the
 * highlighting.
 */
interface PdfPagePreviewProps {
  /** The document to show. Null clears the grid. */
  file: File | null;
  /** Pages to highlight; null highlights nothing. */
  selected: number[] | null;
  /** Called with the page count once the document opens. */
  onLoaded: (pageCount: number) => void;
  /**
   * Called when the document cannot be previewed. `encrypted` marks the one
   * failure that is the tool's business rather than the preview's, so the page
   * can refuse the file instead of merely losing its thumbnails.
   */
  onFailed: (message: string, encrypted: boolean) => void;
  /**
   * Called with a page number when its thumbnail is activated. A thumbnail
   * says which page; this is how the reader gets to see what is on it.
   */
  onOpenPage?: (pageNumber: number) => void;
  className?: string;
}

export function PdfPagePreview({
  file,
  selected,
  onLoaded,
  onFailed,
  onOpenPage,
  className,
}: PdfPagePreviewProps) {
  const { status, pageCount, documentRef } = usePdfDocument(file, {
    onLoaded,
    onFailed,
  });

  const highlighted = useMemo(() => highlightSet(selected), [selected]);
  const pages = useMemo(() => previewPageNumbers(pageCount), [pageCount]);
  const notice = useMemo(() => previewNotice(pageCount), [pageCount]);

  if (status === "idle" || status === "failed") return null;

  const dimmed = selected !== null && selected.length > 0;

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold tracking-wide text-muted-foreground">
          {status === "loading"
            ? "Reading pages…"
            : `${pageCount} ${pageCount === 1 ? "page" : "pages"}`}
        </span>
        {status === "ready" && dimmed && (
          <span className="text-[12px] text-muted-foreground">
            Highlighted pages are the ones you will get.
          </span>
        )}
      </div>

      {status === "ready" && (
        <>
          <ul
            className="grid max-h-[420px] grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3 overflow-y-auto rounded-md border border-border bg-muted/20 p-3"
            // A handle for tests. The thumbnails observe the viewport, not
            // this element — but because the grid clips its own overflow, a
            // row scrolled out of it stops intersecting the viewport too, so
            // off-screen pages still wait to be drawn.
            data-slot="pdf-page-preview"
          >
            {pages.map((pageNumber) => {
              const isSelected = highlighted.has(pageNumber);
              return (
                <li
                  key={pageNumber}
                  className="flex flex-col items-center gap-1"
                  // Exposed as data rather than left to a Tailwind class, so a
                  // test can ask which pages are lit without asserting on
                  // styling.
                  data-page={pageNumber}
                  data-selected={isSelected ? "true" : "false"}
                >
                  {/* A real button, so the page is reachable from the
                      keyboard and announced as something that opens. */}
                  <button
                    type="button"
                    onClick={() => onOpenPage?.(pageNumber)}
                    aria-label={`Open page ${pageNumber}`}
                    className={cn(
                      "flex cursor-pointer items-center justify-center overflow-hidden rounded-sm border bg-background transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      isSelected
                        ? "border-ring ring-2 ring-ring"
                        : "border-border hover:border-ring/60",
                      dimmed && !isSelected && "opacity-40 hover:opacity-70",
                    )}
                    style={{
                      minWidth: THUMBNAIL_WIDTH,
                      minHeight: THUMBNAIL_WIDTH * 1.2,
                    }}
                  >
                    <PdfPageCanvas
                      documentRef={documentRef}
                      pageNumber={pageNumber}
                    />
                  </button>
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      isSelected
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {pageNumber}
                  </span>
                </li>
              );
            })}
          </ul>
          {notice && (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {notice}
            </p>
          )}
        </>
      )}
    </div>
  );
}
