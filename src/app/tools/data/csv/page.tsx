"use client";

import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faRightLeft } from "@fortawesome/free-solid-svg-icons/faRightLeft";
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
import { MAX_INPUT_SIZE } from "@/lib/constants";
import {
  convertDelimitedToJson,
  convertJsonToDelimited,
  type DelimitedFormat,
} from "@/lib/csv";

type Mode = "delimited-to-json" | "json-to-delimited";

const formatOptions = [
  { value: "csv", label: "CSV (,)" },
  { value: "tsv", label: "TSV (tab)" },
];

const jsonIndentOptions = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tab" },
];

export default function CsvJsonConverter() {
  const { readText, pasteError } = useClipboard();
  const [
    { input, output, error },
    { setInput, setOutput, setError, handleClear },
  ] = useToolState();

  const [mode, setMode] = useState<Mode>("delimited-to-json");
  const [format, setFormat] = useState<DelimitedFormat>("csv");
  const [hasHeader, setHasHeader] = useState(true);
  const [jsonIndent, setJsonIndent] = useState("2");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processInput = useCallback(
    (
      text: string,
      currentMode: Mode,
      currentFormat: DelimitedFormat,
      currentHasHeader: boolean,
      currentIndent: string,
    ) => {
      setError(null);
      setOutput("");
      if (!text.trim()) return;

      if (text.length > MAX_INPUT_SIZE) {
        setError(
          "Input exceeds 1MB — auto-processing disabled to prevent UI freezing.",
        );
        return;
      }

      try {
        if (currentMode === "delimited-to-json") {
          const indent = currentIndent === "tab" ? "\t" : Number(currentIndent);
          setOutput(
            convertDelimitedToJson(text, {
              format: currentFormat,
              hasHeader: currentHasHeader,
              indent,
            }),
          );
        } else {
          setOutput(
            convertJsonToDelimited(text, {
              format: currentFormat,
              includeHeader: currentHasHeader,
            }),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to convert");
      }
    },
    [setError, setOutput],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      processInput(input, mode, format, hasHeader, jsonIndent);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [format, hasHeader, input, jsonIndent, mode, processInput]);

  // Swap feeds the current output back as input in the opposite direction,
  // enabling round-trip conversion (CSV→JSON→CSV).
  const handleSwap = useCallback(() => {
    if (!output) return;
    const nextMode: Mode =
      mode === "delimited-to-json" ? "json-to-delimited" : "delimited-to-json";
    setMode(nextMode);
    setInput(output);
    processInput(output, nextMode, format, hasHeader, jsonIndent);
  }, [format, hasHeader, jsonIndent, mode, output, processInput, setInput]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) {
      setInput(text);
    }
  }, [readText, setInput]);

  const announcement = useAnnouncement(
    output
      ? `Converted to ${mode === "delimited-to-json" ? "JSON" : format.toUpperCase()}. ${output.split("\n").length} lines.`
      : "",
    500,
    output,
  );

  return (
    <ToolPage>
      <ToolHeader
        title="CSV/TSV ↔ JSON Converter"
        description="Convert delimited data and JSON arrays locally in your browser"
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
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as Mode)}
            ariaLabel="Conversion mode"
            options={[
              { value: "delimited-to-json", label: "To JSON" },
              { value: "json-to-delimited", label: "From JSON" },
            ]}
          />

          <ToolbarGroup label="Format" htmlFor="csv-delimited-format">
            <ToolbarSelect
              id="csv-delimited-format"
              value={format}
              onChange={(value) => setFormat(value as DelimitedFormat)}
              options={formatOptions}
            />
          </ToolbarGroup>

          <ToolbarCheckbox
            checked={hasHeader}
            onChange={setHasHeader}
            label={
              mode === "delimited-to-json"
                ? "First row is header"
                : "Include header"
            }
          />

          <ToolbarGroup label="JSON Indent" htmlFor="csv-json-indent">
            <ToolbarSelect
              id="csv-json-indent"
              value={jsonIndent}
              onChange={setJsonIndent}
              options={jsonIndentOptions}
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
                Large input detected. Auto-processing is disabled over 1MB.
              </span>
            </AlertBox>
          )}
          {error && (
            <AlertBox variant="error">
              <span>{error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="grid divide-y divide-border p-0 md:grid-cols-2 md:divide-x md:divide-y-0">
          <section className="p-4">
            <div className="mb-2 flex min-h-8 items-center justify-between">
              <ToolLabel htmlFor="csv-json-input" className="mb-0">
                {mode === "delimited-to-json"
                  ? format === "csv"
                    ? "CSV to Convert"
                    : "TSV to Convert"
                  : "JSON to Convert"}
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
              id="csv-json-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={12}
              className="font-mono min-h-72"
              spellCheck={false}
              placeholder={
                mode === "delimited-to-json"
                  ? format === "csv"
                    ? "name,email\nAlice,alice@example.com"
                    : "name\temail\nAlice\talice@example.com"
                  : '[{"name":"Alice","email":"alice@example.com"}]'
              }
            />
          </section>

          <section className="p-4">
            <div className="mb-2 flex min-h-8 items-center justify-between">
              <ToolLabel htmlFor="csv-json-output" className="mb-0">
                {mode === "delimited-to-json"
                  ? "JSON Output"
                  : format === "csv"
                    ? "CSV Output"
                    : "TSV Output"}
              </ToolLabel>
              {output && (
                <ToolMeta>{output.length.toLocaleString()} chars</ToolMeta>
              )}
              {output && <CopyButton text={output} />}
            </div>
            <Textarea
              id="csv-json-output"
              readOnly
              value={output}
              rows={12}
              className="font-mono min-h-72 max-h-[32rem]"
              placeholder="Converted output will appear here..."
            />
          </section>
        </ToolBody>
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Supports quoted CSV fields, escaped quotes, and TSV using tab
        delimiters. All conversion runs locally in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}
