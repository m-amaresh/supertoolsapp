"use client";

import { faLink } from "@fortawesome/free-solid-svg-icons/faLink";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faRightLeft } from "@fortawesome/free-solid-svg-icons/faRightLeft";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import {
  SegmentedControl,
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
import {
  decodeUrl,
  encodeUrl,
  type UrlEncodeMode,
  urlEncodeModes,
} from "@/lib/url";

type Mode = "encode" | "decode";

const modeOptions = [
  { value: "component", label: "Component" },
  { value: "full", label: "Full URI" },
];

export default function UrlEncoderDecoder() {
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
  const [encodeMode, setEncodeMode] = useState<UrlEncodeMode>("component");

  const processInput = useCallback(
    (text: string, currentMode: Mode, currentEncodeMode: UrlEncodeMode) => {
      setError(null);
      setOutput("");

      if (!text) return;

      try {
        if (currentMode === "encode") {
          setOutput(encodeUrl(text, currentEncodeMode));
        } else {
          setOutput(decodeUrl(text, currentEncodeMode));
        }
      } catch (e) {
        if (e instanceof URIError) {
          setError(
            "Invalid URL-encoded sequence — check for malformed % escapes",
          );
        } else {
          setError(e instanceof Error ? e.message : "Processing failed");
        }
      }
    },
    [setError, setOutput],
  );

  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);
      processInput(text, mode, encodeMode);
    },
    [encodeMode, mode, processInput, setInput],
  );

  const handleModeChange = useCallback(
    (newMode: Mode) => {
      setMode(newMode);
      setOutput("");
      setError(null);
      if (input) {
        processInput(input, newMode, encodeMode);
      }
    },
    [encodeMode, input, processInput, setError, setOutput],
  );

  const handleEncodeModeChange = useCallback(
    (newMode: string) => {
      const next = newMode as UrlEncodeMode;
      setEncodeMode(next);
      if (input) {
        processInput(input, mode, next);
      }
    },
    [input, mode, processInput],
  );

  const handleSwap = useCallback(() => {
    if (!output) return;

    const newMode = mode === "encode" ? "decode" : "encode";
    setMode(newMode);
    setInput(output);
    processInput(output, newMode, encodeMode);
  }, [encodeMode, mode, output, processInput, setInput]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) {
      setInput(text);
      processInput(text, mode, encodeMode);
    }
  }, [readText, encodeMode, mode, processInput, setInput]);

  const currentModeInfo = urlEncodeModes.find((m) => m.value === encodeMode);

  return (
    <ToolPage>
      <ToolHeader
        title="URL Encoder/Decoder"
        description="Encode and decode URL components"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            {output && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleSwap}
                title="Swap input and output"
                aria-label="Swap input and output"
              >
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
              onChange={handleModeChange}
              ariaLabel="URL mode"
              options={[
                { value: "encode", label: "Encode" },
                { value: "decode", label: "Decode" },
              ]}
            />
          </ToolbarGroup>

          <ToolbarGroup label="Mode" htmlFor="url-encoding-mode">
            <ToolbarSelect
              id="url-encoding-mode"
              value={encodeMode}
              onChange={handleEncodeModeChange}
              options={modeOptions}
            />
          </ToolbarGroup>

          {currentModeInfo && (
            <span className="text-[12px] text-muted-foreground">
              {currentModeInfo.description}
            </span>
          )}
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
              <ToolLabel htmlFor="url-input">
                {mode === "encode" ? "Text to Encode" : "URL to Decode"}
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
              id="url-input"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={
                mode === "encode"
                  ? "Enter text to encode..."
                  : "Enter URL-encoded string to decode..."
              }
              rows={8}
              aria-label={
                mode === "encode" ? "Text to encode" : "URL to decode"
              }
              className="font-mono min-h-56"
              spellCheck={false}
            />
          </section>

          {output ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <ToolMeta>
                  {mode === "encode" ? "Encoded Output" : "Decoded Output"}
                </ToolMeta>
                <CopyButton text={output} />
              </div>
              <Textarea
                readOnly
                value={output}
                rows={8}
                aria-label={
                  mode === "encode" ? "Encoded output" : "Decoded output"
                }
                className="field-sizing-content font-mono min-h-24 max-h-[32rem]"
              />
            </section>
          ) : (
            <section>
              <div className="border-t border-border py-12 text-center">
                <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                  <FontAwesomeIcon
                    icon={faLink}
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
        All processing happens locally in your browser. No data is sent to any
        server.
      </ToolFootnote>
    </ToolPage>
  );
}
