"use client";

import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload";
import { faEye } from "@fortawesome/free-solid-svg-icons/faEye";
import { faEyeSlash } from "@fortawesome/free-solid-svg-icons/faEyeSlash";
import { faFilePdf } from "@fortawesome/free-solid-svg-icons/faFilePdf";
import { faLockOpen } from "@fortawesome/free-solid-svg-icons/faLockOpen";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import {
  ToolBody,
  ToolCard,
  ToolFootnote,
  ToolHeader,
  ToolLabel,
  ToolLiveRegion,
  ToolMeta,
  ToolPage,
  ToolStatusStack,
  ToolToolbar,
} from "@/components/tool/ToolScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  describeEncryption,
  formatBytes,
  interpretWorkerResponse,
  MAX_PDF_BYTES,
  type PdfEncryptionInfo,
  type PdfUnlockWorkerResponse,
  unlockedFileName,
  validateRequest,
  validateRequestMetadata,
} from "@/lib/pdf-unlock";

const WORKER_URL = "/pdf/qpdf-worker.js";

interface UnlockedResult {
  url: string;
  name: string;
  size: number;
  encryption: PdfEncryptionInfo | null;
  /** Non-fatal qpdf warnings, e.g. a repaired cross-reference table. */
  warnings: string[];
}

export default function PdfUnlockTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [result, setResult] = useState<UnlockedResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const resultUrlRef = useRef<string | null>(null);
  /** Invalidates asynchronous results after any input change or unmount. */
  const attemptRef = useRef(0);

  // Move focus only on selection, not on Clear.
  useEffect(() => {
    if (file) passwordInputRef.current?.focus();
  }, [file]);

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

  /** Clear working state here; ignored callbacks cannot reset it later. */
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

  const selectFile = useCallback(
    (next: File | null) => {
      setFile(next);
      setError(null);
      setErrorDetail("");
      clearResult();
    },
    [clearResult],
  );

  const handleClear = useCallback(() => {
    selectFile(null);
    setPassword("");
    setShowPassword(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [selectFile]);

  const handlePasswordChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(event.target.value);
      setError(null);
      setErrorDetail("");
      clearResult();
    },
    [clearResult],
  );

  /** The visible button opens the hidden input so keyboard users can reach it. */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      selectFile(event.target.files?.[0] ?? null);
    },
    [selectFile],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) selectFile(dropped);
    },
    [selectFile],
  );

  const handleUnlock = useCallback(async () => {
    if (!file || isWorking) return;

    setError(null);
    setErrorDetail("");
    clearResult();

    // Reject oversized files before allocating their bytes.
    const tooBig = validateRequestMetadata(file.size, password.length);
    if (tooBig) {
      setError(tooBig.message);
      return;
    }

    const attempt = attemptRef.current;
    setIsWorking(true);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());

      // Ignore a read completed after an input change or unmount.
      if (attempt !== attemptRef.current) return;

      const invalid = validateRequest(bytes, password);
      if (invalid) {
        setError(invalid.message);
        setIsWorking(false);
        return;
      }

      // A fresh worker drops its WASM memory after each run. Its /pdf/ URL
      // confines the required CSP relaxation to that path.
      workerRef.current?.terminate();
      // qpdf's UMD bundle requires a classic worker.
      const worker = new Worker(WORKER_URL);
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<PdfUnlockWorkerResponse>) => {
        worker.terminate();
        if (attempt !== attemptRef.current) return;
        workerRef.current = null;
        setIsWorking(false);

        const outcome = interpretWorkerResponse(event.data);
        if (!outcome.ok) {
          setError(outcome.message);
          setErrorDetail(outcome.detail);
          return;
        }

        // The result occupies the whole transferred buffer; no copy is needed.
        const blob = new Blob([outcome.bytes.buffer as ArrayBuffer], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;
        setResult({
          url,
          name: unlockedFileName(file.name),
          size: blob.size,
          encryption: outcome.encryption,
          warnings: outcome.warnings,
        });
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
      worker.postMessage({ bytes: buffer, password }, [buffer]);
    } catch (e) {
      if (attempt !== attemptRef.current) return;
      setIsWorking(false);
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }, [clearResult, file, isWorking, password]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleUnlock();
    },
    [handleUnlock],
  );

  // Single spoken summary of the operation. The visible alerts below are marked
  // `role="presentation"` so this is the only thing announced — otherwise the
  // same message would be read twice.
  let liveMessage = "";
  if (isWorking) {
    liveMessage = "Unlocking PDF, please wait.";
  } else if (error) {
    liveMessage = `Unlock failed. ${error}`;
  } else if (result) {
    liveMessage = `PDF unlocked. ${describeEncryption(result.encryption)} encryption removed. ${result.name} is ready to download.${
      result.warnings.length > 0
        ? ` ${result.warnings.length} repair warning${result.warnings.length === 1 ? "" : "s"} — the original file was structurally damaged.`
        : ""
    }`;
  }

  return (
    <ToolPage>
      <ToolHeader
        title="PDF Password Remover"
        description="Remove the password from a PDF you can already open. The file is decrypted in your browser and never uploaded."
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
                Password removed — {describeEncryption(result.encryption)}{" "}
                encryption stripped. The unlocked PDF opens without a prompt.
                Document content is preserved, though the file structure and
                size may change.
              </span>
            </AlertBox>
          )}

          {result && result.warnings.length > 0 && (
            <AlertBox variant="warn" role="presentation">
              <span className="font-medium">
                qpdf repaired this file while unlocking it
              </span>
              <span className="mt-0.5 text-[12px] text-muted-foreground">
                The unlocked PDF is usable, but the original was structurally
                damaged. Check it before relying on it.
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
              <ToolLabel>Encrypted PDF</ToolLabel>
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
                    <ToolMeta>{formatBytes(file.size)}</ToolMeta>
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
            </div>

            {/* The password and the action it gates share a panel, so the
                field carries the same visual weight as the drop zone above
                instead of reading as an afterthought below it. */}
            <div className="rounded-md border border-border bg-muted/25 p-4">
              <ToolLabel htmlFor="pdf-password">Password</ToolLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="pdf-password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter the PDF password"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="pdf-password-hint"
                  className="h-10 bg-background font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <FontAwesomeIcon
                    icon={showPassword ? faEyeSlash : faEye}
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  />
                </Button>
              </div>
              <p
                id="pdf-password-hint"
                className="mt-2 text-[12px] leading-relaxed text-muted-foreground"
              >
                Leave this empty if the PDF opens without a prompt and only
                restricts printing or copying.
              </p>

              {/* Once a result exists the Download button is the thing to
                  reach for, so this steps back rather than competing with it.
                  It returns to primary as soon as the password changes, since
                  that clears the result and means another attempt. */}
              <Button
                type="submit"
                size="lg"
                variant={result ? "outline" : "default"}
                disabled={!file || isWorking}
                className="mt-3 w-full sm:w-auto"
              >
                <FontAwesomeIcon
                  icon={faLockOpen}
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {isWorking ? "Unlocking..." : "Unlock PDF"}
              </Button>
            </div>
          </form>

          {result && (
            <div>
              <ToolLabel>Unlocked PDF</ToolLabel>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/25 px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-mono text-[13px] text-foreground">
                    {result.name}
                  </span>
                  <ToolMeta>{formatBytes(result.size)}</ToolMeta>
                </div>
                <Button asChild>
                  <a href={result.url} download={result.name}>
                    <FontAwesomeIcon
                      icon={faDownload}
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                    Download
                  </a>
                </Button>
              </div>
            </div>
          )}
        </ToolBody>
      </ToolCard>

      <ToolFootnote>
        <strong className="font-semibold text-foreground">
          Only remove protection from documents you own or are authorized to
          modify.
        </strong>{" "}
        This removes protection from a PDF you can already open; it does not
        recover or guess a password you do not have.
      </ToolFootnote>

      <ToolFootnote className="mt-2">
        Decryption runs locally through a WebAssembly build of qpdf — the PDF is
        read in a Web Worker on this device and no bytes are sent anywhere.
        Document content is preserved, though the internal file structure and
        size may change, since streams are recompressed as the file is
        rewritten.
      </ToolFootnote>
    </ToolPage>
  );
}
