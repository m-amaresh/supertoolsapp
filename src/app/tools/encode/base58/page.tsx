"use client";

import { faCalculator } from "@fortawesome/free-solid-svg-icons/faCalculator";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faRightLeft } from "@fortawesome/free-solid-svg-icons/faRightLeft";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useRef, useState } from "react";
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
  type Base58TextEncoding,
  type Base58Variant,
  decodeBase58,
  encodeBase58,
} from "@/lib/base58";
import { MAX_INPUT_SIZE, TEXT_ENCODING_OPTIONS } from "@/lib/constants";

type Mode = "encode" | "decode";

const variantOptions = [
  { value: "base58", label: "Base58" },
  { value: "base58check", label: "Base58Check" },
] as const;

export default function Base58Tool() {
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
  const [encoding, setEncoding] = useState<Base58TextEncoding>("utf8");
  const [variant, setVariant] = useState<Base58Variant>("base58");
  const [isProcessing, setIsProcessing] = useState(false);
  const seqRef = useRef(0);

  const processInput = useCallback(
    async (
      text: string,
      currentMode: Mode,
      currentEncoding: Base58TextEncoding,
      currentVariant: Base58Variant,
    ) => {
      const seq = ++seqRef.current;
      setError(null);
      setOutput("");

      if (!text.trim()) {
        setIsProcessing(false);
        return;
      }
      if (text.length > MAX_INPUT_SIZE) {
        setError(
          "Input exceeds 1MB — processing disabled to prevent UI freezing.",
        );
        setIsProcessing(false);
        return;
      }

      setIsProcessing(true);
      try {
        const result =
          currentMode === "encode"
            ? await encodeBase58(text, {
                inputEncoding: currentEncoding,
                variant: currentVariant,
              })
            : await decodeBase58(text, {
                outputEncoding: currentEncoding,
                variant: currentVariant,
              });

        if (seqRef.current === seq) {
          setOutput(result);
        }
      } catch (e) {
        if (seqRef.current === seq) {
          setError(e instanceof Error ? e.message : "Failed to process");
        }
      } finally {
        if (seqRef.current === seq) {
          setIsProcessing(false);
        }
      }
    },
    [setError, setOutput],
  );

  const handleInputChange = useCallback(
    (text: string) => {
      setInput(text);
      void processInput(text, mode, encoding, variant);
    },
    [encoding, mode, processInput, setInput, variant],
  );

  const handleSwap = useCallback(() => {
    if (!output) return;
    const nextMode: Mode = mode === "encode" ? "decode" : "encode";
    setMode(nextMode);
    setInput(output);
    void processInput(output, nextMode, encoding, variant);
  }, [encoding, mode, output, processInput, setInput, variant]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) {
      setInput(text);
      void processInput(text, mode, encoding, variant);
    }
  }, [encoding, mode, processInput, readText, setInput, variant]);

  // Bump the sequence counter to discard results from any in-flight async
  // conversion that may resolve after the UI has been cleared.
  const handleFullClear = useCallback(() => {
    seqRef.current += 1;
    setIsProcessing(false);
    handleClear();
  }, [handleClear]);

  return (
    <ToolPage>
      <ToolHeader
        title="Base58/Base58Check Encoder/Decoder"
        description="Convert text data with Bitcoin-style Base58 and Base58Check"
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
            {isProcessing && (
              <span className="text-[12px] text-muted-foreground">
                Processing...
              </span>
            )}
            {(input || output) && (
              <Button type="button" variant="ghost" onClick={handleFullClear}>
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
                void processInput(input, nextMode, encoding, variant);
              }}
              ariaLabel="Base58 mode"
              options={[
                { value: "encode", label: "Encode" },
                { value: "decode", label: "Decode" },
              ]}
            />
          </ToolbarGroup>

          <ToolbarGroup
            label={mode === "encode" ? "Input Encoding" : "Output Encoding"}
            htmlFor="base58-text-encoding"
          >
            <ToolbarSelect
              id="base58-text-encoding"
              value={encoding}
              onChange={(value) => {
                const next = value as Base58TextEncoding;
                setEncoding(next);
                void processInput(input, mode, next, variant);
              }}
              options={TEXT_ENCODING_OPTIONS}
            />
          </ToolbarGroup>

          <ToolbarGroup label="Variant" htmlFor="base58-variant">
            <ToolbarSelect
              id="base58-variant"
              value={variant}
              onChange={(value) => {
                const next = value as Base58Variant;
                setVariant(next);
                void processInput(input, mode, encoding, next);
              }}
              options={[...variantOptions]}
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
              <span>Large input detected. Processing is capped at 1MB.</span>
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
              <ToolLabel htmlFor="base58-input">
                {mode === "encode" ? "Text to Encode" : "Base58 to Decode"}
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
              id="base58-input"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              rows={8}
              className="font-mono min-h-56"
              spellCheck={false}
              placeholder={
                mode === "encode"
                  ? "Enter text to encode..."
                  : "Enter Base58 or Base58Check value..."
              }
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
                className="field-sizing-content font-mono min-h-24 max-h-[32rem]"
              />
            </section>
          ) : (
            <section>
              <div className="border-t border-border py-12 text-center">
                <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                  <FontAwesomeIcon
                    icon={faCalculator}
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
        Uses the Bitcoin Base58 alphabet (no 0/O/I/l). Base58Check mode adds or
        validates the 4-byte double-SHA256 checksum locally in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}
