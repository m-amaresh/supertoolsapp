"use client";

import { useEffect, useRef, useState } from "react";
import type { PdfDocumentProxy } from "@/hooks/usePdfDocument";
import { THUMBNAIL_WIDTH, thumbnailScale } from "@/lib/pdf-preview";

/**
 * One page of a PDF, rasterised into a canvas when it comes into view.
 *
 * Drawing on approach rather than on mount is what keeps a long document
 * cheap: a 200-page contact sheet, or a queue of 50 files each showing its
 * cover, only ever paints the rows somebody has actually scrolled to.
 *
 * The page it draws is decorative — whatever labels it (a page number, a
 * filename) is the caller's business and carries the meaning — so the canvas
 * is hidden from assistive technology by its wrapper here rather than leaving
 * each caller to remember.
 */
interface PdfPageCanvasProps {
  documentRef: React.RefObject<PdfDocumentProxy | null>;
  pageNumber: number;
  /** Rendered width in CSS pixels. */
  width?: number;
  className?: string;
  /** Sizes the frame before the page is drawn, so the layout does not jump. */
  style?: React.CSSProperties;
}

export function PdfPageCanvas({
  documentRef,
  pageNumber,
  width = THUMBNAIL_WIDTH,
  className,
  style,
}: PdfPageCanvasProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * Draw once, then stop observing.
   *
   * Note what this relies on: a canvas is never re-pointed at a *different*
   * document. `documentRef` is a ref, so swapping the document behind it is
   * invisible here, and a stale thumbnail would survive. Callers avoid that by
   * unmounting these while a new document loads — both do, by rendering the
   * grid only once the document is ready. A caller that kept them mounted
   * across a file change would need to key them on the file.
   */
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || drawn) return;

    let cancelled = false;
    let task: { promise: Promise<void>; cancel: () => void } | null = null;

    const draw = async () => {
      const source = documentRef.current;
      const canvas = canvasRef.current;
      if (!source || !canvas) return;

      try {
        const page = await source.getPage(pageNumber);
        if (cancelled) return;

        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({
          scale: thumbnailScale(base.width, width),
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
        // A page that will not draw leaves an empty frame with whatever the
        // caller labelled it with still in place. Nothing else is affected.
      }
    };

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
  }, [documentRef, drawn, pageNumber, width]);

  return (
    <div
      ref={holderRef}
      className={className}
      style={style}
      // The rendered page is decorative; the caller's label carries the
      // meaning. Hidden on the wrapper rather than the canvas, which is
      // focusable and so must not be aria-hidden.
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
