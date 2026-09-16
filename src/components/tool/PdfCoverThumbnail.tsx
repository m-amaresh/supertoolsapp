"use client";

import { useEffect, useRef } from "react";
import { usePdfDocument } from "@/hooks/usePdfDocument";
import { COVER_WIDTH } from "@/lib/pdf-preview";
import { cn } from "@/lib/utils";
import { PdfPageCanvas } from "./PdfPageCanvas";

/**
 * The first page of a document, small enough to sit in a list row.
 *
 * The merger asks a different question from the splitter. There it is "which
 * pages do I want?", answered by a contact sheet; here it is "is this the
 * right document, and is it in the right place?", which one cover and a page
 * count answer — however long the file is. Fifty queued documents cost fifty
 * rendered pages, not fifty documents' worth.
 *
 * Failing is quiet on purpose. A file this cannot open may still merge
 * perfectly well — qpdf reads things pdf.js will not — so a missing cover
 * leaves the row's name and size exactly as they were, and the merge itself
 * reports any real problem.
 */
interface PdfCoverThumbnailProps {
  /**
   * The document to show, or null to leave the frame empty without opening
   * anything. Callers pass null for a file they have decided not to read —
   * one too large to load, say — so the row keeps its shape without the
   * component having to know why.
   */
  file: File | null;
  /**
   * Called with the page count once the document opens, and with null when it
   * cannot be read. The caller owns that number: it belongs beside the file
   * size in the row, not inside this component.
   */
  onPageCount?: (pageCount: number | null) => void;
  className?: string;
}

export function PdfCoverThumbnail({
  file,
  onPageCount,
  className,
}: PdfCoverThumbnailProps) {
  const { status, pageCount, documentRef } = usePdfDocument(file);

  // Reported through an effect rather than the hook's own callback so the
  // caller may pass a freshly-built function without reopening the document
  // on every render of the list.
  const onPageCountRef = useRef(onPageCount);
  useEffect(() => {
    onPageCountRef.current = onPageCount;
  }, [onPageCount]);

  useEffect(() => {
    if (status === "ready") onPageCountRef.current?.(pageCount);
    if (status === "failed") onPageCountRef.current?.(null);
  }, [status, pageCount]);

  const frame = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-background",
    className,
  );
  const size = { width: COVER_WIDTH, height: Math.round(COVER_WIDTH * 1.3) };

  // An empty frame of the same size while loading, or when the page will not
  // draw, so a row never changes height under the reorder buttons.
  if (status !== "ready") {
    return <div className={frame} style={size} aria-hidden="true" />;
  }

  return (
    <PdfPageCanvas
      documentRef={documentRef}
      pageNumber={1}
      width={COVER_WIDTH}
      className={frame}
      style={size}
    />
  );
}
