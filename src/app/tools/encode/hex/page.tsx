"use client";

import { faHashtag } from "@fortawesome/free-solid-svg-icons/faHashtag";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faRightLeft } from "@fortawesome/free-solid-svg-icons/faRightLeft";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import {
  SegmentedControl,
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { useToolState } from "@/hooks/useToolState";
import { MAX_INPUT_SIZE, TEXT_ENCODING_OPTIONS } from "@/lib/constants";
import {
  decodeHex,
  encodeHex,
  fileToHex,
  isValidHex,
  type TextEncodingMode,
} from "@/lib/hex";

type Mode = "encode" | "decode";

const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;

export default function HexTool() {
  const { readText, pasteError } = useClipboard();
  const [
    { input, output, error },
    { setInput, setOutput, setError, handleClear },
  ] = useToolState();

  const [mode, setMode] = useState<Mode>("encode");

  const announcement = useAnnouncement(
    output
      ? `${mode === "encode" ? "Encoded" : "Decoded"}. ${output.length} characters.`
      : "",
    500,
    output,
  );
  const [encoding, setEncoding] = useState<TextEncodingMode>("utf8");
  const [uppercase, setUppercase] = useState(true);

  const process = useCallback(
    (
      text: string,
      nextMode: Mode,
      nextEncoding: TextEncodingMode,
      nextUppercase?: boolean,
    ) => {
      const useUppercase = nextUppercase ?? uppercase;

      setInput(text);
      setOutput("");
      setError(null);

      if (!text.trim()) return;

      if (text.length > MAX_INPUT_SIZE) {
        setError(
          "Input exceeds 1MB — processing disabled to prevent UI freezing.",
        );
        return;
      }

      try {
        if (nextMode === "encode") {
          setOutput(
            encodeHex(text, {
              inputEncoding: nextEncoding,
              uppercase: useUppercase,
            }),
          );
        } else {
          if (!isValidHex(text)) {
            setError("Invalid hex string");
            return;
          }
          setOutput(decodeHex(text, { outputEncoding: nextEncoding }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to process");
      }
    },
    [uppercase, setError, setInput, setOutput],
  );

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) process(text, mode, encoding);
  }, [readText, encoding, mode, process]);

  const handleSwap = useCallback(() => {
    if (!output) return;
    const nextMode: Mode = mode === "encode" ? "decode" : "encode";
    setMode(nextMode);
    process(output, nextMode, encoding);
  }, [encoding, mode, output, process]);

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

      try {
        const hex = await fileToHex(file, { uppercase });
        setMode("encode");
        setInput("");
        setOutput(hex);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read file");
      } finally {
        inputElement.value = "";
      }
    },
    [uppercase, setError, setInput, setOutput],
  );

  return (
    <ToolPage>
      <ToolHeader
        title="Hex Encoder/Decoder"
        description="Convert text and bytes to hexadecimal and decode hex back"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            {output && (
              <Button type="button" variant="ghost" onClick={handleSwap}>
                <FontAwesomeIcon
                  icon={faRightLeft}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                Swap
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <label htmlFor="hex-upload" className="cursor-pointer">
                <FontAwesomeIcon
                  icon={faUpload}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                Upload
              </label>
            </Button>
            <input
              id="hex-upload"
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            {(input || output) && (
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
              onChange={(value) => {
                const nextMode = value as Mode;
                setMode(nextMode);
                process(input, nextMode, encoding);
              }}
              ariaLabel="Hex mode"
              options={[
                { value: "encode", label: "Encode" },
                { value: "decode", label: "Decode" },
              ]}
            />
          </ToolbarGroup>

          <ToolbarGroup
            label={mode === "encode" ? "Input Encoding" : "Output Encoding"}
            htmlFor="hex-text-encoding"
          >
            <ToolbarSelect
              id="hex-text-encoding"
              value={encoding}
              onChange={(value) => {
                const nextEncoding = value as TextEncodingMode;
                setEncoding(nextEncoding);
                process(input, mode, nextEncoding);
              }}
              options={TEXT_ENCODING_OPTIONS}
            />
          </ToolbarGroup>

          <ToolbarCheckbox
            checked={uppercase}
            onChange={(checked) => {
              setUppercase(checked);
              if (mode === "encode") {
                process(input, mode, encoding, checked);
              } else if (output) {
                setOutput(
                  checked ? output.toUpperCase() : output.toLowerCase(),
                );
              }
            }}
            label="Uppercase"
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
          {error && (
            <AlertBox variant="error">
              <span>{error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="hex-input">
                {mode === "encode" ? "Text to Encode" : "Hex to Decode"}
              </ToolLabel>
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
              id="hex-input"
              value={input}
              onChange={(e) => process(e.target.value, mode, encoding)}
              placeholder={mode === "encode" ? "Enter text..." : "Enter hex..."}
              rows={8}
              className="font-mono min-h-56"
              spellCheck={false}
            />
          </section>

          {output ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <ToolMeta>
                  {mode === "encode" ? "Hex Output" : "Decoded Text"}
                </ToolMeta>
                <CopyButton text={output} />
              </div>
              <Textarea
                value={output}
                readOnly
                rows={8}
                className="field-sizing-content font-mono min-h-24 max-h-[32rem]"
              />
            </section>
          ) : (
            <section>
              <div className="border-t border-border py-12 text-center">
                <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                  <FontAwesomeIcon
                    icon={faHashtag}
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {mode === "encode" ? "Encoded" : "Decoded"} output appears
                  here as you type
                </p>
              </div>
            </section>
          )}
        </ToolBody>
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Supports UTF-8, Latin-1, and raw hex input modes. File to hex conversion
        is capped at 16 MB for responsiveness.
      </ToolFootnote>
    </ToolPage>
  );
}
