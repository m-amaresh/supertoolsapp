"use client";

import { faCircleCheck } from "@fortawesome/free-solid-svg-icons/faCircleCheck";
import { faNetworkWired } from "@fortawesome/free-solid-svg-icons/faNetworkWired";
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
  convertJsonToYaml,
  convertYamlToJson,
  validateYaml,
  type YamlError,
} from "@/lib/yaml";

type Mode = "json-to-yaml" | "yaml-to-json";

const indentOptions = [
  { value: "2", label: "2 spaces" },
  { value: "4", label: "4 spaces" },
  { value: "tab", label: "Tab" },
];

export default function YamlConverter() {
  const { readText, pasteError } = useClipboard();
  const [{ input, output }, { setInput, setOutput }] = useToolState();

  const [mode, setMode] = useState<Mode>("json-to-yaml");
  const [indent, setIndent] = useState("2");
  const [sortKeys, setSortKeys] = useState(false);
  const [error, setError] = useState<YamlError | null>(null);
  const [yamlValidation, setYamlValidation] = useState<{
    valid: boolean;
    error?: YamlError;
  } | null>(null);
  const processSeqRef = useRef(0);
  const validateSeqRef = useRef(0);

  const processInput = useCallback(
    async (
      text: string,
      currentMode: Mode,
      indentValue: string,
      sort: boolean,
    ) => {
      const seq = ++processSeqRef.current;
      setError(null);
      setOutput("");
      setYamlValidation(null);

      if (!text.trim()) return;

      if (currentMode === "json-to-yaml") {
        const result = await convertJsonToYaml(text, sort);
        if (seq !== processSeqRef.current) return;
        if (result.error) {
          setError(result.error);
          return;
        }
        setOutput(result.output ?? "");
        return;
      }

      const indentValueResolved =
        indentValue === "tab" ? "\t" : Number.parseInt(indentValue, 10);
      const result = await convertYamlToJson(text, indentValueResolved, sort);
      if (seq !== processSeqRef.current) return;
      if (result.error) {
        setError(result.error);
        return;
      }
      setOutput(result.output ?? "");
    },
    [setOutput],
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (input.length > MAX_INPUT_SIZE) {
      setOutput("");
      setError(null);
      setYamlValidation(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void processInput(input, mode, indent, sortKeys);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [indent, input, mode, processInput, sortKeys, setOutput]);

  const handleValidateYaml = useCallback(() => {
    if (input.length > MAX_INPUT_SIZE) return;
    const validate = async () => {
      const seq = ++validateSeqRef.current;
      setError(null);
      setOutput("");
      const result = await validateYaml(input);
      if (seq !== validateSeqRef.current) return;
      setYamlValidation({ valid: result.valid, error: result.error });
    };
    void validate();
  }, [input, setOutput]);

  const handleSwap = useCallback(() => {
    if (!output) return;
    processSeqRef.current++;
    validateSeqRef.current++;
    setInput(output);
    setOutput("");
    setError(null);
    setYamlValidation(null);
    setMode((current) =>
      current === "json-to-yaml" ? "yaml-to-json" : "json-to-yaml",
    );
  }, [output, setInput, setOutput]);

  const handleModeChange = useCallback(
    (newMode: Mode) => {
      if (newMode === mode) return;
      if (output) {
        handleSwap();
      } else {
        processSeqRef.current++;
        validateSeqRef.current++;
        setError(null);
        setYamlValidation(null);
        setMode(newMode);
      }
    },
    [mode, output, handleSwap],
  );

  const handleClear = useCallback(() => {
    processSeqRef.current++;
    validateSeqRef.current++;
    setInput("");
    setOutput("");
    setError(null);
    setYamlValidation(null);
  }, [setInput, setOutput]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setInput(text);
  }, [readText, setInput]);

  const inputLabel =
    mode === "json-to-yaml" ? "JSON to Convert" : "YAML to Convert";

  const announcement = useAnnouncement(
    output
      ? `Converted to ${mode === "json-to-yaml" ? "YAML" : "JSON"}. ${output.split("\n").length} lines.`
      : "",
    500,
    output,
  );
  const outputLabel = mode === "json-to-yaml" ? "YAML Output" : "JSON Output";
  const inputPlaceholder =
    mode === "json-to-yaml" ? '{"name":"SuperTools"}' : "name: SuperTools";
  const oversized = input.length > MAX_INPUT_SIZE;

  return (
    <ToolPage>
      <ToolHeader
        title="YAML Converter & Validator"
        description="Convert JSON and YAML in both directions, and validate YAML syntax"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            {mode === "yaml-to-json" && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleValidateYaml}
              >
                <FontAwesomeIcon
                  icon={faCircleCheck}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                Validate YAML
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
          <ToolbarGroup label="Direction">
            <SegmentedControl
              value={mode}
              onChange={handleModeChange}
              ariaLabel="YAML conversion mode"
              options={[
                { value: "json-to-yaml", label: "JSON → YAML" },
                { value: "yaml-to-json", label: "YAML → JSON" },
              ]}
            />
          </ToolbarGroup>

          <ToolbarGroup label="JSON Indent" htmlFor="yaml-json-indentation">
            <ToolbarSelect
              id="yaml-json-indentation"
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
              <div>
                <span className="font-medium">Conversion failed</span>
                {error.line && error.column && (
                  <span>
                    {" "}
                    at line {error.line}, column {error.column}
                  </span>
                )}
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {error.message}
                </p>
              </div>
            </AlertBox>
          )}

          {yamlValidation && (
            <AlertBox variant={yamlValidation.valid ? "success" : "error"}>
              <div>
                {yamlValidation.valid ? (
                  <span className="font-medium">Valid YAML</span>
                ) : (
                  <>
                    <span className="font-medium">Invalid YAML</span>
                    {yamlValidation.error?.line &&
                      yamlValidation.error.column && (
                        <span>
                          {" "}
                          at line {yamlValidation.error.line}, column{" "}
                          {yamlValidation.error.column}
                        </span>
                      )}
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {yamlValidation.error?.message}
                    </p>
                  </>
                )}
              </div>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="grid divide-y divide-border p-0 md:grid-cols-2 md:divide-x md:divide-y-0">
          <section className="p-4">
            <div className="mb-2 flex min-h-8 items-center justify-between">
              <ToolLabel htmlFor="yaml-input" className="mb-0">
                {inputLabel}
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
              id="yaml-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={inputPlaceholder}
              rows={12}
              aria-label={inputLabel}
              className={`font-mono min-h-72 ${error ? "border-destructive" : ""}`}
              spellCheck={false}
            />
          </section>

          <section className="p-4">
            <div className="mb-2 flex min-h-8 items-center justify-between">
              <ToolLabel htmlFor="yaml-output" className="mb-0">
                {outputLabel}
              </ToolLabel>
              {output && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSwap}
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
                id="yaml-output"
                readOnly
                value={output}
                rows={12}
                aria-label={outputLabel}
                className="field-sizing-content font-mono min-h-72"
                placeholder="Converted output will appear here..."
              />
              {!output && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border border-border bg-background/88">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07] mx-auto">
                      <FontAwesomeIcon
                        icon={faNetworkWired}
                        className="h-5 w-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                      Converted output appears here as you type
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
