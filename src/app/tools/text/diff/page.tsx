"use client";

import { faCheck } from "@fortawesome/free-solid-svg-icons/faCheck";
import { faCodeCompare } from "@fortawesome/free-solid-svg-icons/faCodeCompare";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faRightLeft } from "@fortawesome/free-solid-svg-icons/faRightLeft";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useMemo, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import { ToolbarCheckbox } from "@/components/Toolbar";
import { RunShortcutHint } from "@/components/tool/RunShortcutHint";
import {
  ToolBody,
  ToolCard,
  ToolFootnote,
  ToolHeader,
  ToolLiveRegion,
  ToolMeta,
  ToolOptionsBar,
  ToolPage,
  ToolStatusStack,
  ToolToolbar,
} from "@/components/tool/ToolScaffold";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncer } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { useFocusResult, useRunShortcut } from "@/hooks/useRunShortcut";
import { MAX_INPUT_SIZE } from "@/lib/constants";
import {
  computeDiff,
  type DiffLine,
  type DiffOptions,
  getDiffStats,
} from "@/lib/diff";

const MAX_LINES = 3000;
// LCS uses an O(m×n) DP table — cap the product to prevent out-of-memory
// on low-end devices while still handling most real-world diffs.
const MAX_LINE_PRODUCT = 250_000;
// Only render the first N diff lines initially; remaining load on demand.
const DIFF_RENDER_LIMIT = 500;

export default function TextDiff() {
  const { readText, pasteError } = useClipboard();

  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [announcement, announce] = useAnnouncer();
  const [diff, setDiff] = useState<DiffLine[] | null>(null);
  const [lineWarning, setLineWarning] = useState<string | null>(null);
  const [showAllDiff, setShowAllDiff] = useState(false);
  const [options, setOptions] = useState<DiffOptions>({
    ignoreWhitespace: false,
    ignoreCase: false,
    trimLines: false,
  });

  const [resultRef, focusResultOnNextRender] = useFocusResult<HTMLDivElement>();

  const handleCompare = useCallback(() => {
    if (!left.trim() && !right.trim()) return;
    const leftCount = left.split("\n").length;
    const rightCount = right.split("\n").length;
    if (leftCount > MAX_LINES || rightCount > MAX_LINES) {
      setLineWarning(
        `Input exceeds ${MAX_LINES.toLocaleString()} lines — diff not computed to prevent freezing.`,
      );
      setDiff(null);
      return;
    }
    if (leftCount * rightCount > MAX_LINE_PRODUCT) {
      setLineWarning(
        `Combined input size too large (${leftCount.toLocaleString()} × ${rightCount.toLocaleString()} lines) — diff not computed to prevent freezing.`,
      );
      setDiff(null);
      return;
    }
    setLineWarning(null);
    setShowAllDiff(false);
    const result = computeDiff(left, right, options);
    setDiff(result);
    focusResultOnNextRender();
    const { added, removed } = getDiffStats(result);
    announce(
      added === 0 && removed === 0
        ? "Comparison complete. The two inputs are identical."
        : `Comparison complete. ${added} addition${added === 1 ? "" : "s"}, ${removed} removal${removed === 1 ? "" : "s"}.`,
    );
  }, [announce, focusResultOnNextRender, left, options, right]);

  useRunShortcut(handleCompare);

  const handleClear = useCallback(() => {
    setLeft("");
    setRight("");
    setDiff(null);
    setLineWarning(null);
    announce("");
  }, [announce]);

  const handleSwap = useCallback(() => {
    setLeft(right);
    setRight(left);
    setDiff(null);
    setLineWarning(null);
  }, [left, right]);

  const handlePasteLeft = useCallback(async () => {
    const text = await readText();
    if (text !== null) setLeft(text);
  }, [readText]);

  const handlePasteRight = useCallback(async () => {
    const text = await readText();
    if (text !== null) setRight(text);
  }, [readText]);

  const stats = useMemo(() => (diff ? getDiffStats(diff) : null), [diff]);

  return (
    <ToolPage>
      <ToolHeader
        title="Text Diff"
        description="Compare two texts side by side and highlight differences"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              onClick={handleCompare}
              aria-keyshortcuts="Meta+Enter Control+Enter"
            >
              <FontAwesomeIcon
                icon={faCodeCompare}
                className="h-3 w-3"
                aria-hidden="true"
              />
              Compare
              <RunShortcutHint />
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleSwap}
              title="Swap left and right"
              aria-label="Swap original and modified text"
            >
              <FontAwesomeIcon
                icon={faRightLeft}
                className="h-3 w-3"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Swap</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {stats && (
              <span className="hidden tabular-nums text-[12px] text-muted-foreground sm:inline">
                <span className="text-success">+{stats.added}</span>
                {" / "}
                <span className="text-destructive">-{stats.removed}</span>
                {" / "}
                {stats.unchanged} unchanged
              </span>
            )}
            {(left || right) && (
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
          <ToolbarCheckbox
            checked={options.ignoreWhitespace}
            onChange={(checked) => {
              setOptions((o) => ({ ...o, ignoreWhitespace: checked }));
              setDiff(null);
            }}
            label="Ignore whitespace"
          />
          <ToolbarCheckbox
            checked={options.ignoreCase}
            onChange={(checked) => {
              setOptions((o) => ({ ...o, ignoreCase: checked }));
              setDiff(null);
            }}
            label="Ignore case"
          />
          <ToolbarCheckbox
            checked={options.trimLines}
            onChange={(checked) => {
              setOptions((o) => ({ ...o, trimLines: checked }));
              setDiff(null);
            }}
            label="Trim lines"
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
          {(left.length > MAX_INPUT_SIZE || right.length > MAX_INPUT_SIZE) && (
            <AlertBox variant="warn">
              <span>Large input detected — processing may be slow.</span>
            </AlertBox>
          )}

          {lineWarning && (
            <AlertBox variant="warn">
              <span>{lineWarning}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="grid divide-y divide-border p-0 md:grid-cols-2 md:divide-x md:divide-y-0">
          <section className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <ToolMeta className="w-24 shrink-0">Original</ToolMeta>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePasteLeft}
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
              value={left}
              onChange={(e) => {
                setLeft(e.target.value);
                setDiff(null);
                setLineWarning(null);
              }}
              placeholder="Paste original text..."
              rows={12}
              aria-label="Original text"
              className="font-mono min-h-72"
              spellCheck={false}
            />
          </section>

          <section className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <ToolMeta className="w-24 shrink-0">Modified</ToolMeta>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePasteRight}
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
              value={right}
              onChange={(e) => {
                setRight(e.target.value);
                setDiff(null);
                setLineWarning(null);
              }}
              placeholder="Paste modified text..."
              rows={12}
              aria-label="Modified text"
              className="font-mono min-h-72"
              spellCheck={false}
            />
          </section>
        </ToolBody>

        {diff && (
          // tabIndex -1 so focus can be moved here programmatically after
          // Compare without adding the region to the tab order.
          <div
            ref={resultRef}
            tabIndex={-1}
            className="border-t border-border outline-none"
          >
            <div className="bg-muted/40 flex items-center justify-between px-4 py-2">
              <ToolMeta className="w-24 shrink-0">Diff Result</ToolMeta>
              <CopyButton
                text={diff
                  .map(
                    (l) =>
                      `${l.type === "added" ? "+" : l.type === "removed" ? "-" : " "} ${l.text}`,
                  )
                  .join("\n")}
              />
            </div>
            <div className="max-h-96 overflow-y-auto font-mono text-[13px] leading-relaxed">
              {diff.length === 0 ? (
                <div className="py-8 text-center text-[13px] text-muted-foreground">
                  Both texts are empty
                </div>
              ) : stats && stats.added === 0 && stats.removed === 0 ? (
                <div className="py-8 text-center">
                  <div className="bg-success/12 mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg">
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="text-success h-4 w-4"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    Texts are identical
                  </p>
                </div>
              ) : (
                <>
                  {(showAllDiff ? diff : diff.slice(0, DIFF_RENDER_LIMIT)).map(
                    (line) => (
                      <div
                        key={`${line.type}-${line.leftNum ?? "x"}-${line.rightNum ?? "x"}`}
                        className={`flex ${
                          line.type === "added"
                            ? "bg-success/12"
                            : line.type === "removed"
                              ? "bg-destructive/10"
                              : ""
                        }`}
                      >
                        <span className="border-border w-10 flex-shrink-0 select-none border-r py-0.5 pr-2 text-right text-[12px] text-muted-foreground">
                          {line.leftNum ?? ""}
                        </span>
                        <span className="border-border w-10 flex-shrink-0 select-none border-r py-0.5 pr-2 text-right text-[12px] text-muted-foreground">
                          {line.rightNum ?? ""}
                        </span>
                        <span
                          className={`w-6 flex-shrink-0 select-none py-0.5 text-center font-semibold ${
                            line.type === "added"
                              ? "text-success"
                              : line.type === "removed"
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {line.type === "added"
                            ? "+"
                            : line.type === "removed"
                              ? "-"
                              : " "}
                        </span>
                        <span
                          className={`flex-1 py-0.5 pr-4 ${
                            line.type === "added"
                              ? "text-success"
                              : line.type === "removed"
                                ? "text-destructive"
                                : "text-foreground"
                          }`}
                        >
                          {line.text || "\u00A0"}
                        </span>
                      </div>
                    ),
                  )}
                  {!showAllDiff && diff.length > DIFF_RENDER_LIMIT && (
                    <div className="border-border border-t px-4 py-3 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllDiff(true)}
                      >
                        Show {diff.length - DIFF_RENDER_LIMIT} more lines
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {!diff && !left && !right && (
          <div className="border-t border-border py-12 text-center">
            <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
              <FontAwesomeIcon
                icon={faCodeCompare}
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              Paste text in both panels and click Compare
            </p>
          </div>
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Shortcut: press Ctrl+Enter (Windows/Linux) or Cmd+Enter (macOS) in
        either input to compare. All processing happens locally in your browser.
        No data is sent to any server.
      </ToolFootnote>
    </ToolPage>
  );
}
