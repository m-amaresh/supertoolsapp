"use client";

import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload";
import { faFilePdf } from "@fortawesome/free-solid-svg-icons/faFilePdf";
import { faScissors } from "@fortawesome/free-solid-svg-icons/faScissors";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { SegmentedControl, ToolbarGroup } from "@/components/Toolbar";
import { PdfPagePreview } from "@/components/tool/PdfPagePreview";
import { PdfViewerDialog } from "@/components/tool/PdfViewerDialog";
import {
  ToolBody,
  ToolCard,
  ToolFootnote,
  ToolHeader,
  ToolHint,
  ToolLabel,
  ToolLiveRegion,
  ToolMeta,
  ToolOptionsBar,
  ToolPage,
  ToolStatusStack,
  ToolToolbar,
} from "@/components/tool/ToolScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  archiveFileName,
  buildChunkArgs,
  buildExtractArgs,
  chunkCount,
  declaresEncryption,
  describeResult,
  formatBytes,
  interpretWorkerResponse,
  MAX_PDF_BYTES,
  type PdfSplitMode,
  type PdfSplitWorkerResponse,
  parsePageRange,
  SPLIT_INPUT_PATH,
  SPLIT_OUTPUT_PATH,
  summarizePages,
  validateChunkSize,
  validateRequest,
  validateRequestMetadata,
} from "@/lib/pdf-split";

/** Static path, not a bundled chunk — see the comment in `runSplit`. */
const WORKER_URL = "/pdf/qpdf-split-worker.js";

const modeOptions: { value: PdfSplitMode; label: string }[] = [
  { value: "extract", label: "Extract pages" },
  { value: "chunks", label: "Split into files" },
];

interface ResultPiece {
  name: string;
  url: string;
  size: number;
  /**
   * The Blob behind `url`, kept so the archive can be built from it.
   *
   * Not re-fetched from the blob URL: the app serves a strict
   * `connect-src 'self'`, which blocks fetch and XHR against `blob:`. Holding
   * the reference costs nothing — the Blob exists either way — and reading it
   * back goes nowhere near the network.
   */
  blob: Blob;
}

interface SplitResult {
  pieces: ResultPiece[];
  /** Non-fatal qpdf warnings, e.g. a repaired cross-reference table. */
  warnings: string[];
}

export default function PdfSplitTool() {
  const [file, setFile] = useState<File | null>(null);
  /**
   * The document the preview may open, which is not always the one on screen.
   *
   * A refused file still has its name shown beside the error, but must never
   * reach the renderer: pdf.js opens an owner-password document quite happily,
   * would report a page count, and that count re-enables every field — so the
   * refusal would be displayed and not enforced. Keeping the two apart makes
   * that impossible rather than merely unlikely.
   */
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [mode, setMode] = useState<PdfSplitMode>("extract");
  const [spec, setSpec] = useState("");
  const [chunkSize, setChunkSize] = useState("1");
  const [isWorking, setIsWorking] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [result, setResult] = useState<SplitResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  /** Page open in the reader, or null when it is closed. */
  const [viewerPage, setViewerPage] = useState<number | null>(null);

  const workerRef = useRef<Worker | null>(null);
  /**
   * The counting worker, kept apart from the splitting one.
   *
   * Separate attempt counters were not enough: `abandonAttempt` terminates
   * whatever `workerRef` holds, and counting used that same ref. A mode change
   * — which routes through `resetOutput` to abandon an in-flight *split* —
   * therefore killed an in-flight *count* mid-flight. No message ever arrived,
   * so `isCounting` stayed true and the tool sat on "Reading the PDF" forever
   * with every field disabled. Ownership has to be separate, not just the
   * bookkeeping.
   */
  const countWorkerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const specInputRef = useRef<HTMLInputElement>(null);
  /** Every object URL handed out, so none outlives the result it belongs to. */
  const urlsRef = useRef<string[]>([]);
  /**
   * Identifies the in-flight attempt. Selecting a file, editing any field,
   * clearing, starting again and unmounting all bump it; anything asynchronous
   * compares against it before publishing, so a stale worker response can no
   * longer overwrite the current selection or reappear after a Clear.
   */
  const attemptRef = useRef(0);
  /**
   * Counting has a lifecycle of its own, separate from `attemptRef`.
   *
   * Sharing one counter meant a mode change — which routes through
   * `resetOutput` to abandon any in-flight *split* — also abandoned an
   * in-flight *count*. On the fallback path that left the tool stranded: the
   * page count never arrived, so every field stayed disabled with no way back
   * short of re-picking the file. Only choosing a different document ends a
   * count, which is what this counter tracks.
   */
  const countAttemptRef = useRef(0);

  const revokeUrls = useCallback(() => {
    for (const url of urlsRef.current) URL.revokeObjectURL(url);
    urlsRef.current = [];
  }, []);

  // Tear down the worker and revoke every blob URL when leaving the page, so
  // no document bytes outlive the tab.
  useEffect(() => {
    return () => {
      attemptRef.current += 1;
      countAttemptRef.current += 1;
      workerRef.current?.terminate();
      workerRef.current = null;
      countWorkerRef.current?.terminate();
      countWorkerRef.current = null;
      for (const url of urlsRef.current) URL.revokeObjectURL(url);
      urlsRef.current = [];
    };
  }, []);

  /**
   * Abandons whatever is in flight.
   *
   * Bumping the counter alone is not enough: the abandoned attempt returns
   * early from its callbacks, so nothing would ever clear `isWorking` and the
   * tool would sit on "Splitting…" forever with the button disabled. The
   * abandoning action owns the reset, because at that moment there is no
   * successor attempt to do it — a new run sets `isWorking` itself.
   */
  const abandonAttempt = useCallback(() => {
    attemptRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsWorking(false);
  }, []);

  const clearResult = useCallback(() => {
    abandonAttempt();
    revokeUrls();
    setResult(null);
  }, [abandonAttempt, revokeUrls]);

  /** Any edit invalidates the result on screen, which came from the old values. */
  const resetOutput = useCallback(() => {
    setError(null);
    setErrorDetail("");
    clearResult();
  }, [clearResult]);

  /**
   * Spins up the engine purely to ask how many pages the document has.
   *
   * The page count is not a nicety here: a range cannot be checked, and a
   * chunk size cannot be turned into a number of files, without it. Doing it
   * on selection means the answer is on screen before the reader types, rather
   * than arriving as an error afterwards.
   */
  /**
   * Asks the engine how long the document is.
   *
   * `previewAfter` is for the suspicion path: when the byte heuristic flagged
   * a file and qpdf then reports it clean, the thumbnails it had been denied
   * are turned back on. The pdf.js-failure path passes false, because handing
   * the renderer a document it has already failed on would only fail again.
   */
  const countPages = useCallback(async (target: File, previewAfter = false) => {
    const attempt = countAttemptRef.current;
    setIsCounting(true);

    try {
      const bytes = new Uint8Array(await target.arrayBuffer());
      if (attempt !== countAttemptRef.current) return;

      const invalid = validateRequest(bytes);
      if (invalid) {
        setError(invalid.message);
        setIsCounting(false);
        return;
      }

      countWorkerRef.current?.terminate();
      const worker = new Worker(WORKER_URL);
      countWorkerRef.current = worker;

      worker.onmessage = (event: MessageEvent<PdfSplitWorkerResponse>) => {
        worker.terminate();
        if (attempt !== countAttemptRef.current) return;
        countWorkerRef.current = null;
        setIsCounting(false);

        const response = event.data;
        if (response.stage === "count" && response.pageCount !== null) {
          setPageCount(response.pageCount);
          if (previewAfter) setPreviewFile(target);
          return;
        }

        // Anything else is a real failure — a protected file, say — and the
        // shared interpreter already phrases each one.
        const outcome = interpretWorkerResponse(
          response,
          target.name,
          "extract",
          "",
        );
        if (!outcome.ok) {
          setError(outcome.message);
          setErrorDetail(outcome.detail);
        }
      };

      worker.onerror = () => {
        worker.terminate();
        if (attempt !== countAttemptRef.current) return;
        countWorkerRef.current = null;
        setIsCounting(false);
        setError(
          "The PDF engine failed to load. Reload the page and try again.",
        );
      };

      const buffer = bytes.buffer as ArrayBuffer;
      worker.postMessage({ bytes: buffer, mode: "count" }, [buffer]);
    } catch (e) {
      if (attempt !== countAttemptRef.current) return;
      setIsCounting(false);
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }, []);

  /**
   * Refuses a protected document the moment it is chosen.
   *
   * qpdf is the authority and refuses again at split time, but that is far too
   * late to be the only answer: pdf.js opens a document whose *user* password
   * is empty — the owner-password-only case, which is most of what people have
   * — so the preview would render happily and the refusal would not arrive
   * until after a range had been typed and Split pressed.
   *
   * Only the head and tail are read. The trailer lives at the end of the file
   * and a linearized document repeats one at the front, so a 100 MB PDF is
   * answered by two 8 KB reads rather than by loading it.
   */
  /**
   * Whether a document announces encryption, without reading it.
   *
   * Only the head and tail. The trailer lives at the end of the file and a
   * linearized document repeats one at the front, so a 100 MB PDF is answered
   * by two 8 KB reads. A file that cannot be read here is left to the engine,
   * which will say so in a moment with a better message than this could.
   */
  const readsAsProtected = useCallback(async (target: File) => {
    const WINDOW = 8192;
    try {
      const [head, tail] = await Promise.all([
        target.slice(0, WINDOW).arrayBuffer(),
        target.slice(Math.max(0, target.size - WINDOW)).arrayBuffer(),
      ]);
      return (
        declaresEncryption(new Uint8Array(head)) ||
        declaresEncryption(new Uint8Array(tail))
      );
    } catch {
      return false;
    }
  }, []);

  const selectFile = useCallback(
    async (next: File | null) => {
      resetOutput();
      countAttemptRef.current += 1;
      const token = countAttemptRef.current;
      countWorkerRef.current?.terminate();
      countWorkerRef.current = null;
      setIsCounting(false);
      setPageCount(null);
      setPreviewFile(null);
      // A reader left open on the old document would otherwise reopen at the
      // same page the moment a new one loaded.
      setViewerPage(null);

      if (!next) {
        setFile(null);
        return;
      }

      const tooBig = validateRequestMetadata(next.size);
      if (tooBig) {
        setFile(next);
        setError(tooBig.message);
        return;
      }

      // Asked *before* the renderer is handed anything, so a protected
      // document costs neither a 1.6 MB download nor a page count that would
      // quietly undo its own refusal.
      const suspect = await readsAsProtected(next);
      // A newer selection while those two reads were pending owns the state.
      if (token !== countAttemptRef.current) return;

      setFile(next);
      setIsCounting(true);

      if (suspect) {
        // A regex over raw bytes is a suspicion, not a verdict. An ordinary
        // document can contain the text "/Encrypt 12 0 R" — in a content
        // stream, an outline title, an embedded file — and refusing it on that
        // alone would block a file qpdf opens perfectly well. So the engine is
        // asked, and it decides: its inspect pass refuses a genuinely
        // protected document, and clears an innocent one for preview.
        void countPages(next, true);
        return;
      }

      // The page count otherwise arrives from the preview, which has to open
      // the document anyway. `countPages` stays as the fallback for when the
      // renderer cannot — see `handlePreviewFailed`.
      setPreviewFile(next);
    },
    [countPages, readsAsProtected, resetOutput],
  );

  const handlePreviewLoaded = useCallback((count: number) => {
    setIsCounting(false);
    setPageCount(count);
  }, []);

  /**
   * A document the renderer cannot open.
   *
   * Protection is the tool's own business — it refuses those files outright —
   * so that message is shown and nothing else is attempted. Any other failure
   * costs only the thumbnails, so qpdf is asked for the page count instead and
   * the splitter carries on without a preview.
   */
  const handlePreviewFailed = useCallback(
    (message: string, encrypted: boolean) => {
      if (encrypted) {
        setIsCounting(false);
        setError(message);
        return;
      }
      if (file) void countPages(file);
    },
    [countPages, file],
  );

  // Once the length is known the reader can say what they want, so put the
  // cursor there. Only on a successful count, so a failure does not move focus
  // away from the error that explains it.
  useEffect(() => {
    if (pageCount !== null && mode === "extract") specInputRef.current?.focus();
  }, [pageCount, mode]);

  const handleClear = useCallback(() => {
    void selectFile(null);
    setSpec("");
    setChunkSize("1");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectFile]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      void selectFile(event.target.files?.[0] ?? null);
    },
    [selectFile],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) void selectFile(dropped);
    },
    [selectFile],
  );

  /**
   * What the current settings would produce, worked out before anything runs.
   *
   * The same helpers the worker's arguments are built from, so the sentence on
   * screen cannot disagree with the result.
   */
  const preview = useMemo((): {
    ok: boolean;
    message: string;
    pages?: number[];
    size?: number;
  } => {
    if (pageCount === null) return { ok: false, message: "" };

    if (mode === "extract") {
      if (spec.trim().length === 0) return { ok: false, message: "" };
      const parsed = parsePageRange(spec, pageCount);
      if (!parsed.ok) return { ok: false, message: parsed.message };
      const count = parsed.pages.length;
      const listed = summarizePages(parsed.pages);
      return {
        ok: true,
        message: `${count} ${count === 1 ? "page" : "pages"} into one PDF${listed ? `: ${listed}` : ""}.`,
        pages: parsed.pages,
      };
    }

    const size = Number(chunkSize);
    if (chunkSize.trim().length === 0 || Number.isNaN(size)) {
      return { ok: false, message: "" };
    }
    const invalid = validateChunkSize(size, pageCount);
    if (invalid) return { ok: false, message: invalid.message };
    const files = chunkCount(pageCount, size);
    return {
      ok: true,
      message: `${files} ${files === 1 ? "file" : "files"} of up to ${size} ${size === 1 ? "page" : "pages"}.`,
      size,
    };
  }, [chunkSize, mode, pageCount, spec]);

  const runSplit = useCallback(async () => {
    if (!file || isWorking || pageCount === null || !preview.ok) return;

    resetOutput();

    const args =
      mode === "extract"
        ? buildExtractArgs(
            preview.pages ?? [],
            SPLIT_INPUT_PATH,
            SPLIT_OUTPUT_PATH,
          )
        : buildChunkArgs(
            preview.size ?? 1,
            SPLIT_INPUT_PATH,
            SPLIT_OUTPUT_PATH,
          );

    const attempt = attemptRef.current;
    setIsWorking(true);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (attempt !== attemptRef.current) return;

      const invalid = validateRequest(bytes);
      if (invalid) {
        setError(invalid.message);
        setIsWorking(false);
        return;
      }

      // A fresh worker per attempt: it starts with clean WASM memory and is
      // terminated as soon as it answers, which discards the file bytes.
      // Served from /pdf/ rather than bundled so the CSP relaxation that
      // WebAssembly needs stays confined to that path — see next.config.ts.
      workerRef.current?.terminate();
      // Classic worker: the qpdf glue is a UMD bundle loaded via importScripts.
      const worker = new Worker(WORKER_URL);
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<PdfSplitWorkerResponse>) => {
        worker.terminate();
        if (attempt !== attemptRef.current) return;
        workerRef.current = null;
        setIsWorking(false);

        const outcome = interpretWorkerResponse(
          event.data,
          file.name,
          mode,
          spec,
        );
        if (!outcome.ok) {
          setError(outcome.message);
          setErrorDetail(outcome.detail);
          return;
        }

        const pieces = outcome.pieces.map((piece) => {
          const blob = new Blob([piece.bytes.buffer as ArrayBuffer], {
            type: "application/pdf",
          });
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);
          return { name: piece.name, url, size: blob.size, blob };
        });

        setResult({ pieces, warnings: outcome.warnings });
      };

      worker.onerror = () => {
        worker.terminate();
        if (attempt !== attemptRef.current) return;
        workerRef.current = null;
        setIsWorking(false);
        setError(
          "The PDF engine failed to load. Reload the page and try again.",
        );
      };

      const buffer = bytes.buffer as ArrayBuffer;
      worker.postMessage({ bytes: buffer, mode, args }, [buffer]);
    } catch (e) {
      if (attempt !== attemptRef.current) return;
      setIsWorking(false);
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }, [file, isWorking, mode, pageCount, preview, resetOutput, spec]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void runSplit();
    },
    [runSplit],
  );

  /**
   * Bundles every piece into one archive.
   *
   * Stored, not deflated: PDF content streams are already compressed, so
   * deflating them again costs CPU on the main thread and saves almost
   * nothing. Built on demand rather than alongside the split, because most
   * runs end in one or two downloads and never need it.
   */
  const downloadArchive = useCallback(async () => {
    if (!file || !result || isZipping) return;
    setIsZipping(true);
    const attempt = attemptRef.current;

    try {
      const zip = new JSZip();
      for (const piece of result.pieces) zip.file(piece.name, piece.blob);
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "STORE",
      });
      if (attempt !== attemptRef.current) return;

      const url = URL.createObjectURL(blob);
      urlsRef.current.push(url);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = archiveFileName(file.name);
      // Appended before the click: some browsers ignore an anchor that is not
      // in the document, and a download that silently does nothing is worse
      // than one that fails loudly.
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (e) {
      if (attempt !== attemptRef.current) return;
      setError(e instanceof Error ? e.message : "Could not build the archive.");
    } finally {
      setIsZipping(false);
    }
  }, [file, isZipping, result]);

  // Single spoken summary of the operation. The visible alerts below are marked
  // `role="presentation"` so this is the only thing announced — otherwise the
  // same message would be read twice.
  let liveMessage = "";
  if (isCounting) {
    liveMessage = "Reading the PDF, please wait.";
  } else if (isWorking) {
    liveMessage = "Splitting PDF, please wait.";
  } else if (error) {
    liveMessage = `Split failed. ${error}`;
  } else if (result) {
    liveMessage = `PDF split. ${describeResult(result.pieces.length)}`;
  } else if (pageCount !== null) {
    liveMessage = `PDF loaded. ${pageCount} ${pageCount === 1 ? "page" : "pages"}.`;
  }

  const canRun =
    file !== null && pageCount !== null && preview.ok && !isWorking;

  return (
    <ToolPage>
      <ToolHeader
        title="PDF Splitter"
        description="Pull out the pages you want, or cut a PDF into smaller files. The document is split in your browser and never uploaded."
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={openFilePicker}>
              <FontAwesomeIcon
                icon={faUpload}
                className="h-3 w-3"
                aria-hidden="true"
              />
              Choose PDF
            </Button>

            {/* Driven entirely by `openFilePicker`; kept out of the tab
                order because the buttons above are the real controls. */}
            <input
              id="pdf-upload"
              ref={fileInputRef}
              tabIndex={-1}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleFileInput}
            />

            {(file || result || error) && (
              <Button type="button" variant="ghost" onClick={handleClear}>
                <FontAwesomeIcon
                  icon={faXmark}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                Clear
              </Button>
            )}
          </div>
        </ToolToolbar>

        <ToolOptionsBar>
          <ToolbarGroup label="Mode">
            <SegmentedControl
              value={mode}
              onChange={(value) => {
                setMode(value);
                resetOutput();
              }}
              options={modeOptions}
              ariaLabel="Split mode"
            />
          </ToolbarGroup>
        </ToolOptionsBar>

        <ToolLiveRegion message={liveMessage} />

        <ToolStatusStack>
          {error && (
            <AlertBox variant="error" role="presentation">
              <span>{error}</span>
              {errorDetail && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[12px] opacity-80">
                    Engine output
                  </summary>
                  <pre className="mt-1 overflow-x-auto font-mono text-[12px] whitespace-pre-wrap">
                    {errorDetail}
                  </pre>
                </details>
              )}
            </AlertBox>
          )}

          {result && (
            <AlertBox variant="success" role="presentation">
              <span>
                Split complete — {describeResult(result.pieces.length)} The
                original file is untouched.
              </span>
            </AlertBox>
          )}

          {result && result.warnings.length > 0 && (
            <AlertBox variant="warn" role="presentation">
              <span className="font-medium">
                qpdf repaired this file while splitting it
              </span>
              <span className="mt-0.5 text-[12px] text-muted-foreground">
                The pieces are usable, but the original was structurally
                damaged. Check them before relying on them.
              </span>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-muted-foreground">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody>
          {/* An actual form: the fields appear in the order they are filled in,
              Enter submits without a key handler, and the action sits at the
              end of the flow instead of above the inputs that gate it. */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <ToolLabel>PDF to split</ToolLabel>
              {/** biome-ignore lint/a11y/noStaticElementInteractions: drop zone
               * duplicates the always-available "Choose PDF" button and the
               * keyboard-reachable label inside it. */}
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-8 text-center transition-colors ${
                  isDragging
                    ? "border-ring bg-muted/50"
                    : "border-border bg-muted/20"
                }`}
              >
                <FontAwesomeIcon
                  icon={faFilePdf}
                  className="h-6 w-6 text-muted-foreground"
                  aria-hidden="true"
                />
                {file ? (
                  <>
                    <span className="font-mono text-[13px] text-foreground">
                      {file.name}
                    </span>
                    <ToolMeta>
                      {formatBytes(file.size)}
                      {isCounting && " · reading…"}
                      {pageCount !== null &&
                        ` · ${pageCount} ${pageCount === 1 ? "page" : "pages"}`}
                    </ToolMeta>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] text-foreground">
                      Drop a PDF here, or{" "}
                      <button
                        type="button"
                        onClick={openFilePicker}
                        className="cursor-pointer underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        choose a file
                      </button>
                    </span>
                    <ToolMeta>Up to {formatBytes(MAX_PDF_BYTES)}</ToolMeta>
                  </>
                )}
              </div>

              {/* Answers "is this range what I meant?" without decoding the
                  grammar. Highlighting is one-way: a set of clicked pages
                  could not express a reversed range or a repeated page, both
                  of which this tool supports. */}
              <PdfPagePreview
                file={previewFile}
                selected={mode === "extract" ? (preview.pages ?? null) : null}
                onLoaded={handlePreviewLoaded}
                onFailed={handlePreviewFailed}
                onOpenPage={setViewerPage}
                className="mt-3"
              />
            </div>

            {/* The setting and the action it gates share a panel, so the field
                carries the same visual weight as the drop zone above instead of
                reading as an afterthought below it. */}
            <div className="rounded-md border border-border bg-muted/25 p-4">
              {mode === "extract" ? (
                <>
                  <ToolLabel htmlFor="pdf-split-range">Pages to take</ToolLabel>
                  <Input
                    id="pdf-split-range"
                    ref={specInputRef}
                    type="text"
                    value={spec}
                    onChange={(event) => {
                      setSpec(event.target.value);
                      resetOutput();
                    }}
                    placeholder="1-5, 8, 11-13"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={pageCount === null}
                    aria-describedby="pdf-split-range-hint"
                    className="h-10 bg-background font-mono"
                  />
                  <ToolHint id="pdf-split-range-hint">
                    Pages and ranges, separated by commas — for example{" "}
                    <code>1-5, 8, 11-13</code>.
                  </ToolHint>

                  {/* The rarer syntax is real and worth having, but it is not
                      what most people need, and five rules crammed under the
                      field taught qpdf's grammar instead of getting out of the
                      way. Folded away, and laid out as rows rather than prose
                      so it can be scanned rather than read. */}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[12px] text-muted-foreground transition-colors hover:text-foreground">
                      Other ways to choose pages
                    </summary>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      <dt className="font-mono text-foreground">4-z</dt>
                      <dd>
                        <code>z</code> is the last page, so this takes page four
                        to the end.
                      </dd>

                      <dt className="font-mono text-foreground">r2</dt>
                      <dd>
                        Counts back from the end — the second-to-last page.
                      </dd>

                      <dt className="font-mono text-foreground">1-z,x3</dt>
                      <dd>
                        <code>x</code> leaves pages out. This is every page
                        except the third — how you delete pages.
                      </dd>

                      <dt className="font-mono text-foreground">3-1</dt>
                      <dd>
                        A backwards range reverses those pages, because the
                        order you type is the order you get.
                      </dd>
                    </dl>
                  </details>
                </>
              ) : (
                <>
                  <ToolLabel htmlFor="pdf-split-size">Pages per file</ToolLabel>
                  <Input
                    id="pdf-split-size"
                    type="text"
                    inputMode="numeric"
                    value={chunkSize}
                    onChange={(event) => {
                      setChunkSize(event.target.value);
                      resetOutput();
                    }}
                    placeholder="1"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={pageCount === null}
                    aria-describedby="pdf-split-size-hint"
                    className="h-10 w-32 bg-background font-mono"
                  />
                  <ToolHint id="pdf-split-size-hint">
                    The document is cut into runs of this many pages. The last
                    file keeps whatever is left over.
                  </ToolHint>
                </>
              )}

              {/* Says what the settings will do before they are run, using the
                  same helpers that build the arguments — so this sentence
                  cannot disagree with the result. */}
              {preview.message && (
                <p
                  className={`mt-3 text-[13px] ${preview.ok ? "text-muted-foreground" : "text-destructive"}`}
                >
                  {preview.ok ? `Produces ${preview.message}` : preview.message}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                variant={result ? "outline" : "default"}
                disabled={!canRun}
                className="mt-4 w-full sm:w-auto"
              >
                <FontAwesomeIcon
                  icon={faScissors}
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {isWorking ? "Splitting..." : "Split PDF"}
              </Button>
            </div>
          </form>

          {result && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <ToolLabel className="mb-0">
                  {result.pieces.length === 1
                    ? "Result"
                    : `Result — ${result.pieces.length} files`}
                </ToolLabel>
                {result.pieces.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void downloadArchive()}
                    disabled={isZipping}
                  >
                    <FontAwesomeIcon
                      icon={faDownload}
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                    {isZipping ? "Preparing..." : "Download all (.zip)"}
                  </Button>
                )}
              </div>

              <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-muted/25">
                {result.pieces.map((piece) => (
                  <li
                    key={piece.name}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-mono text-[13px] text-foreground">
                        {piece.name}
                      </span>
                      <ToolMeta>{formatBytes(piece.size)}</ToolMeta>
                    </div>
                    <Button asChild size="sm" variant="ghost">
                      <a href={piece.url} download={piece.name}>
                        <FontAwesomeIcon
                          icon={faDownload}
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        Download
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ToolBody>
      </ToolCard>

      {/* Opens its own copy of the document, so the grid's lifetime and the
          reader's never have to agree — see PdfViewerDialog. */}
      <PdfViewerDialog
        file={viewerPage !== null ? previewFile : null}
        initialPage={viewerPage ?? 1}
        onClose={() => setViewerPage(null)}
      />

      <ToolFootnote>
        A password-protected PDF is refused rather than split. Splitting it
        would hand back pieces with the protection quietly removed, so remove
        the password deliberately with the PDF Password Remover first.
      </ToolFootnote>

      <ToolFootnote className="mt-2">
        Splitting runs locally through a WebAssembly build of qpdf — the PDF is
        read in a Web Worker on this device and no bytes are sent anywhere. Page
        content is preserved, though the internal file structure and size may
        change, since streams are recompressed as each piece is written.
        Bookmarks and document metadata belong to the whole document, so they do
        not survive being cut into pieces.
      </ToolFootnote>
    </ToolPage>
  );
}
