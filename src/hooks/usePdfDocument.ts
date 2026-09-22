"use client";

import { useEffect, useRef, useState } from "react";
import { classifyPreviewError } from "@/lib/pdf-preview";

/**
 * Opens a PDF with pdf.js and keeps its lifetime tidy.
 *
 * Extracted when the merger needed cover thumbnails: both tools have to load a
 * document, hold it while pages are drawn, and release it — and this is
 * precisely the code that has gone wrong twice. A failed load leaked the
 * worker its loading task owned, and a late rejection destroyed the task
 * belonging to a *newer* file, taking down the replacement's preview. Neither
 * is the sort of thing worth having two copies of.
 *
 * pdf.js is imported dynamically, so the ~1.6 MB renderer is fetched when
 * someone actually picks a file rather than on every visit to the page.
 */

/** pdf.js types, kept local so the module's own types stay out of the bundle. */
export interface PdfPageProxy {
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

export interface PdfDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
}

/**
 * The handle pdf.js returns before a document exists.
 *
 * It owns the worker, so it — not just the document — is what has to be
 * destroyed. A load that *fails* never produces a document, and releasing only
 * documents leaked a worker per failure: three malformed files left three live
 * workers behind, Clear included.
 */
export interface PdfLoadingTask {
  promise: Promise<unknown>;
  destroy: () => Promise<void>;
}

/**
 * Releases a loading task, and with it the document and worker it owns.
 *
 * The task is the only thing worth destroying: `PDFDocumentProxy` has no
 * `destroy` of its own in pdf.js 6 — calling one threw "destroy is not a
 * function" the moment a successfully opened document was replaced or its
 * page left, which a trailing `.catch()` cannot help with because the throw
 * happens before there is a promise to reject.
 *
 * Wrapped rather than trusted, because this is a third-party shape that has
 * already changed once: releasing is best-effort, and a teardown must never be
 * the thing that breaks a page.
 */
function releaseTask(task: PdfLoadingTask | null): void {
  if (!task) return;
  try {
    void Promise.resolve(task.destroy()).catch(() => {});
  } catch {
    // Teardown may fail if the task is already gone or pdf.js changes its API.
  }
}

export type PdfDocumentStatus = "idle" | "loading" | "ready" | "failed";

interface UsePdfDocumentOptions {
  /** Called with the page count once the document opens. */
  onLoaded?: (pageCount: number) => void;
  /**
   * Called when the document cannot be opened. `encrypted` marks the one
   * failure that is the calling tool's business rather than the preview's, so
   * it can refuse the file instead of merely losing its thumbnails.
   */
  onFailed?: (message: string, encrypted: boolean) => void;
}

export interface UsePdfDocumentResult {
  status: PdfDocumentStatus;
  /** Pages in the open document, or 0 when there is none. */
  pageCount: number;
  /**
   * The open document, by ref rather than state.
   *
   * Drawing a page is a side effect that reads the document at the moment it
   * runs; putting the proxy in state would re-render every thumbnail each time
   * a document opened, for no gain.
   */
  documentRef: React.RefObject<PdfDocumentProxy | null>;
}

export function usePdfDocument(
  file: File | null,
  { onLoaded, onFailed }: UsePdfDocumentOptions = {},
): UsePdfDocumentResult {
  const [status, setStatus] = useState<PdfDocumentStatus>("idle");
  const [pageCount, setPageCount] = useState(0);
  const documentRef = useRef<PdfDocumentProxy | null>(null);
  const taskRef = useRef<PdfLoadingTask | null>(null);

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

    // Release the previous loading task and its worker, even if it never opened.
    const previousTask = taskRef.current;
    documentRef.current = null;
    taskRef.current = null;
    releaseTask(previousTask);

    if (!file) {
      setStatus("idle");
      setPageCount(0);
      return;
    }

    setStatus("loading");

    void (async () => {
      // Hold this attempt's task locally: a late rejection must not destroy a
      // newer task now stored in the shared ref.
      let ownTask: PdfLoadingTask | null = null;
      try {
        // Load the renderer only when a preview is opened.
        const pdfjs = await import("pdfjs-dist");
        // /pdfjs/ keeps this worker outside qpdf's relaxed /pdf/ CSP.
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

        const bytes = new Uint8Array(await file.arrayBuffer());
        if (cancelled) return;

        const task = pdfjs.getDocument({
          data: bytes,
          // The full file is already in memory; disable further range/stream reads.
          disableAutoFetch: true,
          disableStream: true,
        }) as unknown as PdfLoadingTask;
        // Keep the loading task even if awaiting its document rejects.
        ownTask = task;
        taskRef.current = task;

        const opened = (await task.promise) as unknown as PdfDocumentProxy;

        if (cancelled) {
          releaseTask(ownTask);
          if (taskRef.current === ownTask) taskRef.current = null;
          return;
        }

        documentRef.current = opened;
        setPageCount(opened.numPages);
        setStatus("ready");
        onLoadedRef.current?.(opened.numPages);
      } catch (error) {
        // Release this task without disturbing a newer task in the shared ref.
        releaseTask(ownTask);
        if (taskRef.current === ownTask) taskRef.current = null;
        if (cancelled) return;
        setStatus("failed");
        setPageCount(0);
        const { message, encrypted } = classifyPreviewError(error);
        onFailedRef.current?.(message, encrypted);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    return () => {
      documentRef.current = null;
      releaseTask(taskRef.current);
      taskRef.current = null;
    };
  }, []);

  return { status, pageCount, documentRef };
}
