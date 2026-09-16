"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  classifyPreviewError,
  highlightSet,
  previewNotice,
  previewPageNumbers,
  THUMBNAIL_WIDTH,
  thumbnailScale,
} from "@/lib/pdf-preview";
import { cn } from "@/lib/utils";

/**
 * A contact sheet of a PDF's pages, with the current selection lit up.
 *
 * The point is to answer "is this range what I meant?" without decoding the
 * range grammar. `x`, `z` and backwards runs all do something hard to picture
 * from the spec alone; seeing four pages go dark says it immediately.
 *
 * Highlighting is one-way, from the typed range to the page. Clicking a
 * thumbnail deliberately does nothing: a set of clicked pages cannot express a
 * reversed range or a repeated page, both of which this tool supports, so a
 * two-way binding would have to silently discard selections the reader had
 * already typed.
 *
 * pdf.js is imported dynamically, so the ~1.6 MB renderer is fetched when
 * someone actually picks a file rather than on every visit to the page. Pages
 * rasterise as they scroll into view, so a 200-page document does not draw 200
 * canvases up front.
 */

/** pdf.js types, kept local so the module's own types stay out of the bundle. */
interface PdfPageProxy {
  getViewport: (options: { scale: number }) => {
    width: number;
    height: number;
  };
  render: (options: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void>; cancel: () => void };
  cleanup: () => void;
}

interface PdfDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void>;
}

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
  className?: string;
}

type Status = "idle" | "loading" | "ready" | "failed";

export function PdfPagePreview({
  file,
  selected,
  onLoaded,
  onFailed,
  className,
}: PdfPagePreviewProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [pageCount, setPageCount] = useState(0);
  const documentRef = useRef<PdfDocumentProxy | null>(null);

  /**
   * The callbacks are held in refs so the loading effect depends only on the
   * file. A parent that rebuilds them each render would otherwise re-open the
   * document — and re-fetch pdf.js — on every keystroke in the range field.
   */
  const onLoadedRef = useRef(onLoaded);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
    onFailedRef.current = onFailed;
  }, [onLoaded, onFailed]);

  useEffect(() => {
    let cancelled = false;

    // Tear down whatever the previous file left behind before anything else,
    // so two documents are never live at once.
    const previous = documentRef.current;
    documentRef.current = null;
    void previous?.destroy().catch(() => {
      // Destroying an already-dead document is not a failure worth reporting.
    });

    if (!file) {
      setStatus("idle");
      setPageCount(0);
      return;
    }

    setStatus("loading");

    void (async () => {
      try {
        // Dynamic, so the renderer is fetched on first use rather than being
        // part of the page's own bundle.
        const pdfjs = await import("pdfjs-dist");
        // Served from public/pdfjs/ rather than public/pdf/: pdf.js needs
        // neither WebAssembly nor eval, so it has no business inheriting the
        // relaxed policy that directory carries for qpdf. See next.config.ts
        // and scripts/copy-pdfjs-worker.mjs.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

        const bytes = new Uint8Array(await file.arrayBuffer());
        if (cancelled) return;

        const task = pdfjs.getDocument({
          data: bytes,
          // The preview never needs to look anything up over the network, and
          // connect-src 'self' would block it if it tried.
          disableAutoFetch: true,
          disableStream: true,
        });
        const document = (await task.promise) as unknown as PdfDocumentProxy;

        if (cancelled) {
          void document.destroy().catch(() => {});
          return;
        }

        documentRef.current = document;
        setPageCount(document.numPages);
        setStatus("ready");
        onLoadedRef.current(document.numPages);
      } catch (error) {
        if (cancelled) return;
        setStatus("failed");
        setPageCount(0);
        const { message, encrypted } = classifyPreviewError(error);
        onFailedRef.current(message, encrypted);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  // Drop the document when the component goes away, so its worker and buffers
  // do not outlive the page.
  useEffect(() => {
    return () => {
      void documentRef.current?.destroy().catch(() => {});
      documentRef.current = null;
    };
  }, []);

  const highlighted = useMemo(() => highlightSet(selected), [selected]);
  const pages = useMemo(() => previewPageNumbers(pageCount), [pageCount]);
  const notice = useMemo(() => previewNotice(pageCount), [pageCount]);

  if (status === "idle" || status === "failed") return null;

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold tracking-wide text-muted-foreground">
          {status === "loading"
            ? "Reading pages…"
            : `${pageCount} ${pageCount === 1 ? "page" : "pages"}`}
        </span>
        {status === "ready" && selected && selected.length > 0 && (
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
            {pages.map((pageNumber) => (
              <PageThumbnail
                key={pageNumber}
                pageNumber={pageNumber}
                documentRef={documentRef}
                selected={highlighted.has(pageNumber)}
                dimmed={selected !== null && selected.length > 0}
              />
            ))}
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

interface PageThumbnailProps {
  pageNumber: number;
  documentRef: React.RefObject<PdfDocumentProxy | null>;
  selected: boolean;
  /** True once a selection exists, so unselected pages can recede. */
  dimmed: boolean;
}

function PageThumbnail({
  pageNumber,
  documentRef,
  selected,
  dimmed,
}: PageThumbnailProps) {
  const holderRef = useRef<HTMLLIElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || drawn) return;

    let cancelled = false;
    let task: { promise: Promise<void>; cancel: () => void } | null = null;

    const draw = async () => {
      const document = documentRef.current;
      const canvas = canvasRef.current;
      if (!document || !canvas) return;

      try {
        const page = await document.getPage(pageNumber);
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: thumbnailScale(base.width),
        });

        // Draw at the device's pixel density, or thumbnails are visibly soft
        // on a retina screen, while the CSS box stays the layout size.
        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const context = canvas.getContext("2d");
        if (!context) return;
        context.scale(ratio, ratio);

        task = page.render({ canvas, canvasContext: context, viewport });
        await task.promise;
        if (cancelled) return;
        page.cleanup();
        setDrawn(true);
      } catch {
        // A page that will not draw leaves an empty frame with its number
        // still under it. The range it belongs to is unaffected.
      }
    };

    // Rasterise on approach rather than on mount, so a long document does not
    // draw every page the moment it opens.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void draw();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(holder);

    return () => {
      cancelled = true;
      observer.disconnect();
      task?.cancel();
    };
  }, [documentRef, drawn, pageNumber]);

  return (
    <li
      ref={holderRef}
      className="flex flex-col items-center gap-1"
      // Exposed as data rather than left to a Tailwind class, so a test can
      // ask which pages are lit without asserting on styling.
      data-page={pageNumber}
      data-selected={selected ? "true" : "false"}
    >
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-sm border bg-background transition-opacity",
          selected ? "border-ring ring-2 ring-ring" : "border-border",
          dimmed && !selected && "opacity-40",
        )}
        style={{ minWidth: THUMBNAIL_WIDTH, minHeight: THUMBNAIL_WIDTH * 1.2 }}
        // The rendered page is decorative: the number below it carries the
        // meaning, and which pages are selected is already announced by the
        // tool's live region. Hidden on the wrapper rather than the canvas,
        // which is focusable and so must not be aria-hidden.
        aria-hidden="true"
      >
        <canvas ref={canvasRef} />
      </div>
      <span
        className={cn(
          "text-[11px] tabular-nums",
          selected ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
      >
        {pageNumber}
      </span>
    </li>
  );
}
