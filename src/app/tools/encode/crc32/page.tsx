"use client";

import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faShield } from "@fortawesome/free-solid-svg-icons/faShield";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useMemo, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import { ToolbarGroup, ToolbarSelect } from "@/components/Toolbar";
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
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { useToolState } from "@/hooks/useToolState";
import { MAX_INPUT_SIZE, TEXT_ENCODING_OPTIONS } from "@/lib/constants";
import {
  crc32Finalize,
  crc32FromText,
  crc32HexFromText,
  crc32Update,
} from "@/lib/crc32";
import type { TextEncodingMode } from "@/lib/hex";

const outputFormatOptions = [
  { value: "hex", label: "Hex" },
  { value: "uint32", label: "Unsigned Int" },
] as const;

const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

export default function Crc32Tool() {
  const { readText, pasteError } = useClipboard();
  const [{ input, error }, { setInput, setError }] = useToolState();

  const [encoding, setEncoding] = useState<TextEncodingMode>("utf8");
  const [outputFormat, setOutputFormat] = useState<"hex" | "uint32">("hex");
  const [fileName, setFileName] = useState("");
  const [fileResult, setFileResult] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [fileProgress, setFileProgress] = useState(0);

  const textResult = useMemo(() => {
    if (!input.trim()) return "";
    if (input.length > MAX_INPUT_SIZE) return "";

    try {
      if (outputFormat === "hex") {
        return crc32HexFromText(input, encoding, true);
      }
      return String(crc32FromText(input, encoding));
    } catch {
      return "";
    }
  }, [encoding, input, outputFormat]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) {
      setInput(text);
      setFileName("");
      setFileResult(null);
      setError(null);
    }
  }, [readText, setError, setInput]);

  const handleClear = useCallback(() => {
    setInput("");
    setFileName("");
    setFileResult(null);
    setError(null);
    setIsReadingFile(false);
    setFileProgress(0);
  }, [setError, setInput]);

  const handleFile = useCallback(
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
      setInput("");
      setFileName(file.name);
      setFileResult(null);
      setIsReadingFile(true);
      setFileProgress(0);

      // Stream the file in chunks to avoid loading the entire file into memory.
      // CRC32 is computed incrementally via crc32Update.
      try {
        const reader = file.stream().getReader();
        let crc = 0xffffffff;
        let loaded = 0;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            crc = crc32Update(crc, value);
            loaded += value.byteLength;
            setFileProgress(Math.min(100, (loaded / file.size) * 100));
          }
        }

        const final = crc32Finalize(crc);
        setFileResult(
          outputFormat === "hex"
            ? final.toString(16).padStart(8, "0").toUpperCase()
            : String(final),
        );
      } catch {
        setError("Failed to process file");
        setFileResult(null);
      } finally {
        setIsReadingFile(false);
        inputElement.value = "";
      }
    },
    [outputFormat, setError, setInput],
  );

  const result = fileResult ?? textResult;

  const announcement = useAnnouncement(
    result ? `CRC32 computed. ${result}.` : "",
    500,
    result,
  );

  return (
    <ToolPage>
      <ToolHeader
        title="CRC32 Checksum"
        description="Compute fast CRC32 checksums for text or files locally in your browser"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <label htmlFor="crc-file" className="cursor-pointer">
                <FontAwesomeIcon
                  icon={faUpload}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                Upload
              </label>
            </Button>

            <input
              id="crc-file"
              type="file"
              className="hidden"
              onChange={handleFile}
            />

            {(input || fileName || result) && (
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
          <ToolbarGroup label="Input Encoding" htmlFor="crc32-input-encoding">
            <ToolbarSelect
              id="crc32-input-encoding"
              value={encoding}
              onChange={(value) => setEncoding(value as TextEncodingMode)}
              options={TEXT_ENCODING_OPTIONS}
            />
          </ToolbarGroup>

          <ToolbarGroup label="Output Format" htmlFor="crc32-output-format">
            <ToolbarSelect
              id="crc32-output-format"
              value={outputFormat}
              onChange={(value) => {
                const fmt = value as "hex" | "uint32";
                setOutputFormat(fmt);
                if (fileResult !== null) {
                  const numeric = Number.parseInt(
                    fileResult.startsWith("0x")
                      ? fileResult
                      : outputFormat === "hex"
                        ? `0x${fileResult}`
                        : fileResult,
                    outputFormat === "hex" ? 16 : 10,
                  );
                  setFileResult(
                    fmt === "hex"
                      ? numeric.toString(16).padStart(8, "0").toUpperCase()
                      : String(numeric >>> 0),
                  );
                }
              }}
              options={[...outputFormatOptions]}
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
          {input.length > MAX_INPUT_SIZE && (
            <AlertBox variant="warn">
              <span>
                Input exceeds 1MB — text checksum paused for responsiveness.
              </span>
            </AlertBox>
          )}

          {isReadingFile && (
            <AlertBox variant="warn">
              <span>
                Reading file {fileName}... {fileProgress.toFixed(0)}%
              </span>
            </AlertBox>
          )}

          {fileName && fileResult && (
            <AlertBox variant="success" role="presentation">
              <span>File processed: {fileName}</span>
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
              <ToolLabel htmlFor="crc32-input">Text to Checksum</ToolLabel>
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
              id="crc32-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setFileName("");
                setFileResult(null);
                setError(null);
              }}
              placeholder="Enter text to checksum..."
              rows={8}
              className="font-mono min-h-56"
              spellCheck={false}
            />
          </section>

          {result ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <ToolMeta>CRC32 Result</ToolMeta>
                <CopyButton text={result} />
              </div>
              <Textarea
                readOnly
                value={result}
                rows={4}
                className="field-sizing-content font-mono min-h-24 max-h-[32rem]"
              />
            </section>
          ) : (
            <section>
              <div className="border-t border-border py-12 text-center">
                <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                  <FontAwesomeIcon
                    icon={faShield}
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  The CRC32 checksum appears here as you type
                </p>
              </div>
            </section>
          )}
        </ToolBody>
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Uses incremental chunked file reading with progress. File size is capped
        at 64 MB to keep the UI responsive.
      </ToolFootnote>
    </ToolPage>
  );
}
