"use client";

import { faFingerprint } from "@fortawesome/free-solid-svg-icons/faFingerprint";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import {
  ToolbarCheckbox,
  ToolbarGroup,
  ToolbarSelect,
} from "@/components/Toolbar";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { useToolState } from "@/hooks/useToolState";
import { MAX_INPUT_SIZE, TEXT_ENCODING_OPTIONS } from "@/lib/constants";
import {
  generateAllHashes,
  generateAllHashesFromBytes,
  generateAllHmacs,
  generateAllHmacsFromBytes,
  type HashAlgorithm,
  type HashOutputEncoding,
  type HashTextEncoding,
  hashAlgorithms,
} from "@/lib/hash";

const outputEncodingOptions = [
  { value: "hex", label: "Hex" },
  { value: "base64", label: "Base64" },
  { value: "base64url", label: "Base64URL" },
] as const;

const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
const DEPRECATED_ALGORITHMS = new Set<HashAlgorithm>(["MD5", "SHA-1"]);

export default function HashGenerator() {
  const { readText, pasteError } = useClipboard();
  const [{ input, error }, { setInput, setError }] = useToolState();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<"text" | "file">("text");
  const [fileName, setFileName] = useState("");
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);

  const [hashes, setHashes] = useState<Record<HashAlgorithm, string> | null>(
    null,
  );

  const [hmacs, setHmacs] = useState<Record<HashAlgorithm, string> | null>(
    null,
  );
  const [hmacEnabled, setHmacEnabled] = useState(false);
  const [hmacKey, setHmacKey] = useState("");
  const [inputEncoding, setInputEncoding] = useState<HashTextEncoding>("utf8");
  const [keyEncoding, setKeyEncoding] = useState<HashTextEncoding>("utf8");
  const [outputEncoding, setOutputEncoding] =
    useState<HashOutputEncoding>("hex");
  const [uppercase, setUppercase] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const hashSeqRef = useRef(0);

  useEffect(() => {
    if (sourceMode === "text" && input.length > MAX_INPUT_SIZE) {
      setHashes(null);
      setHmacs(null);
      setError("Input exceeds 1MB — hashing disabled to prevent UI freezing.");
      setIsProcessing(false);
      return;
    }

    if (sourceMode === "text" && !input) {
      setHashes(null);
      setHmacs(null);
      setError(null);
      setIsProcessing(false);
      return;
    }

    if (sourceMode === "file" && !fileBytes) {
      setHashes(null);
      setHmacs(null);
      setError(null);
      setIsProcessing(false);
      return;
    }

    // Sequence counter + debounce timer ensure only the latest keystroke's
    // result is applied. Earlier in-flight async computations are ignored.
    const seq = ++hashSeqRef.current;
    const timer = setTimeout(() => {
      setIsProcessing(true);
      setError(null);

      Promise.all([
        sourceMode === "file" && fileBytes
          ? generateAllHashesFromBytes(fileBytes, { outputEncoding })
          : generateAllHashes(input, { inputEncoding, outputEncoding }),
        hmacEnabled && hmacKey
          ? sourceMode === "file" && fileBytes
            ? generateAllHmacsFromBytes(fileBytes, hmacKey, {
                keyEncoding,
                outputEncoding,
              })
            : generateAllHmacs(input, hmacKey, {
                inputEncoding,
                keyEncoding,
                outputEncoding,
              })
          : null,
      ])
        .then(([hashResult, hmacResult]) => {
          if (hashSeqRef.current === seq) {
            setHashes(hashResult);
            setHmacs(hmacResult);
          }
        })
        .catch((e) => {
          if (hashSeqRef.current === seq) {
            setHashes(null);
            setHmacs(null);
            setError(
              e instanceof Error ? e.message : "Failed to compute hashes",
            );
          }
        })
        .finally(() => {
          if (hashSeqRef.current === seq) {
            setIsProcessing(false);
          }
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [
    fileBytes,
    hmacEnabled,
    hmacKey,
    input,
    inputEncoding,
    keyEncoding,
    outputEncoding,
    sourceMode,
    setError,
  ]);

  const handleClear = useCallback(() => {
    setSourceMode("text");
    setInput("");
    setFileName("");
    setFileBytes(null);
    setHashes(null);
    setHmacs(null);
    setHmacKey("");
    setIsReadingFile(false);
    setFileReadProgress(0);
  }, [setInput]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) {
      setSourceMode("text");
      setFileName("");
      setFileBytes(null);
      setInput(text);
    }
  }, [readText, setInput]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_UPLOAD_BYTES) {
        setError(
          `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB to keep the browser responsive.`,
        );
        setFileName("");
        setFileBytes(null);
        setSourceMode("text");
        return;
      }

      try {
        setFileName(file.name);
        setIsReadingFile(true);
        setFileReadProgress(0);

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

        setSourceMode("file");
        setFileBytes(merged);
        setInput("");
        setError(null);
      } catch {
        setError("Failed to read file");
      } finally {
        setIsReadingFile(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [setError, setInput],
  );

  const formatHash = (hash: string) =>
    outputEncoding === "hex" && uppercase ? hash.toUpperCase() : hash;

  const allHashesText = hashes
    ? hashAlgorithms
        .map((alg) => `${alg}: ${formatHash(hashes[alg])}`)
        .join("\n")
    : "";

  const allHmacText = hmacs
    ? hashAlgorithms
        .map((alg) => `HMAC-${alg}: ${formatHash(hmacs[alg])}`)
        .join("\n")
    : "";

  const announcement = useAnnouncement(
    hashes
      ? `${Object.keys(hashes).length} digests computed${hmacs ? `, ${Object.keys(hmacs).length} HMACs` : ""}.`
      : "",
    500,
    hmacs ? `${JSON.stringify(hashes)}|${JSON.stringify(hmacs)}` : hashes,
  );

  return (
    <ToolPage>
      <ToolHeader
        title="Hash Generator"
        description="Generate MD5, SHA, SHA3, and HMAC digests from text or files"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            {isReadingFile && (
              <span className="text-[13px] text-muted-foreground">
                Reading file... {fileReadProgress.toFixed(0)}%
              </span>
            )}
            {isProcessing && (
              <span className="text-[13px] text-muted-foreground">
                Computing...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              id="hash-file-input"
            />

            <Button variant="ghost" asChild disabled={isReadingFile}>
              <label
                htmlFor="hash-file-input"
                className={
                  isReadingFile ? "cursor-not-allowed" : "cursor-pointer"
                }
              >
                <FontAwesomeIcon
                  icon={faUpload}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                Upload
              </label>
            </Button>

            {(input || fileBytes) && (
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
          <ToolbarGroup
            label="Input Encoding"
            htmlFor="hash-input-text-encoding"
          >
            <ToolbarSelect
              id="hash-input-text-encoding"
              value={inputEncoding}
              onChange={(value) => setInputEncoding(value as HashTextEncoding)}
              options={TEXT_ENCODING_OPTIONS}
            />
          </ToolbarGroup>

          {hmacEnabled && (
            <ToolbarGroup label="Key Encoding" htmlFor="hash-hmac-key-encoding">
              <ToolbarSelect
                id="hash-hmac-key-encoding"
                value={keyEncoding}
                onChange={(value) => setKeyEncoding(value as HashTextEncoding)}
                options={TEXT_ENCODING_OPTIONS}
              />
            </ToolbarGroup>
          )}

          <ToolbarGroup
            label="Output Encoding"
            htmlFor="hash-digest-output-encoding"
          >
            <ToolbarSelect
              id="hash-digest-output-encoding"
              value={outputEncoding}
              onChange={(value) =>
                setOutputEncoding(value as HashOutputEncoding)
              }
              options={[...outputEncodingOptions]}
            />
          </ToolbarGroup>

          <ToolbarCheckbox
            checked={uppercase}
            onChange={setUppercase}
            label="Uppercase"
          />
          <ToolbarCheckbox
            checked={hmacEnabled}
            onChange={setHmacEnabled}
            label="Enable HMAC"
          />
        </ToolOptionsBar>

        <ToolStatusStack>
          {pasteError && (
            <AlertBox variant="error">
              <span>
                Clipboard access denied — use Ctrl+V / Cmd+V to paste directly.
              </span>
            </AlertBox>
          )}
          {sourceMode === "text" && input.length > MAX_INPUT_SIZE && (
            <AlertBox variant="warn">
              <span>
                Input exceeds 1MB — hashing disabled to prevent UI freezing.
              </span>
            </AlertBox>
          )}

          {sourceMode === "file" && fileBytes && (
            <AlertBox variant="success" role="presentation">
              <span>
                Hashing file: {fileName} (
                {(fileBytes.byteLength / (1024 * 1024)).toFixed(2)} MB)
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

          {error && (
            <AlertBox variant="error">
              <span>{error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="hash-input-text">Text to Hash</ToolLabel>
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
              id="hash-input-text"
              value={input}
              onChange={(e) => {
                setSourceMode("text");
                setFileName("");
                setFileBytes(null);
                setInput(e.target.value);
              }}
              placeholder="Enter text to hash..."
              rows={8}
              aria-label="Input text"
              className="font-mono min-h-56"
              spellCheck={false}
            />
          </section>

          {hmacEnabled && (
            <section>
              <ToolLabel htmlFor="hash-hmac-key">HMAC Key</ToolLabel>
              <Input
                id="hash-hmac-key"
                type="password"
                value={hmacKey}
                onChange={(e) => setHmacKey(e.target.value)}
                placeholder="Enter secret key..."
                aria-label="HMAC secret key"
                autoComplete="off"
                className="h-9 text-[13px] font-mono"
                spellCheck={false}
              />
            </section>
          )}
        </ToolBody>

        {hashes ? (
          <TooltipProvider>
            <div className="border-t border-border">
              <div className="flex items-center justify-between px-4 py-3">
                <ToolMeta>Hash Results</ToolMeta>
                {hashes && <CopyButton text={allHashesText} />}
              </div>
              <div className="divide-y divide-border">
                {hashAlgorithms.map((alg) => (
                  <div key={alg} className="flex items-start gap-4 px-4 py-3">
                    <ToolMeta className="w-24 shrink-0 flex items-center gap-1 pt-0.5">
                      {alg}
                      {DEPRECATED_ALGORITHMS.has(alg) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {/* A real <button>: the badge alone was a 34x16
                                span with tabIndex -1, so the tooltip was
                                unreachable by keyboard and failed the 24px
                                target minimum. The wrapper carries the hit
                                area and focus; the badge keeps the look. */}
                            <button
                              type="button"
                              aria-label={`Warning: ${alg} is insecure`}
                              className="inline-flex h-6 min-w-6 items-center justify-center rounded px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Badge
                                variant="outline"
                                aria-hidden="true"
                                className="h-4 px-1 text-[9px] text-warn-foreground border-warn dark:text-warn-foreground dark:border-warn"
                              >
                                Weak
                              </Badge>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {alg} is cryptographically broken — use SHA-256+ for
                            security
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </ToolMeta>
                    <code className="flex-1 break-all font-mono text-[13px] leading-relaxed text-foreground">
                      {formatHash(hashes[alg])}
                    </code>
                    <CopyButton text={formatHash(hashes[alg])} />
                  </div>
                ))}
              </div>
            </div>
          </TooltipProvider>
        ) : (
          <div className="border-t py-12 text-center border-border">
            <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
              <FontAwesomeIcon
                icon={faFingerprint}
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              Digests appear here as you type
            </p>
          </div>
        )}

        {hmacEnabled && (
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <ToolMeta>HMAC Results</ToolMeta>
              {hmacs && <CopyButton text={allHmacText} />}
            </div>

            {hmacs ? (
              <TooltipProvider>
                <div className="divide-y divide-border">
                  {hashAlgorithms.map((alg) => (
                    <div
                      key={`hmac-${alg}`}
                      className="flex items-start gap-4 px-4 py-3"
                    >
                      <ToolMeta className="w-24 shrink-0 flex items-center gap-1 pt-0.5">
                        {alg}
                        {DEPRECATED_ALGORITHMS.has(alg) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* A real <button>: the badge alone was a 34x16
                                  span with tabIndex -1, so the tooltip was
                                  unreachable by keyboard and failed the 24px
                                  target minimum. The wrapper carries the hit
                                  area and focus; the badge keeps the look. */}
                              <button
                                type="button"
                                aria-label={`Warning: ${alg} is insecure`}
                                className="inline-flex h-6 min-w-6 items-center justify-center rounded px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <Badge
                                  variant="outline"
                                  aria-hidden="true"
                                  className="h-4 px-1 text-[9px] text-warn-foreground border-warn dark:text-warn-foreground dark:border-warn"
                                >
                                  Weak
                                </Badge>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              HMAC-{alg} uses a weak hash — prefer HMAC-SHA-256+
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </ToolMeta>
                      <code className="flex-1 break-all font-mono text-[13px] leading-relaxed text-foreground">
                        {formatHash(hmacs[alg])}
                      </code>
                      <CopyButton text={formatHash(hmacs[alg])} />
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            ) : (
              <div className="px-4 pb-4">
                <p className="text-[12px] text-muted-foreground">
                  Enter an HMAC key to generate keyed hashes.
                </p>
              </div>
            )}
          </div>
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Supports UTF-8, Latin-1, and Hex input encoding with
        Hex/Base64/Base64URL output. Includes MD5, SHA-1, SHA-256, SHA-512, and
        SHA3-256, plus keyed HMAC. MD5 and SHA-1 are provided for compatibility
        — use SHA-256 or stronger for security-sensitive applications. All
        processing happens locally. File upload hashing is capped at 16 MB for
        responsiveness.
      </ToolFootnote>
    </ToolPage>
  );
}
