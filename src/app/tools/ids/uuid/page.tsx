"use client";

import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons/faArrowsRotate";
import { faHashtag } from "@fortawesome/free-solid-svg-icons/faHashtag";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import {
  ToolbarCheckbox,
  ToolbarGroup,
  ToolbarSelect,
} from "@/components/Toolbar";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncer } from "@/hooks/useAnnouncement";
import { useFocusResult, useRunShortcut } from "@/hooks/useRunShortcut";
import { parseNonNegativeInt } from "@/lib/utils";
import { generateBulkUuids, type UuidOptions } from "@/lib/uuid";

const countOptions = [
  { value: "1", label: "1" },
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "500", label: "500" },
  { value: "1000", label: "1000" },
  { value: "custom", label: "Custom…" },
];

const MIN_UUID_COUNT = 1;
const MAX_UUID_COUNT = 1000;

export default function UuidGenerator() {
  const [announcement, announce] = useAnnouncer();
  const [uuids, setUuids] = useState<string[]>([]);
  const [countMode, setCountMode] = useState("1");
  const [customCount, setCustomCount] = useState("1");
  const [options, setOptions] = useState<UuidOptions>({
    uppercase: false,
    hyphens: true,
    braces: false,
  });

  const countInput = countMode === "custom" ? customCount : countMode;
  const parsedCustomCount = parseNonNegativeInt(countInput);
  const countError =
    parsedCustomCount === null
      ? "Count must be a whole number."
      : parsedCustomCount < MIN_UUID_COUNT || parsedCustomCount > MAX_UUID_COUNT
        ? `Count must be between ${MIN_UUID_COUNT} and ${MAX_UUID_COUNT}.`
        : null;

  const [resultRef, focusResultOnNextRender] =
    useFocusResult<HTMLTextAreaElement>();

  const generate = useCallback(() => {
    if (parsedCustomCount === null || countError) return;
    const newUuids = generateBulkUuids(parsedCustomCount, options);
    setUuids(newUuids);
    focusResultOnNextRender();
    announce(
      `${newUuids.length} UUID${newUuids.length === 1 ? "" : "s"} generated.`,
    );
  }, [
    announce,
    countError,
    focusResultOnNextRender,
    options,
    parsedCustomCount,
  ]);

  // Gated on exactly what disables the button, so the shortcut can never
  // run an action the UI presents as unavailable.
  useRunShortcut(generate, !countError);

  const clear = useCallback(() => {
    setUuids([]);
    announce("");
  }, [announce]);

  const output = uuids.join("\n");

  return (
    <ToolPage>
      <ToolHeader
        title="UUID Generator"
        description="Generate random UUIDs (v4) with formatting options"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={generate}
              disabled={Boolean(countError)}
              aria-keyshortcuts="Meta+Enter Control+Enter"
            >
              <FontAwesomeIcon
                icon={faArrowsRotate}
                className="h-3 w-3"
                aria-hidden="true"
              />
              Generate
              <RunShortcutHint />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {uuids.length > 0 && (
              <ToolMeta>
                {uuids.length} result{uuids.length > 1 ? "s" : ""}
              </ToolMeta>
            )}
            {uuids.length > 0 && (
              <Button type="button" variant="ghost" onClick={clear}>
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
          <ToolbarGroup label="Count" htmlFor="uuid-count">
            <ToolbarSelect
              id="uuid-count"
              value={countMode}
              onChange={(value) => {
                setCountMode(value);
                if (value !== "custom") {
                  setCustomCount(value);
                }
              }}
              options={countOptions}
            />
          </ToolbarGroup>
          {countMode === "custom" && (
            <ToolbarGroup label="Custom">
              <Input
                type="text"
                value={customCount}
                onChange={(e) => setCustomCount(e.target.value)}
                aria-label="Custom UUID count"
                className="h-8 w-20 text-[13px] font-mono"
                inputMode="numeric"
                spellCheck={false}
              />
            </ToolbarGroup>
          )}

          <div className="hidden h-4 w-px bg-border sm:block" />

          <div className="flex items-center gap-4">
            <ToolbarCheckbox
              checked={options.uppercase}
              onChange={(checked) =>
                setOptions((current) => ({ ...current, uppercase: checked }))
              }
              label="Uppercase"
            />
            <ToolbarCheckbox
              checked={options.hyphens}
              onChange={(checked) =>
                setOptions((current) => ({ ...current, hyphens: checked }))
              }
              label="Hyphens"
            />
            <ToolbarCheckbox
              checked={options.braces}
              onChange={(checked) =>
                setOptions((current) => ({ ...current, braces: checked }))
              }
              label="Braces"
            />
          </div>
        </ToolOptionsBar>

        <ToolStatusStack>
          {countError && (
            <AlertBox variant="error">
              <span>{countError}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody>
          {uuids.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <ToolMeta>Generated UUIDs</ToolMeta>
                <CopyButton text={output} />
              </div>
              <Textarea
                readOnly
                ref={resultRef}
                value={output}
                rows={Math.min(uuids.length, 20)}
                className="max-h-[32rem] font-mono"
              />
            </section>
          ) : (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                <FontAwesomeIcon
                  icon={faHashtag}
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="text-[13px] text-muted-foreground">
                Click Generate to create UUIDs
              </p>
            </div>
          )}
        </ToolBody>
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Uses <code className="font-mono">crypto.randomUUID()</code> for
        cryptographically secure generation.
      </ToolFootnote>
    </ToolPage>
  );
}
