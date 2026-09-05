"use client";

import { faFileCode } from "@fortawesome/free-solid-svg-icons/faFileCode";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faTurnDown } from "@fortawesome/free-solid-svg-icons/faTurnDown";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useRef, useState } from "react";
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
  shouldShowValidJsonStatus,
  sortJsonKeys,
  validateJson,
} from "@/lib/json";

type OutputMode = "format" | "minify";

const indentOptions = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tab" },
];

export default function JsonFormatter() {
  const { readText, pasteError } = useClipboard();
  const [{ input, output }, { setInput, setOutput, handleClear }] =
    useToolState();

  const [outputMode, setOutputMode] = useState<OutputMode>("format");
  const [indent, setIndent] = useState("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [error, setError] = useState<{
    message: string;
    line?: number;
    column?: number;
  } | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oversized = input.length > MAX_INPUT_SIZE;

  const processJson = useCallback(
    (
      text: string,
      indentVal: string,
      shouldSort: boolean,
      mode: OutputMode,
    ) => {
      setError(null);
      setOutput("");

      if (!text.trim()) return;

      const validation = validateJson(text);
      if (!validation.valid && validation.error) {
        setError(validation.error);
        return;
      }

      const parsed = shouldSort
        ? sortJsonKeys(validation.parsed)
        : validation.parsed;

      if (mode === "minify") {
        setOutput(JSON.stringify(parsed));
        return;
      }

      const indentNum =
        indentVal === "tab" ? "\t" : Number.parseInt(indentVal, 10);
      setOutput(JSON.stringify(parsed, null, indentNum));
    },
    [setOutput],
  );

  useEffect(() => {
    if (oversized) {
      setOutput("");
      setError(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      processJson(input, indent, sortKeys, outputMode);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [indent, input, outputMode, oversized, processJson, sortKeys, setOutput]);

  const handleUseOutput = useCallback(() => {
    if (output) setInput(output);
  }, [output, setInput]);

  const announcement = useAnnouncement(
    output
      ? `JSON ${outputMode === "minify" ? "minified" : "formatted"}. ${output.split("\n").length} lines.`
      : "",
    500,
    output,
  );

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setInput(text);
  }, [readText, setInput]);

  return (
    <ToolPage>
      <ToolHeader
        title="JSON Formatter"
        description="Validate, format, and minify JSON with error highlighting"
      />

      <ToolCard>
        <ToolToolbar>
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
          <ToolbarGroup label="Output">
            <SegmentedControl
              value={outputMode}
              onChange={setOutputMode}
              ariaLabel="JSON output mode"
              options={[
                { value: "format", label: "Format" },
                { value: "minify", label: "Minify" },
              ]}
            />
          </ToolbarGroup>

          <ToolbarGroup label="Indent" htmlFor="json-indentation">
            <ToolbarSelect
              id="json-indentation"
              value={indent}
              onChange={setIndent}
              options={indentOptions}
            />
          </ToolbarGroup>

          <ToolbarCheckbox
            checked={sortKeys}
            onChange={setSortKeys}
            label="Sort keys"
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
          {oversized && (
            <AlertBox variant="warn">
              <span>
                Large input detected. Auto-processing is disabled over 1MB.
              </span>
            </AlertBox>
          )}

          {error && (
            <AlertBox variant="error">
              <span className="font-medium">
                Invalid JSON
                {error.line && error.column
                  ? ` at line ${error.line}, column ${error.column}`
                  : ""}
              </span>
              <span className="mt-0.5 text-[12px] text-muted-foreground">
                {error.message}
              </span>
            </AlertBox>
          )}

          {shouldShowValidJsonStatus({
            input,
            hasError: Boolean(error),
            oversized,
          }) && (
            <AlertBox variant="success" role="presentation">
              <span>Valid JSON</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="grid divide-y divide-border p-0 md:grid-cols-2 md:divide-x md:divide-y-0">
          <section className="p-4">
            <div className="mb-2 flex min-h-8 items-center justify-between">
              <ToolLabel htmlFor="json-input" className="mb-0">
                Input JSON
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
              id="json-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='{"key": "value"}'
              rows={12}
              aria-label="Input JSON"
              className={`font-mono min-h-72 ${error ? "border-destructive" : ""}`}
              spellCheck={false}
            />
          </section>

          <section className="p-4">
            <div className="mb-2 flex min-h-8 items-center justify-between">
              <ToolLabel htmlFor="json-output" className="mb-0">
                Output
              </ToolLabel>
              {output && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleUseOutput}
                >
                  <FontAwesomeIcon
                    icon={faTurnDown}
                    className="h-3 w-3"
                    aria-hidden="true"
                  />
                  Use as input
                </Button>
              )}
              {output && <CopyButton text={output} />}
            </div>

            <div className="relative">
              <Textarea
                id="json-output"
                readOnly
                value={output}
                rows={12}
                aria-label="Formatted output"
                className="field-sizing-content font-mono min-h-72"
                placeholder="Formatted output will appear here..."
              />
              {!output && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border border-border bg-background/88">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07] mx-auto">
                      <FontAwesomeIcon
                        icon={faFileCode}
                        className="h-5 w-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                      {outputMode === "minify" ? "Minified" : "Formatted"} JSON
                      appears here as you type
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
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
