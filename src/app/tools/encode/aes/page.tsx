"use client";

import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload";
import { faLock } from "@fortawesome/free-solid-svg-icons/faLock";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faPlay } from "@fortawesome/free-solid-svg-icons/faPlay";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import {
  SegmentedControl,
  ToolbarGroup,
  ToolbarSelect,
} from "@/components/Toolbar";
import { RunShortcutHint } from "@/components/tool/RunShortcutHint";
import {
  ToolBody,
  ToolCard,
  ToolFootnote,
  ToolHeader,
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
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncer } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { useFocusResult, useRunShortcut } from "@/hooks/useRunShortcut";
import { useToolState } from "@/hooks/useToolState";
import {
  type AesTextEncoding,
  bytesToText,
  decryptPayloadAesGcm,
  encryptBytesAesGcm,
  parseAesPayload,
  serializeAesPayload,
  textToBytes,
} from "@/lib/aes";
import { MAX_INPUT_SIZE, TEXT_ENCODING_OPTIONS } from "@/lib/constants";

type Mode = "encrypt" | "decrypt";
type SourceMode = "text" | "file";

const iterationOptions = [
  { value: "150000", label: "150k" },
  { value: "250000", label: "250k (Recommended)" },
  { value: "500000", label: "500k" },
] as const;

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
const MIN_PASSPHRASE_LENGTH = 12;

export default function AesGcmTool() {
  const { readText, pasteError } = useClipboard();
  const [{ input, output, error }, { setInput, setOutput, setError }] =
    useToolState();

  const [mode, setMode] = useState<Mode>("encrypt");
  const [sourceMode, setSourceMode] = useState<SourceMode>("text");
  const [passphrase, setPassphrase] = useState("");
  const [textEncoding, setTextEncoding] = useState<AesTextEncoding>("utf8");
  const [iterations, setIterations] = useState("250000");
  const [fileName, setFileName] = useState("");
  const [fileMime, setFileMime] = useState("");
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [announcement, announce] = useAnnouncer();
  const [success, setSuccess] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("decrypted.bin");

  // Revoke blob URLs on unmount or when a new one is created to prevent memory leaks.
  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const effectiveInputLabel = useMemo(() => {
    if (mode === "encrypt") {
      return sourceMode === "text" ? "Plaintext to Encrypt" : "File to Encrypt";
    }

    return sourceMode === "text"
      ? "Payload to Decrypt"
      : "Payload File to Decrypt";
  }, [mode, sourceMode]);

  const isEncryptFileMode = mode === "encrypt" && sourceMode === "file";
  const inputValue = isEncryptFileMode
    ? fileName
      ? `Loaded file: ${fileName}${fileBytes ? ` (${(fileBytes.byteLength / (1024 * 1024)).toFixed(2)} MB)` : ""}`
      : ""
    : input;

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setPassphrase("");
    setFileName("");
    setFileMime("");
    setFileBytes(null);
    setError(null);
    setSuccess(null);
    setIsReadingFile(false);
    setFileReadProgress(0);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setDownloadUrl(null);
  }, [downloadUrl, setError, setInput, setOutput]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) {
      setSourceMode("text");
      setInput(text);
      setFileName("");
      setFileMime("");
      setFileBytes(null);
      setError(null);
      setSuccess(null);
    }
  }, [readText, setError, setInput]);

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const inputElement = event.currentTarget;
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`,
        );
        inputElement.value = "";
        return;
      }

      setError(null);
      setSuccess(null);
      setSourceMode("file");
      setIsReadingFile(true);
      setFileReadProgress(0);
      setFileName(file.name);
      setFileMime(file.type || "application/octet-stream");
      setFileBytes(null);
      setInput("");

      try {
        if (mode === "encrypt") {
          const reader = file.stream().getReader();
          const chunks: Uint8Array[] = [];
          let loaded = 0;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              loaded += value.byteLength;
              setFileReadProgress((loaded / file.size) * 100);
            }
          }

          const merged = new Uint8Array(loaded);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
          }
          // Release chunk references as soon as merge completes.
          chunks.length = 0;

          setFileBytes(merged);
          setSuccess(`Loaded file: ${file.name}`);
        } else {
          const text = await file.text();
          setInput(text);
          setFileReadProgress(100);
          setSuccess(`Loaded encrypted payload file: ${file.name}`);
        }
      } catch {
        setError("Failed to read file");
      } finally {
        setIsReadingFile(false);
        inputElement.value = "";
      }
    },
    [mode, setError, setInput],
  );

  const [resultRef, focusResultOnNextRender] =
    useFocusResult<HTMLTextAreaElement>();

  const handleExecute = useCallback(async () => {
    setError(null);
    setSuccess(null);
    setOutput("");

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    if (!passphrase) {
      setError("Passphrase is required");
      return;
    }

    if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
      setError(
        `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
      );
      return;
    }

    if (sourceMode === "text" && input.length > MAX_INPUT_SIZE) {
      setError("Input exceeds 1MB — switch to file mode for large content.");
      return;
    }

    setIsProcessing(true);

    try {
      // Encrypt path: convert text/file to bytes, encrypt, then armor as
      // a portable string. Decrypt path: parse armored payload, decrypt,
      // then either render text or offer a file download based on metadata.
      if (mode === "encrypt") {
        const plaintextBytes =
          sourceMode === "file" ? fileBytes : textToBytes(input, textEncoding);

        if (!plaintextBytes) {
          setError(
            sourceMode === "file"
              ? "Upload a file to encrypt"
              : "Enter plaintext to encrypt",
          );
          return;
        }

        const payload = await encryptBytesAesGcm(plaintextBytes, passphrase, {
          iterations: Number.parseInt(iterations, 10),
          name: sourceMode === "file" ? fileName : undefined,
          type: sourceMode === "file" ? fileMime : undefined,
        });

        const armored = serializeAesPayload(payload);
        setOutput(armored);
        setSuccess("Encryption complete");
        focusResultOnNextRender();
        announce("Encryption complete");
      } else {
        if (!input.trim()) {
          setError(
            sourceMode === "file"
              ? "Upload an encrypted payload file"
              : "Enter encrypted payload",
          );
          return;
        }

        const payload = parseAesPayload(input);
        const decrypted = await decryptPayloadAesGcm(payload, passphrase);

        // If the payload has a filename, the original was a file upload —
        // copy bytes into a dedicated buffer for the Blob (the crypto output
        // may share an underlying ArrayBuffer).
        if (payload.name) {
          const decryptedCopy = new Uint8Array(decrypted.byteLength);
          decryptedCopy.set(decrypted);
          const blob = new Blob([decryptedCopy.buffer as ArrayBuffer], {
            type: payload.type || "application/octet-stream",
          });
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          setDownloadName(payload.name);
          setOutput(`Decrypted ${decrypted.byteLength} bytes`);
          setSuccess("Decryption complete. File download is ready.");
          focusResultOnNextRender();
          announce("Decryption complete. File download is ready.");
        } else {
          setOutput(bytesToText(decrypted, textEncoding));
          setSuccess("Decryption complete");
          focusResultOnNextRender();
          announce("Decryption complete");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process");
    } finally {
      setIsProcessing(false);
    }
  }, [
    announce,
    downloadUrl,
    fileBytes,
    fileMime,
    fileName,
    focusResultOnNextRender,
    input,
    iterations,
    mode,
    passphrase,
    setError,
    setOutput,
    sourceMode,
    textEncoding,
  ]);

  useRunShortcut(handleExecute, !isProcessing);

  return (
    <ToolPage>
      <ToolHeader
        title="AES-GCM Encrypt/Decrypt"
        description="Authenticated encryption with AES-256-GCM and PBKDF2 key derivation"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              onClick={handleExecute}
              aria-keyshortcuts="Meta+Enter Control+Enter"
            >
              <FontAwesomeIcon
                icon={faPlay}
                className="h-3 w-3"
                aria-hidden="true"
              />
              {isProcessing
                ? "Working..."
                : mode === "encrypt"
                  ? "Encrypt"
                  : "Decrypt"}
              <RunShortcutHint />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <label htmlFor="aes-upload" className="cursor-pointer">
                <FontAwesomeIcon
                  icon={faUpload}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                Upload
              </label>
            </Button>

            <input
              id="aes-upload"
              type="file"
              className="hidden"
              onChange={handleUpload}
            />

            {(input || output || fileBytes) && (
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
          <ToolbarGroup label="Operation">
            <SegmentedControl
              value={mode}
              onChange={(value) => setMode(value as Mode)}
              ariaLabel="AES operation"
              options={[
                { value: "encrypt", label: "Encrypt" },
                { value: "decrypt", label: "Decrypt" },
              ]}
            />
          </ToolbarGroup>

          <ToolbarGroup label="Source">
            <SegmentedControl
              value={sourceMode}
              onChange={(value) => setSourceMode(value as SourceMode)}
              ariaLabel="AES input source"
              options={[
                { value: "text", label: "Text" },
                { value: "file", label: "File" },
              ]}
            />
          </ToolbarGroup>

          <ToolbarGroup
            label={mode === "encrypt" ? "Input Encoding" : "Output Encoding"}
            htmlFor="aes-text-encoding"
          >
            <ToolbarSelect
              id="aes-text-encoding"
              value={textEncoding}
              onChange={(value) => setTextEncoding(value as AesTextEncoding)}
              options={TEXT_ENCODING_OPTIONS}
            />
          </ToolbarGroup>

          <ToolbarGroup
            label="PBKDF2 Iterations"
            htmlFor="aes-pbkdf2-iteration-count"
          >
            <ToolbarSelect
              id="aes-pbkdf2-iteration-count"
              value={iterations}
              onChange={setIterations}
              options={[...iterationOptions]}
            />
          </ToolbarGroup>
        </ToolOptionsBar>

        <ToolStatusStack>
          {pasteError && (
            <AlertBox variant="error">
              <span>
                Clipboard access denied — use Ctrl+V / Cmd+V to paste directly.
              </span>
            </AlertBox>
          )}
          {isReadingFile && (
            <AlertBox variant="warn">
              <span>
                Reading file {fileName}... {fileReadProgress.toFixed(0)}%
              </span>
            </AlertBox>
          )}

          {success && (
            <AlertBox variant="success" role="presentation">
              <span>{success}</span>
            </AlertBox>
          )}

          {error && (
            <AlertBox variant="error">
              <span>{error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <section>
            <ToolLabel htmlFor="aes-passphrase">Passphrase</ToolLabel>
            <Input
              id="aes-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder={`Enter passphrase (min ${MIN_PASSPHRASE_LENGTH} chars)`}
              className="font-mono h-10"
              aria-label="AES passphrase"
              autoComplete="off"
              spellCheck={false}
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="aes-input">{effectiveInputLabel}</ToolLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePaste}
              >
                <FontAwesomeIcon
                  icon={faPaste}
                  className="h-2.5 w-2.5"
                  aria-hidden="true"
                />
                Paste
              </Button>
            </div>
            <Textarea
              id="aes-input"
              value={inputValue}
              onChange={(e) => {
                if (isEncryptFileMode) return;
                setInput(e.target.value);
                if (sourceMode === "file") {
                  setSourceMode("text");
                  setFileName("");
                  setFileMime("");
                  setFileBytes(null);
                }
              }}
              placeholder={
                sourceMode === "text"
                  ? mode === "encrypt"
                    ? "Enter plaintext to encrypt..."
                    : "Paste encrypted payload (st-aesgcm:...)..."
                  : mode === "encrypt"
                    ? "Use Upload to select a single file to encrypt"
                    : "Upload encrypted payload file or paste payload here"
              }
              rows={8}
              className="font-mono min-h-56"
              readOnly={isEncryptFileMode}
              spellCheck={false}
            />
          </section>
        </ToolBody>

        {output ? (
          <div className="border-t px-4 pb-4 pt-4 border-border">
            <div className="mb-2 flex items-center justify-between">
              <ToolMeta>
                {mode === "encrypt" ? "Encrypted Payload" : "Decrypted Output"}
              </ToolMeta>
              <CopyButton text={output} />
            </div>

            <Textarea
              readOnly
              ref={resultRef}
              value={output}
              rows={8}
              className="field-sizing-content font-mono min-h-24 max-h-[32rem]"
            />

            {downloadUrl && (
              <div className="mt-3">
                <Button variant="secondary" asChild>
                  <a href={downloadUrl} download={downloadName}>
                    <FontAwesomeIcon
                      icon={faDownload}
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                    Download {downloadName}
                  </a>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="border-t border-border py-12 text-center">
            <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
              <FontAwesomeIcon
                icon={faLock}
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              Enter input, passphrase, and click{" "}
              {mode === "encrypt" ? "Encrypt" : "Decrypt"}
            </p>
          </div>
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Uses AES-256-GCM with random 96-bit IV and PBKDF2-SHA256 key derivation.
        Payload format is armored as <code>st-aesgcm:...</code>. All processing
        happens locally in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}
