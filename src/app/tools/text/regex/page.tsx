"use client";

import { faAsterisk } from "@fortawesome/free-solid-svg-icons/faAsterisk";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import { ToolbarCheckbox, ToolbarGroup } from "@/components/Toolbar";
import { ToolPresets } from "@/components/tool/ToolPresets";
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
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { MAX_INPUT_SIZE } from "@/lib/constants";
import {
  type RegexMatch,
  type RegexResult,
  regexFlagStateFromFlags,
  regexFlagsToString,
  regexPresets,
} from "@/lib/regex";

const REGEX_TIMEOUT_MS = 500;

export default function RegexTester() {
  const { readText, pasteError } = useClipboard();

  const [pattern, setPattern] = useState("");
  const [testString, setTestString] = useState("");
  const [flagG, setFlagG] = useState(true);
  const [flagI, setFlagI] = useState(false);
  const [flagM, setFlagM] = useState(false);
  const [flagS, setFlagS] = useState(false);
  const [flagU, setFlagU] = useState(false);
  const [result, setResult] = useState<RegexResult>({
    matches: [],
    error: null,
  });

  const announcement = useAnnouncement(
    result.error
      ? ""
      : !pattern || !testString
        ? ""
        : result.matches.length > 0
          ? `${result.matches.length} match${result.matches.length === 1 ? "" : "es"} found.`
          : "No matches found.",
    500,
    result,
  );

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL("./regex.worker.ts", import.meta.url),
    );
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const flags = useMemo(() => {
    return regexFlagsToString({
      g: flagG,
      i: flagI,
      m: flagM,
      s: flagS,
      u: flagU,
    });
  }, [flagG, flagI, flagM, flagS, flagU]);

  const oversized = testString.length > MAX_INPUT_SIZE;

  useEffect(() => {
    if (oversized || !pattern) {
      setResult({ matches: [], error: null });
      return;
    }

    const worker = workerRef.current;
    if (!worker) return;

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      worker.terminate();
      workerRef.current = new Worker(
        new URL("./regex.worker.ts", import.meta.url),
      );
      setResult({
        matches: [],
        error: `Regex execution timed out after ${REGEX_TIMEOUT_MS}ms`,
      });
    }, REGEX_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<RegexResult>) => {
      window.clearTimeout(timeoutId);
      if (!cancelled) {
        setResult(event.data);
      }
    };

    worker.onerror = () => {
      window.clearTimeout(timeoutId);
      if (!cancelled) {
        worker.terminate();
        workerRef.current = new Worker(
          new URL("./regex.worker.ts", import.meta.url),
        );
        setResult({
          matches: [],
          error: "Regex worker failed to execute",
        });
      }
    };

    worker.postMessage({ pattern, flags, testString });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [flags, oversized, pattern, testString]);

  const handleClear = useCallback(() => {
    setPattern("");
    setTestString("");
    setFlagG(true);
    setFlagI(false);
    setFlagM(false);
    setFlagS(false);
    setFlagU(false);
  }, []);

  const handlePreset = useCallback((preset: (typeof regexPresets)[number]) => {
    const flagState = regexFlagStateFromFlags(preset.flags);
    setPattern(preset.pattern);
    setFlagG(flagState.g);
    setFlagI(flagState.i);
    setFlagM(flagState.m);
    setFlagS(flagState.s);
    setFlagU(flagState.u);
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setTestString(text);
  }, [readText]);

  const highlightedHtml = useMemo(() => {
    if (
      !testString ||
      !pattern ||
      result.error ||
      result.matches.length === 0
    ) {
      return null;
    }

    const parts: { text: string; highlight: boolean; id: string }[] = [];
    let lastIndex = 0;

    const sortedMatches = [...result.matches].sort((a, b) => a.index - b.index);

    for (let i = 0; i < sortedMatches.length; i++) {
      const match = sortedMatches[i];
      if (match.index > lastIndex) {
        parts.push({
          text: testString.slice(lastIndex, match.index),
          highlight: false,
          id: `t-${lastIndex}-${match.index}`,
        });
      }
      if (match.index >= lastIndex) {
        parts.push({
          text: match.fullMatch,
          highlight: true,
          id: `m-${match.index}-${match.length}`,
        });
        lastIndex = match.index + match.length;
      }
    }

    if (lastIndex < testString.length) {
      parts.push({
        text: testString.slice(lastIndex),
        highlight: false,
        id: `t-${lastIndex}-end`,
      });
    }

    return parts;
  }, [testString, pattern, result]);

  const matchesText = result.matches
    .map((m, i) => `Match ${i + 1}: "${m.fullMatch}" at index ${m.index}`)
    .join("\n");

  const activePreset = useMemo(
    () =>
      regexPresets.find(
        (preset) => preset.pattern === pattern && preset.flags === flags,
      )?.name ?? null,
    [pattern, flags],
  );

  return (
    <ToolPage>
      <ToolHeader
        title="Regex Tester"
        description="Test regular expressions with live matching and capture groups"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            {(pattern || testString) && (
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
          <ToolbarGroup label="Flags">
            <div className="flex items-center gap-4">
              <ToolbarCheckbox
                checked={flagG}
                onChange={setFlagG}
                label="Global (g)"
              />
              <ToolbarCheckbox
                checked={flagI}
                onChange={setFlagI}
                label="Case insensitive (i)"
              />
              <ToolbarCheckbox
                checked={flagM}
                onChange={setFlagM}
                label="Multiline (m)"
              />
              <ToolbarCheckbox
                checked={flagS}
                onChange={setFlagS}
                label="Dotall (s)"
              />
              <ToolbarCheckbox
                checked={flagU}
                onChange={setFlagU}
                label="Unicode (u)"
              />
            </div>
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
                Input exceeds 1MB — matching disabled to prevent UI freezing.
              </span>
            </AlertBox>
          )}
          {result.error && (
            <AlertBox variant="error">
              <span className="font-mono">{result.error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <div>
            <ToolLabel htmlFor="regex-pattern">Pattern</ToolLabel>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[15px] text-muted-foreground">
                /
              </span>
              <Input
                id="regex-pattern"
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="Enter regex pattern..."
                aria-label="Regex pattern"
                className="h-9 flex-1 text-[13px] font-mono"
                spellCheck={false}
              />
              <span className="font-mono text-[15px] text-muted-foreground">
                /{flags}
              </span>
            </div>
          </div>

          <ToolPresets label="Common Patterns" count={regexPresets.length}>
            {regexPresets.map((preset) => {
              const isActive = activePreset === preset.name;

              return (
                <Button
                  key={preset.name}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={isActive ? "ring-1 ring-ring" : undefined}
                  onClick={() => handlePreset(preset)}
                  title={preset.description}
                  aria-pressed={isActive}
                >
                  {preset.name}
                </Button>
              );
            })}
          </ToolPresets>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="regex-test-string">Test String</ToolLabel>
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
              id="regex-test-string"
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
              placeholder="Enter text to test against..."
              rows={8}
              aria-label="Test string"
              className="font-mono min-h-56"
              spellCheck={false}
            />
          </div>

          {highlightedHtml && (
            <div>
              <ToolLabel>Highlighted Matches</ToolLabel>
              <div className="bg-muted/40 whitespace-pre-wrap break-all rounded-md border border-border p-3 font-mono text-[13px] leading-relaxed">
                {highlightedHtml.map((part) =>
                  part.highlight ? (
                    <mark
                      key={part.id}
                      className="bg-accent text-accent-foreground rounded-sm px-0.5"
                    >
                      {part.text}
                    </mark>
                  ) : (
                    <span key={part.id} className="text-foreground">
                      {part.text}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}
        </ToolBody>

        {result.matches.length > 0 ? (
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <ToolMeta>
                {result.matches.length} match
                {result.matches.length > 1 ? "es" : ""} found
              </ToolMeta>
              <CopyButton text={matchesText} />
            </div>
            <div className="max-h-64 divide-y divide-border overflow-y-auto">
              {result.matches.map((match: RegexMatch, i: number) => {
                const matchKey = `m-${match.index}-${match.length}-${match.fullMatch}`;
                const groupCounts = new Map<string, number>();
                let captureNumber = 0;
                const captureGroups = match.groups.map((group) => {
                  captureNumber += 1;
                  const seen = groupCounts.get(group) ?? 0;
                  groupCounts.set(group, seen + 1);
                  return {
                    key: `g-${match.index}-${captureNumber}-${seen}-${group}`,
                    label: `$${captureNumber}`,
                    value: group,
                  };
                });

                return (
                  <div key={matchKey} className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="w-6 flex-shrink-0 text-right text-[12px] font-medium tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <code className="flex-1 break-all font-mono text-[13px] text-foreground">
                        {match.fullMatch}
                      </code>
                      <span className="flex-shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        idx {match.index}
                      </span>
                      <CopyButton text={match.fullMatch} />
                    </div>

                    {captureGroups.length > 0 && (
                      <div className="ml-9 mt-1.5 flex flex-wrap gap-1.5">
                        {captureGroups.map((group) => (
                          <span
                            key={group.key}
                            className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 font-mono text-[12px]"
                          >
                            <span className="text-muted-foreground">
                              {group.label}
                            </span>
                            <span className="text-foreground">
                              {group.value}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}

                    {Object.keys(match.namedGroups).length > 0 && (
                      <div className="ml-9 mt-1.5 flex flex-wrap gap-1.5">
                        {Object.entries(match.namedGroups).map(
                          ([name, value]) => (
                            <span
                              key={`ng-${match.index}-${name}`}
                              className="inline-flex items-center gap-1 rounded border border-border bg-accent px-2 py-0.5 font-mono text-[12px]"
                            >
                              <span className="text-muted-foreground">
                                {name}
                              </span>
                              <span className="text-accent-foreground">
                                {value}
                              </span>
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          pattern &&
          testString &&
          !result.error && (
            <div className="border-t border-border py-8 text-center">
              <p className="text-[13px] text-muted-foreground">
                No matches found
              </p>
            </div>
          )
        )}

        {!pattern && !testString && (
          <div className="border-t border-border py-12 text-center">
            <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
              <FontAwesomeIcon
                icon={faAsterisk}
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              Matches appear here as you type
            </p>
          </div>
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Uses the JavaScript <code>RegExp</code> engine. All processing happens
        locally in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}
