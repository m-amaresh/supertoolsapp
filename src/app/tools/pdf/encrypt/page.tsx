"use client";

import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload";
import { faEye } from "@fortawesome/free-solid-svg-icons/faEye";
import { faEyeSlash } from "@fortawesome/free-solid-svg-icons/faEyeSlash";
import { faFilePdf } from "@fortawesome/free-solid-svg-icons/faFilePdf";
import { faLock } from "@fortawesome/free-solid-svg-icons/faLock";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import {
  SegmentedControl,
  ToolbarCheckbox,
  ToolbarGroup,
} from "@/components/Toolbar";
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
  buildEncryptArgs,
  DEFAULT_PERMISSIONS,
  describeRestrictions,
  describeStrength,
  formatBytes,
  interpretWorkerResponse,
  MAX_PDF_BYTES,
  type PdfEncryptionStrength,
  type PdfEncryptOptions,
  type PdfEncryptPermissions,
  type PdfEncryptWorkerResponse,
  passwordTruncationWarning,
  protectedFileName,
  validateRequest,
  validateRequestMetadata,
} from "@/lib/pdf-encrypt";

/** Static path, not a bundled chunk — see the comment in `handleEncrypt`. */
const WORKER_URL = "/pdf/qpdf-encrypt-worker.js";

/** Scratch paths inside the worker's Emscripten filesystem. */
const INPUT_PATH = "in.pdf";
const OUTPUT_PATH = "out.pdf";

const strengthOptions: { value: PdfEncryptionStrength; label: string }[] = [
  { value: "aes256", label: "AES-256" },
  { value: "aes128", label: "AES-128" },
];

interface ProtectedResult {
  url: string;
  name: string;
  size: number;
  strength: PdfEncryptionStrength;
  restrictions: string[];
  /** Non-fatal qpdf warnings, e.g. a repaired cross-reference table. */
  warnings: string[];
}

export default function PdfEncryptTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState<PdfEncryptionStrength>("aes256");
  const [permissions, setPermissions] = useState<PdfEncryptPermissions>({
    ...DEFAULT_PERMISSIONS,
  });
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [result, setResult] = useState<ProtectedResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const resultUrlRef = useRef<string | null>(null);
  /**
   * Identifies the in-flight attempt. Selecting a file, editing any field,
   * clearing, starting again and unmounting all bump it; anything asynchronous
   * compares against it before publishing, so a stale worker response can no
   * longer overwrite the current selection or reappear after a Clear.
   */
  const attemptRef = useRef(0);

  // Picking a file moves you to the next step rather than leaving you to find
  // it. Only on selection, so clearing does not yank focus.
  useEffect(() => {
    if (file) passwordInputRef.current?.focus();
  }, [file]);

  // Tear down the worker and revoke the blob URL when leaving the page, so no
  // document bytes outlive the tab.
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
   * tool would sit on "Protecting…" forever with the button disabled. The
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

  /** Any edit invalidates the result on screen, which was built from the old values. */
  const resetOutput = useCallback(() => {
    setError(null);
    setErrorDetail("");
    clearResult();
  }, [clearResult]);

  const selectFile = useCallback(
    (next: File | null) => {
      setFile(next);
      resetOutput();
    },
    [resetOutput],
  );

  const handleClear = useCallback(() => {
    selectFile(null);
    setPassword("");
    setConfirmPassword("");
    setOwnerPassword("");
    setShowPassword(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [selectFile]);

  const updatePermission = useCallback(
    (key: keyof PdfEncryptPermissions, value: boolean) => {
      setPermissions((prev) => ({ ...prev, [key]: value }));
      resetOutput();
    },
    [resetOutput],
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

  const restrictions = useMemo(
    () => describeRestrictions(permissions),
    [permissions],
  );

  const truncationWarning = useMemo(
    () => passwordTruncationWarning(password, strength),
    [password, strength],
  );

  /**
   * Restrictions only bind a reader who does not hold the owner password. With
   * no separate one the open password *is* the owner password, so anyone who
   * can open the document can also lift the limits — worth saying before they
   * rely on it.
   */
  const restrictionsAreAdvisory =
    restrictions.length > 0 && ownerPassword.length === 0;

  const handleEncrypt = useCallback(async () => {
    if (!file || isWorking) return;

    resetOutput();

    // Everything knowable without reading the file is checked first, so an
    // oversized file is refused before it is allocated in page memory, and a
    // mistyped confirmation never reaches the engine.
    const invalidMetadata = validateRequestMetadata(
      file.size,
      password,
      confirmPassword,
    );
    if (invalidMetadata) {
      setError(invalidMetadata.message);
      return;
    }

    const options: PdfEncryptOptions = {
      userPassword: password,
      ownerPassword,
      strength,
      permissions,
    };

    const attempt = attemptRef.current;
    setIsWorking(true);

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());

      // Reading the file is async; the user may have moved on, or the page may
      // have unmounted, while it was pending.
      if (attempt !== attemptRef.current) return;

      const invalid = validateRequest(bytes, options);
      if (invalid) {
        setError(invalid.message);
        setIsWorking(false);
        return;
      }

      // A fresh worker per attempt: it starts with clean WASM memory and is
      // terminated as soon as it answers, which discards the file bytes and
      // the password along with them.
      // Served from /pdf/ rather than bundled so the CSP relaxation that
      // WebAssembly needs stays confined to that path — see next.config.ts.
      workerRef.current?.terminate();
      // Classic worker: the qpdf glue is a UMD bundle loaded via importScripts.
      const worker = new Worker(WORKER_URL);
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent<PdfEncryptWorkerResponse>) => {
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

        // `bytes` wraps the whole transferred buffer, so passing `.buffer`
        // straight through is safe and avoids a second copy.
        const blob = new Blob([outcome.bytes.buffer as ArrayBuffer], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);
        resultUrlRef.current = url;
        setResult({
          url,
          name: protectedFileName(file.name),
          size: blob.size,
          strength,
          restrictions: describeRestrictions(permissions),
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

      // The argument list is built by the tested helper rather than in the
      // worker, so the flag contract with qpdf has unit-test coverage.
      const args = buildEncryptArgs(options, INPUT_PATH, OUTPUT_PATH);

      // Transfer the buffer so the bytes are moved, not copied.
      const buffer = bytes.buffer as ArrayBuffer;
      worker.postMessage({ bytes: buffer, args }, [buffer]);
    } catch (e) {
      if (attempt !== attemptRef.current) return;
      setIsWorking(false);
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }, [
    confirmPassword,
    file,
    isWorking,
    ownerPassword,
    password,
    permissions,
    resetOutput,
    strength,
  ]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void handleEncrypt();
    },
    [handleEncrypt],
  );

  // Single spoken summary of the operation. The visible alerts below are marked
  // `role="presentation"` so this is the only thing announced — otherwise the
  // same message would be read twice.
  let liveMessage = "";
  if (isWorking) {
    liveMessage = "Protecting PDF, please wait.";
  } else if (error) {
    liveMessage = `Could not protect the PDF. ${error}`;
  } else if (result) {
    liveMessage = `PDF protected with ${describeStrength(result.strength)} encryption. ${result.name} is ready to download.${
      result.restrictions.length > 0
        ? ` Restricted: ${result.restrictions.join(", ")}.`
        : ""
    }`;
  }

  return (
    <ToolPage>
      <ToolHeader
        title="PDF Password Protector"
        description="Add a password to a PDF so it cannot be opened without one. The file is encrypted in your browser and never uploaded."
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
          <ToolbarGroup label="Encryption">
            <SegmentedControl
              value={strength}
              onChange={(value) => {
                setStrength(value);
                resetOutput();
              }}
              options={strengthOptions}
              ariaLabel="Encryption strength"
            />
          </ToolbarGroup>
          <ToolbarGroup label="Allow">
            <ToolbarCheckbox
              checked={permissions.print}
              onChange={(value) => updatePermission("print", value)}
              label="Printing"
            />
            <ToolbarCheckbox
              checked={permissions.copy}
              onChange={(value) => updatePermission("copy", value)}
              label="Copying"
            />
            <ToolbarCheckbox
              checked={permissions.modify}
              onChange={(value) => updatePermission("modify", value)}
              label="Editing"
            />
            <ToolbarCheckbox
              checked={permissions.annotate}
              onChange={(value) => updatePermission("annotate", value)}
              label="Commenting"
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
                Password applied — {describeStrength(result.strength)}{" "}
                encryption. The protected PDF now asks for the password before
                it will open.
                {result.restrictions.length > 0 && (
                  <> It also blocks {result.restrictions.join(", ")}.</>
                )}
              </span>
            </AlertBox>
          )}

          {/* Both warnings stay up after a successful run. Any edit to the
              password, cipher or permissions clears the result, so what they
              describe is always the file currently offered for download — and
              download is the moment the caveat actually matters. */}
          {truncationWarning && (
            <AlertBox variant="warn" role="presentation">
              <span>{truncationWarning}</span>
            </AlertBox>
          )}

          {restrictionsAreAdvisory && (
            <AlertBox variant="warn" role="presentation">
              <span className="font-medium">
                These restrictions can be lifted by anyone who can open the file
              </span>
              <span className="mt-0.5 text-[12px] text-muted-foreground">
                With no separate permissions password, the password you set is
                also the owner password, so a reader who can open the document
                can remove the limits. Set a permissions password below to make
                them stick.
              </span>
            </AlertBox>
          )}

          {result && result.warnings.length > 0 && (
            <AlertBox variant="warn" role="presentation">
              <span className="font-medium">
                qpdf repaired this file while protecting it
              </span>
              <span className="mt-0.5 text-[12px] text-muted-foreground">
                The protected PDF is usable, but the original was structurally
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
              <ToolLabel>PDF to protect</ToolLabel>
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

            {/* The passwords and the action they gate share a panel, so the
                fields carry the same visual weight as the drop zone above
                instead of reading as an afterthought below it. */}
            <div className="rounded-md border border-border bg-muted/25 p-4">
              <ToolLabel htmlFor="pdf-password">Password</ToolLabel>
              <div className="flex items-center gap-2">
                <Input
                  id="pdf-password"
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    resetOutput();
                  }}
                  placeholder="Password needed to open the PDF"
                  autoComplete="new-password"
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
              <ToolHint id="pdf-password-hint">
                Anyone opening the document will be asked for this. There is no
                way to recover it — if you lose it, the file is unreadable.
              </ToolHint>

              <div className="mt-4">
                <ToolLabel htmlFor="pdf-password-confirm">
                  Confirm password
                </ToolLabel>
                <Input
                  id="pdf-password-confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    resetOutput();
                  }}
                  placeholder="Type it again"
                  autoComplete="new-password"
                  spellCheck={false}
                  aria-describedby="pdf-password-confirm-hint"
                  className="h-10 bg-background font-mono"
                />
                <ToolHint id="pdf-password-confirm-hint">
                  Asked for twice because a typo here produces a file nobody can
                  open, including you.
                </ToolHint>
              </div>

              {/* Only matters once a permission is switched off, so it stays
                  folded away rather than adding a third password field to the
                  path most people take. */}
              <details className="mt-4 rounded-md border border-border bg-background/40 px-3 py-2">
                <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                  Permissions password (optional)
                </summary>
                <div className="mt-3">
                  <ToolLabel htmlFor="pdf-owner-password">
                    Owner password
                  </ToolLabel>
                  <Input
                    id="pdf-owner-password"
                    type={showPassword ? "text" : "password"}
                    value={ownerPassword}
                    onChange={(event) => {
                      setOwnerPassword(event.target.value);
                      resetOutput();
                    }}
                    placeholder="Leave empty to reuse the password above"
                    autoComplete="new-password"
                    spellCheck={false}
                    aria-describedby="pdf-owner-password-hint"
                    className="h-10 bg-background font-mono"
                  />
                  <ToolHint id="pdf-owner-password-hint">
                    A second password that lifts the restrictions above. Set a
                    different one if recipients should be able to open the
                    document but not change what it permits.
                  </ToolHint>
                </div>
              </details>

              {/* Once a result exists the Download button is the thing to
                  reach for, so this steps back rather than competing with it.
                  It returns to primary as soon as an input changes, since that
                  clears the result and means another attempt. */}
              <Button
                type="submit"
                size="lg"
                variant={result ? "outline" : "default"}
                disabled={!file || isWorking}
                className="mt-4 w-full sm:w-auto"
              >
                <FontAwesomeIcon
                  icon={faLock}
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {isWorking ? "Protecting..." : "Protect PDF"}
              </Button>
            </div>
          </form>

          {result && (
            <div>
              <ToolLabel>Protected PDF</ToolLabel>
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
          Store the password somewhere safe before you close this page.
        </strong>{" "}
        The encryption is real: there is no recovery path, no backdoor and no
        copy of the password anywhere. A lost password means a lost document.
      </ToolFootnote>

      <ToolFootnote className="mt-2">
        Encryption runs locally through a WebAssembly build of qpdf — the PDF is
        read in a Web Worker on this device and no bytes are sent anywhere.
        Document content is preserved, though the internal file structure and
        size may change, since streams are recompressed as the file is
        rewritten.
      </ToolFootnote>
    </ToolPage>
  );
}
