"use client";

import { faArrowLeft } from "@fortawesome/free-solid-svg-icons/faArrowLeft";
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight";
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload";
import { faFilePdf } from "@fortawesome/free-solid-svg-icons/faFilePdf";
import { faLayerGroup } from "@fortawesome/free-solid-svg-icons/faLayerGroup";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { PdfCoverThumbnail } from "@/components/tool/PdfCoverThumbnail";
import { PdfViewerDialog } from "@/components/tool/PdfViewerDialog";
import { RunShortcutHint } from "@/components/tool/RunShortcutHint";
import {
  ToolBody,
  ToolCard,
  ToolFootnote,
  ToolHeader,
  ToolHint,
  ToolLabel,
  ToolLiveRegion,
  ToolMeta,
  ToolPage,
  ToolStatusStack,
  ToolToolbar,
} from "@/components/tool/ToolScaffold";
import { Button } from "@/components/ui/button";
import { useAnnouncer } from "@/hooks/useAnnouncement";
import { useFocusResult, useRunShortcut } from "@/hooks/useRunShortcut";
import {
  describeMerge,
  formatBytes,
  interpretMergeResponse,
  MAX_MERGE_FILES,
  MAX_PDF_BYTES,
  MAX_TOTAL_MERGE_BYTES,
  MIN_MERGE_FILES,
  mergedFileName,
  moveItem,
  type PdfMergeErrorCode,
  type PdfMergeWorkerResponse,
  previewableFiles,
  validateBytes,
  validateSelection,
} from "@/lib/pdf-merge";

/** Static path, not a bundled chunk — see the comment in `handleMerge`. */
const WORKER_URL = "/pdf/qpdf-merge-worker.js";

/** Cover width on a card. Wide enough to recognise a document, not to read it. */
const COVER_CARD_WIDTH = 110;

/**
 * A queued input. The id is what React keys on: the same file can legitimately
 * be added twice, and rows are reordered, so neither the name nor the position
 * is a stable identity.
 */
interface QueuedFile {
  id: string;
  file: File;
}

interface MergedResult {
  url: string;
  name: string;
  size: number;
  fileCount: number;
  pageCount: number | null;
  /** Non-fatal qpdf warnings, e.g. a repaired cross-reference table. */
  warnings: string[];
  /** Inputs whose protection was removed so the merge could produce one file. */
  decrypted: string[];
}

export default function PdfMergeTool() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  /**
   * Pages per queued file, reported by its cover thumbnail.
   *
   * Keyed by the queue id rather than the filename, for the same reason the
   * rows are: the same document can be added twice, and rows move. A file
   * whose cover will not render is simply absent, and its row shows the size
   * alone — pdf.js failing to read something qpdf can merge is not worth
   * turning into an error.
   */
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<PdfMergeErrorCode | null>(null);
  const [errorDetail, setErrorDetail] = useState("");
  const [result, setResult] = useState<MergedResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  /**
   * Files left out because the list was already full. Held in visible state,
   * not just announced: a sighted reader was otherwise able to download an
   * incomplete merge with nothing on screen saying a document was dropped.
   */
  const [skippedFiles, setSkippedFiles] = useState<string[]>([]);
  /** Queue id of the document open in the reader, or null when it is closed. */
  const [viewerId, setViewerId] = useState<string | null>(null);

  const [liveMessage, announce] = useAnnouncer();
  const [resultRef, focusResultOnNextRender] =
    useFocusResult<HTMLAnchorElement>();

  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultUrlRef = useRef<string | null>(null);
  const nextIdRef = useRef(0);
  /**
   * Identifies the in-flight attempt. Adding, removing, reordering, clearing,
   * starting again and unmounting all bump it; anything asynchronous compares
   * against it before publishing, so a stale worker response can no longer
   * overwrite the current list or reappear after a Clear.
   */
  const attemptRef = useRef(0);

  // Tear down the worker and revoke the blob URL when leaving the page, so no
  // merged bytes outlive the tab.
  useEffect(() => {
    return () => {
      attemptRef.current += 1;
      workerRef.current?.terminate();
      workerRef.current = null;
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = null;
      }
    };
  }, []);

  /**
   * Abandons whatever is in flight.
   *
   * Bumping the counter alone is not enough: the abandoned attempt returns
   * early from its callbacks, so nothing would ever clear `isWorking` and the
   * tool would sit on "Merging…" forever with the button disabled. The
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
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
    }
    setResult(null);
  }, [abandonAttempt]);

  /** Any edit to the list invalidates the result that was built from it. */
  const editList = useCallback(
    (update: (current: QueuedFile[]) => QueuedFile[]) => {
      setError(null);
      setErrorCode(null);
      setErrorDetail("");
      setSkippedFiles([]);
      clearResult();
      // The reader is modal, so no edit can happen while it is open; this only
      // stops a stale id pointing at a document that has since been removed.
      setViewerId(null);
      setFiles(update);
    },
    [clearResult],
  );

  /**
   * Which rows may open their document for a cover.
   *
   * Opening one reads the whole file into memory, so the merger's own size
   * ceilings gate it: without this an oversized document was loaded the
   * instant it joined the list, and only refused later when Merge was pressed.
   */
  const previewable = useMemo(
    () => previewableFiles(files.map((queued) => queued.file.size)),
    [files],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[] | null) => {
      const added = Array.from(incoming ?? []);
      if (added.length === 0) return;

      // Take only what fits, and say so. Silently dropping the overflow would
      // leave the reader believing a document is in the merge when it is not.
      const room = Math.max(MAX_MERGE_FILES - files.length, 0);
      const accepted = added.slice(0, room);
      const skipped = added.length - accepted.length;

      if (accepted.length === 0) {
        setError(`The list is full at ${MAX_MERGE_FILES} files.`);
        setErrorCode("too-many-files");
        announce(
          `No files added. The list is full at ${MAX_MERGE_FILES} files.`,
        );
        return;
      }

      editList((current) => [
        ...current,
        ...accepted.map((file) => ({ id: `f${nextIdRef.current++}`, file })),
      ]);
      // After editList, which clears it along with the error.
      setSkippedFiles(added.slice(accepted.length).map((file) => file.name));
      announce(
        `${accepted.length} file${accepted.length === 1 ? "" : "s"} added to the merge list.${
          skipped > 0
            ? ` ${skipped} skipped — the list is full at ${MAX_MERGE_FILES} files.`
            : ""
        }`,
      );
    },
    [announce, editList, files.length],
  );

  /**
   * Opens the native file picker.
   *
   * The visible control has to be a real `<button>`: a `<label>` is not
   * focusable, and the input it points at is `display: none`, so neither was
   * reachable by Tab — the whole workflow was unusable from the keyboard.
   */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(event.target.files);
      // Reset so picking the same file again still fires a change event.
      event.target.value = "";
    },
    [addFiles],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      addFiles(event.dataTransfer.files);
    },
    [addFiles],
  );

  const handleRemove = useCallback(
    (id: string) => {
      const removed = files.find((queued) => queued.id === id);
      editList((current) => current.filter((queued) => queued.id !== id));
      if (removed) {
        const remaining = files.length - 1;
        announce(
          `${removed.file.name} removed. ${remaining} file${remaining === 1 ? "" : "s"} left.`,
        );
      }
    },
    [announce, editList, files],
  );

  const handleMove = useCallback(
    (from: number, to: number) => {
      const moved = files[from];
      if (!moved || to < 0 || to >= files.length) return;
      editList((current) => moveItem(current, from, to));
      announce(
        `${moved.file.name} moved to position ${to + 1} of ${files.length}.`,
      );
    },
    [announce, editList, files],
  );

  const handleClear = useCallback(() => {
    editList(() => []);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    announce("");
  }, [announce, editList]);

  const canMerge = files.length >= MIN_MERGE_FILES && !isWorking;

  const handleMerge = useCallback(async () => {
    if (!canMerge) return;

    setError(null);
    setErrorCode(null);
    setErrorDetail("");
    clearResult();

    const queued = files;
    const names = queued.map((item) => item.file.name);

    const failWith = (message: string, code: PdfMergeErrorCode) => {
      setError(message);
      setErrorCode(code);
      setIsWorking(false);
      announce(`Merge failed. ${message}`);
    };

    // Everything knowable without reading the files is checked first, so an
    // oversized selection is refused before it is allocated in page memory.
    const invalid = validateSelection(
      queued.map((item) => ({ name: item.file.name, size: item.file.size })),
    );
    if (invalid) {
      failWith(invalid.message, invalid.code);
      return;
    }

    const attempt = attemptRef.current;
    setIsWorking(true);
    announce(`Merging ${queued.length} PDFs, please wait.`);

    try {
      // Read one at a time rather than all at once: peak page memory stays at
      // one file above the buffers already collected.
      const buffers: ArrayBuffer[] = [];
      for (const item of queued) {
        const bytes = new Uint8Array(await item.file.arrayBuffer());

        // Reading is async; the list may have changed, or the page may have
        // unmounted, while it was pending.
        if (attempt !== attemptRef.current) return;

        const badFile = validateBytes(bytes, item.file.name);
        if (badFile) {
          failWith(badFile.message, badFile.code);
          return;
        }
        buffers.push(bytes.buffer as ArrayBuffer);
      }

      // A fresh worker per attempt: it starts with clean WASM memory and is
      // terminated as soon as it answers, which discards the file bytes.
      // Served from /pdf/ rather than bundled so the CSP relaxation that
      // WebAssembly needs stays confined to that path — see next.config.ts.
      workerRef.current?.terminate();
      // Classic worker: the qpdf glue is a UMD bundle loaded via importScripts.
      const worker = new Worker(WORKER_URL);
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<PdfMergeWorkerResponse>) => {
        worker.terminate();
        if (attempt !== attemptRef.current) return;
        workerRef.current = null;
        setIsWorking(false);

        const outcome = interpretMergeResponse(event.data, names);
        if (!outcome.ok) {
          setError(outcome.message);
          setErrorCode(outcome.code);
          setErrorDetail(outcome.detail);
          announce(`Merge failed. ${outcome.message}`);
          return;
        }

        // `bytes` wraps the whole transferred buffer, so passing `.buffer`
        // straight through is safe and avoids a second copy.
        const blob = new Blob([outcome.bytes.buffer as ArrayBuffer], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;
        const name = mergedFileName(names[0]);
        setResult({
          url,
          name,
          size: blob.size,
          fileCount: names.length,
          pageCount: outcome.pageCount,
          warnings: outcome.warnings,
          decrypted: outcome.decrypted,
        });
        focusResultOnNextRender();
        announce(
          `${names.length} PDFs merged. ${describeMerge(names.length, outcome.pageCount, blob.size)}. ${name} is ready to download.${
            outcome.warnings.length > 0
              ? ` ${outcome.warnings.length} repair warning${outcome.warnings.length === 1 ? "" : "s"}.`
              : ""
          }`,
        );
      };

      worker.onerror = () => {
        worker.terminate();
        if (attempt !== attemptRef.current) return;
        workerRef.current = null;
        failWith(
          "The PDF engine failed to load. Reload the page and try again.",
          "worker-failed",
        );
      };

      // Transfer the buffers so the bytes are moved, not copied.
      worker.postMessage({ buffers }, buffers);
    } catch (e) {
      if (attempt !== attemptRef.current) return;
      failWith(
        e instanceof Error ? e.message : "Could not read those files.",
        "unknown",
      );
    }
  }, [announce, canMerge, clearResult, files, focusResultOnNextRender]);

  const runMerge = useCallback(() => {
    void handleMerge();
  }, [handleMerge]);

  useRunShortcut(runMerge, canMerge);

  const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0);

  return (
    <ToolPage>
      <ToolHeader
        title="PDF Merger"
        description="Combine several PDFs into one document, in the order you choose. The files are merged in your browser and never uploaded."
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
              Add PDFs
            </Button>

            {/* Driven entirely by `openFilePicker`; kept out of the tab
                order because the buttons above are the real controls. */}
            <input
              id="pdf-merge-upload"
              ref={fileInputRef}
              tabIndex={-1}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />

            {(files.length > 0 || result || error) && (
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

        <ToolLiveRegion message={liveMessage} />

        <ToolStatusStack>
          {error && (
            <AlertBox variant="error" role="presentation">
              <span>
                {error}
                {errorCode === "encrypted" && (
                  <>
                    {" "}
                    <Link
                      href="/tools/pdf/unlock"
                      className="underline underline-offset-2"
                    >
                      Use the PDF Password Remover
                    </Link>{" "}
                    — it runs in your browser too.
                  </>
                )}
              </span>
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
                {result.fileCount} PDFs combined into one document. Page content
                is preserved. Bookmarks and document-level metadata come from
                the first file only; later files' bookmarks are not carried
                over.
              </span>
            </AlertBox>
          )}

          {skippedFiles.length > 0 && (
            <AlertBox variant="warn">
              <span className="font-medium">
                {skippedFiles.length} file
                {skippedFiles.length === 1 ? " was" : "s were"} not added — the
                list is full at {MAX_MERGE_FILES}
              </span>
              <span className="mt-0.5 text-[12px] text-muted-foreground">
                Nothing below was merged. Remove some files and add
                {skippedFiles.length === 1 ? " it" : " them"} again.
              </span>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-muted-foreground">
                {skippedFiles.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </AlertBox>
          )}

          {result && result.decrypted.length > 0 && (
            <AlertBox variant="warn" role="presentation">
              <span className="font-medium">
                Restrictions were removed so these pages could be combined
              </span>
              <span className="mt-0.5 text-[12px] text-muted-foreground">
                {result.decrypted.length === 1 ? "This file" : "These files"}{" "}
                opened without a password but restricted printing or editing.
                The merged PDF carries no such restriction.
              </span>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-muted-foreground">
                {result.decrypted.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </AlertBox>
          )}

          {result && result.warnings.length > 0 && (
            <AlertBox variant="warn" role="presentation">
              <span className="font-medium">
                qpdf repaired a file while merging it
              </span>
              <span className="mt-0.5 text-[12px] text-muted-foreground">
                The merged PDF is usable, but at least one input was
                structurally damaged. Check the result before relying on it.
              </span>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-muted-foreground">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody>
          <div>
            <ToolLabel>PDFs to Merge</ToolLabel>

            {/** biome-ignore lint/a11y/noStaticElementInteractions: drop zone
             * duplicates the always-available "Add PDFs" button and the
             * keyboard-reachable label inside it. */}
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-md border border-dashed transition-colors ${
                isDragging
                  ? "border-ring bg-muted/50"
                  : "border-border bg-muted/20"
              }`}
            >
              {files.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                  <FontAwesomeIcon
                    icon={faFilePdf}
                    className="h-6 w-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="text-[13px] text-foreground">
                    Drop PDFs here, or{" "}
                    <button
                      type="button"
                      onClick={openFilePicker}
                      className="cursor-pointer underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      choose files
                    </button>
                  </span>
                  <ToolMeta>
                    {MIN_MERGE_FILES}–{MAX_MERGE_FILES} files, up to{" "}
                    {formatBytes(MAX_PDF_BYTES)} each
                  </ToolMeta>
                </div>
              ) : (
                <div className="p-2 sm:p-3">
                  {/* The order of this grid is the order of the merged
                      document, so it is an ordered list in the markup too. A
                      grid of cards rather than rows: a document is recognised
                      by its cover far more readily than by its filename, and a
                      cover needs room that a table row cannot give it. */}
                  <ol className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                    {files.map((queued, index) => {
                      const count = pageCounts[queued.id];
                      return (
                        <li
                          key={queued.id}
                          className="flex flex-col items-center gap-2 rounded-md border border-border bg-background p-3"
                          data-file={queued.file.name}
                        >
                          <PdfCoverThumbnail
                            file={previewable[index] ? queued.file : null}
                            width={COVER_CARD_WIDTH}
                            onOpen={
                              previewable[index]
                                ? () => setViewerId(queued.id)
                                : undefined
                            }
                            onPageCount={(pages) =>
                              setPageCounts((previous) => {
                                if (pages === null) {
                                  if (!(queued.id in previous)) return previous;
                                  const { [queued.id]: _dropped, ...rest } =
                                    previous;
                                  return rest;
                                }
                                if (previous[queued.id] === pages)
                                  return previous;
                                return { ...previous, [queued.id]: pages };
                              })
                            }
                          />
                          <div className="flex w-full min-w-0 flex-col items-center text-center">
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {index + 1}
                            </span>
                            <span
                              className="block w-full truncate font-mono text-[13px] text-foreground"
                              title={queued.file.name}
                            >
                              {queued.file.name}
                            </span>
                            <ToolMeta className="text-[12px]">
                              {formatBytes(queued.file.size)}
                              {count !== undefined &&
                                ` · ${count} ${count === 1 ? "page" : "pages"}`}
                            </ToolMeta>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={index === 0}
                              onClick={() => handleMove(index, index - 1)}
                              aria-label={`Move ${queued.file.name} earlier`}
                            >
                              <FontAwesomeIcon
                                icon={faArrowLeft}
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={index === files.length - 1}
                              onClick={() => handleMove(index, index + 1)}
                              aria-label={`Move ${queued.file.name} later`}
                            >
                              <FontAwesomeIcon
                                icon={faArrowRight}
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleRemove(queued.id)}
                              aria-label={`Remove ${queued.file.name}`}
                            >
                              <FontAwesomeIcon
                                icon={faXmark}
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                    <ToolMeta className="text-[12px]">
                      {files.length} file{files.length === 1 ? "" : "s"} ·{" "}
                      {formatBytes(totalBytes)}
                    </ToolMeta>
                    <span className="text-[12px] text-muted-foreground">
                      Drop more here, or{" "}
                      <button
                        type="button"
                        onClick={openFilePicker}
                        className="cursor-pointer underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        choose files
                      </button>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* The action sits at the end of the input flow, after the list it
              acts on, rather than above it in the toolbar. */}
          <div className="rounded-md border border-border bg-muted/25 p-4">
            <Button
              type="button"
              size="lg"
              // Once a result exists the Download button is the thing to reach
              // for, so this steps back rather than competing with it. It
              // returns to primary as soon as the list changes, since that
              // clears the result and means another attempt.
              variant={result ? "outline" : "default"}
              disabled={!canMerge}
              onClick={runMerge}
              aria-keyshortcuts="Meta+Enter Control+Enter"
              aria-describedby="pdf-merge-hint"
              className="w-full sm:w-auto"
            >
              <FontAwesomeIcon
                icon={faLayerGroup}
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
              {isWorking ? "Merging..." : "Merge PDFs"}
              <RunShortcutHint />
            </Button>
            <ToolHint id="pdf-merge-hint">
              Pages are combined top to bottom in the order above. Use the
              arrows to reorder, and keep the total under{" "}
              {formatBytes(MAX_TOTAL_MERGE_BYTES)}.
            </ToolHint>
          </div>

          <div>
            <ToolLabel>Merged PDF</ToolLabel>
            {result ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/25 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-mono text-[13px] text-foreground">
                    {result.name}
                  </span>
                  <ToolMeta>
                    {describeMerge(
                      result.fileCount,
                      result.pageCount,
                      result.size,
                    )}
                  </ToolMeta>
                </div>
                <Button asChild>
                  <a ref={resultRef} href={result.url} download={result.name}>
                    <FontAwesomeIcon
                      icon={faDownload}
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                    Download
                  </a>
                </Button>
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/25 px-4 py-3">
                <ToolMeta className="text-[13px] font-normal">
                  Add {MIN_MERGE_FILES} or more PDFs, then click Merge PDFs to
                  combine them into one document.
                </ToolMeta>
              </div>
            )}
          </div>
        </ToolBody>
      </ToolCard>

      {/* Opens its own copy of the document, so a card's lifetime and the
          reader's never have to agree — see PdfViewerDialog. */}
      <PdfViewerDialog
        file={files.find((queued) => queued.id === viewerId)?.file ?? null}
        onClose={() => setViewerId(null)}
      />

      <ToolFootnote>
        <strong className="font-semibold text-foreground">
          Only combine documents you own or are authorized to modify.
        </strong>{" "}
        Password-protected PDFs cannot be merged until their protection is
        removed — the{" "}
        <Link
          href="/tools/pdf/unlock"
          className="underline underline-offset-2 hover:text-foreground"
        >
          PDF Password Remover
        </Link>{" "}
        does that locally as well.
      </ToolFootnote>

      <ToolFootnote className="mt-2">
        Merging runs locally through a WebAssembly build of qpdf — the files are
        read in a Web Worker on this device and no bytes are sent anywhere. Page
        content, annotations and form fields are copied across. Bookmarks and
        document-level metadata are taken from the first file; later files'
        bookmarks are dropped. The merged PDF is always unencrypted, so a file
        that opened freely but restricted printing loses that restriction rather
        than imposing it on everything else.
      </ToolFootnote>
    </ToolPage>
  );
}
