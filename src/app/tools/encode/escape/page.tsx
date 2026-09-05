"use client";

import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faRightLeft } from "@fortawesome/free-solid-svg-icons/faRightLeft";
import { faShieldHalved } from "@fortawesome/free-solid-svg-icons/faShieldHalved";
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
import { MAX_INPUT_SIZE } from "@/lib/constants";
import {
  ESCAPE_MODE_LABELS,
  type EscapeMode,
  escapeString,
  unescapeString,
} from "@/lib/escape";

const modeOptions = [
  { value: "html", label: "HTML Entities" },
  { value: "json", label: "JSON" },
  { value: "url", label: "URL (Percent)" },
  { value: "regex", label: "Regex" },
];

const directionOptions = [
  { value: "escape", label: "Escape" },
  { value: "unescape", label: "Unescape" },
];

export default function StringEscape() {
  const { readText, pasteError } = useClipboard();
  const [{ input }, { setInput, handleClear }] = useToolState();

  const [mode, setMode] = useState<EscapeMode>("html");
  const [direction, setDirection] = useState<"escape" | "unescape">("escape");

  const oversized = input.length > MAX_INPUT_SIZE;

  const output = useMemo(() => {
    if (!input || oversized) return "";
    return direction === "escape"
      ? escapeString(input, mode)
      : unescapeString(input, mode);
  }, [direction, input, mode, oversized]);

  const announcement = useAnnouncement(
    output
      ? `${direction === "escape" ? "Escaped" : "Unescaped"} as ${mode}. ${output.length} characters.`
      : "",
    500,
    output,
  );

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setInput(text);
  }, [readText, setInput]);

  const handleSwap = useCallback(() => {
    setInput(output);
    setDirection((d) => (d === "escape" ? "unescape" : "escape"));
  }, [output, setInput]);

  return (
    <ToolPage>
      <ToolHeader
        title="String Escape / Unescape"
        description="Escape and unescape strings for HTML, JSON, URL, and regex"
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
            {input && (
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
          <ToolbarGroup label="Mode" htmlFor="escape-mode">
            <ToolbarSelect
              id="escape-mode"
              value={mode}
              onChange={(v) => setMode(v as EscapeMode)}
              options={modeOptions}
            />
          </ToolbarGroup>

          <ToolbarGroup label="Direction" htmlFor="escape-direction">
            <ToolbarSelect
              id="escape-direction"
              value={direction}
              onChange={(v) => setDirection(v as "escape" | "unescape")}
              options={directionOptions}
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
          {oversized && (
            <AlertBox variant="warn">
              <span>
                Input exceeds 1MB — processing disabled to prevent UI freezing.
              </span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="grid divide-y divide-border p-0 md:grid-cols-2 md:divide-x md:divide-y-0">
          <section className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="escape-input">
                {direction === "escape" ? "Text to Escape" : "Text to Unescape"}
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
              id="escape-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Enter text to ${direction}...`}
              rows={8}
              aria-label={
                direction === "escape" ? "Text to escape" : "Text to unescape"
              }
              className="font-mono min-h-56"
              spellCheck={false}
            />
          </section>

          <section className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="escape-output">
                Output ({ESCAPE_MODE_LABELS[mode]}{" "}
                {direction === "escape" ? "escaped" : "unescaped"})
              </ToolLabel>
              {output && <CopyButton text={output} />}
            </div>

            {output ? (
              <Textarea
                id="escape-output"
                readOnly
                value={output}
                rows={8}
                aria-label="Output text"
                className="font-mono min-h-56 max-h-[32rem]"
              />
            ) : (
              <div className="border-t border-border py-12 text-center">
                <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                  <FontAwesomeIcon
                    icon={faShieldHalved}
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {direction === "escape" ? "Escaped" : "Unescaped"} output
                  appears here as you type
                </p>
              </div>
            )}
          </section>
        </ToolBody>
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Converts special characters for safe use in HTML, JSON, URLs, or regex
        patterns. All processing happens locally in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}
