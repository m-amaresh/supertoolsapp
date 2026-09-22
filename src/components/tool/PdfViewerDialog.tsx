"use client";

import { faChevronLeft } from "@fortawesome/free-solid-svg-icons/faChevronLeft";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons/faChevronRight";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePdfDocument } from "@/hooks/usePdfDocument";
import { PdfPageCanvas } from "./PdfPageCanvas";

/**
 * Reads a PDF at a size worth reading.
 *
 * The thumbnails in both tools say *which* document and *which* pages; neither
 * is large enough to tell you what a page actually says. This is the answer to
 * that — one page fitted to the window, with the keyboard doing what a reader
 * expects.
 *
 * The document is opened separately from the grid that launched it, which
 * costs a second parse of the same file. That is deliberate: sharing one would
 * mean the grid could not release its document while a viewer was open, and
 * the lifetime rules are the part of this code that has already gone wrong
 * twice. A viewer that owns what it opens cannot get that wrong.
 */
const VIEWER_WIDTH = 900;

interface PdfViewerDialogProps {
  /** Null closes the dialog. */
  file: File | null;
  /** One-based page number. */
  initialPage?: number;
  onClose: () => void;
}

export function PdfViewerDialog({
  file,
  initialPage = 1,
  onClose,
}: PdfViewerDialogProps) {
  const { status, pageCount, documentRef } = usePdfDocument(file);
  const [page, setPage] = useState(initialPage);

  /**
   * Whatever had focus when the reader opened, so it can have it back.
   *
   * Radix returns focus to a `DialogTrigger` on close — and to nothing at all
   * when there is none. This dialog is opened from many thumbnails through
   * state rather than a single trigger, so without this a keyboard user who
   * read a page was dropped at the top of the document afterwards. Captured
   * in a layout effect: that runs before Radix's own effect moves focus into
   * the dialog, so the element recorded is the one that was clicked.
   */
  const openerRef = useRef<HTMLElement | null>(null);
  const open = file !== null;
  useLayoutEffect(() => {
    if (open) {
      const active = document.activeElement;
      openerRef.current = active instanceof HTMLElement ? active : null;
    }
  }, [open]);

  /**
   * Every opening starts where the caller asked, not where the last visit
   * ended.
   *
   * Keyed on the file as well as the page: depending on `initialPage` alone
   * meant reopening at the same requested page — page 1, almost always — did
   * not reset at all, so a one-page document could open on "Page 3 of 1" with
   * nothing drawn because the last document had been left on page 3.
   */
  useEffect(() => {
    if (file) setPage(initialPage);
  }, [file, initialPage]);

  // Once the length is known, a page past the end is pulled back to the last
  // one rather than left pointing at nothing.
  useEffect(() => {
    if (status !== "ready") return;
    setPage((current) => Math.min(Math.max(current, 1), pageCount));
  }, [status, pageCount]);

  const ready = status === "ready";
  const go = useCallback(
    (delta: number) => {
      // Not before the document is open: with the count still zero the only
      // reachable page is 1, so a keypress during "Opening…" silently threw
      // away the page that had been asked for.
      if (!ready) return;
      setPage((current) => Math.min(Math.max(current + delta, 1), pageCount));
    },
    [pageCount, ready],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(-1);
      }
    },
    [go],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        // A fixed height rather than the wrapper's max-height, for two
        // reasons. A reader should keep one frame as pages of different
        // shapes go by, instead of resizing around each. And the page can only
        // be fitted to the frame's height if that height is definite: a
        // max-height alone leaves every percentage below it unresolved, and
        // the page overflowed by exactly the amount this was meant to prevent.
        className="h-[92vh]"
        onKeyDown={handleKeyDown}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <DialogTitle>{file?.name ?? "PDF"}</DialogTitle>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon-sm">
              <FontAwesomeIcon
                icon={faXmark}
                className="h-3 w-3"
                aria-hidden="true"
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {/* items-start, not items-center: a flex container centres an
            oversized child by pushing its top above the scroll origin, where
            no amount of scrolling can reach it. The page is also fitted to
            the container's height, so in practice it does not overflow — the
            alignment is the guarantee for when it somehow still does. */}
        <div className="flex min-h-[40vh] flex-1 items-start justify-center overflow-auto rounded-md border border-border bg-muted/20 p-3">
          {status === "ready" ? (
            <PdfPageCanvas
              // Keyed on the page so each one mounts fresh. `PdfPageCanvas`
              // draws once and then stops observing, so re-pointing a live
              // instance at another page would leave the first one showing.
              key={`${page}`}
              documentRef={documentRef}
              pageNumber={page}
              width={VIEWER_WIDTH}
              eager
              fit
              className="flex h-full w-full items-start justify-center"
            />
          ) : (
            <span className="text-[13px] text-muted-foreground">
              {status === "failed"
                ? "This PDF could not be displayed."
                : "Opening…"}
            </span>
          )}
        </div>

        {status === "ready" && (
          <div className="flex items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => go(-1)}
              disabled={page <= 1}
            >
              <FontAwesomeIcon
                icon={faChevronLeft}
                className="h-3 w-3"
                aria-hidden="true"
              />
              Previous
            </Button>
            {/* Announced as a unit, so moving between pages reads as one
                sentence rather than a bare number changing. */}
            <span
              className="text-[13px] tabular-nums text-muted-foreground"
              aria-live="polite"
            >
              Page {page} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => go(1)}
              disabled={page >= pageCount}
            >
              Next
              <FontAwesomeIcon
                icon={faChevronRight}
                className="h-3 w-3"
                aria-hidden="true"
              />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
