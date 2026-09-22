"use client";

import { faKey } from "@fortawesome/free-solid-svg-icons/faKey";
import { faShieldHalved } from "@fortawesome/free-solid-svg-icons/faShieldHalved";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useMemo, useState } from "react";
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
import { useAnnouncer } from "@/hooks/useAnnouncement";
import { useFocusResult, useRunShortcut } from "@/hooks/useRunShortcut";
import {
  estimateEntropyBits,
  generatePasswords,
  type PasswordOptions,
} from "@/lib/password";
import { parseNonNegativeInt } from "@/lib/utils";

const lengthOptions = [
  { value: "12", label: "12" },
  { value: "16", label: "16" },
  { value: "20", label: "20" },
  { value: "24", label: "24" },
  { value: "32", label: "32" },
  { value: "48", label: "48" },
  { value: "64", label: "64" },
];

const countOptions = [
  { value: "1", label: "1" },
  { value: "3", label: "3" },
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "custom", label: "Custom…" },
];

const MIN_PASSWORD_COUNT = 1;
const MAX_PASSWORD_COUNT = 200;

function getStrengthLabel(entropyBits: number): string {
  if (entropyBits >= 100) return "Very strong";
  if (entropyBits >= 80) return "Strong";
  if (entropyBits >= 60) return "Reasonable";
  return "Weak";
}

export default function PasswordGenerator() {
  const [length, setLength] = useState("20");
  const [countMode, setCountMode] = useState("5");
  const [customCount, setCustomCount] = useState("5");
  const [options, setOptions] = useState<Omit<PasswordOptions, "length">>({
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: true,
    excludeChars: "",
  });
  const [announcement, announce] = useAnnouncer();
  const [passwords, setPasswords] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fullOptions: PasswordOptions = useMemo(
    () => ({
      ...options,
      length: Number.parseInt(length, 10),
    }),
    [options, length],
  );

  const entropy = useMemo(
    () => estimateEntropyBits(fullOptions),
    [fullOptions],
  );

  const countInput = countMode === "custom" ? customCount : countMode;
  const parsedCustomCount = parseNonNegativeInt(countInput);
  const countError =
    parsedCustomCount === null
      ? "Count must be a whole number."
      : parsedCustomCount < MIN_PASSWORD_COUNT ||
          parsedCustomCount > MAX_PASSWORD_COUNT
        ? `Count must be between ${MIN_PASSWORD_COUNT} and ${MAX_PASSWORD_COUNT}.`
        : null;

  const [resultRef, focusResultOnNextRender] =
    useFocusResult<HTMLTextAreaElement>();

  const generate = useCallback(() => {
    if (parsedCustomCount === null || countError) {
      setPasswords([]);
      setError(null);
      return;
    }
    setError(null);
    try {
      const generated = generatePasswords(fullOptions, parsedCustomCount);
      setPasswords(generated);
      focusResultOnNextRender();
      announce(
        `${generated.length} password${generated.length === 1 ? "" : "s"} generated, ${entropy.toFixed(0)} bits each.`,
      );
    } catch (e) {
      setPasswords([]);
      setError(e instanceof Error ? e.message : "Failed to generate passwords");
    }
  }, [
    announce,
    countError,
    entropy,
    focusResultOnNextRender,
    fullOptions,
    parsedCustomCount,
  ]);

  const hasNoCharset =
    !options.includeUppercase &&
    !options.includeLowercase &&
    !options.includeNumbers &&
    !options.includeSymbols;

  useRunShortcut(generate, !countError && !hasNoCharset);

  const clear = useCallback(() => {
    setPasswords([]);
    setError(null);
    announce("");
  }, [announce]);

  const output = passwords.join("\n");

  return (
    <ToolPage>
      <ToolHeader
        title="Password Generator"
        description="Cryptographically secure generator using Web Crypto with unbiased random sampling"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={generate}
              disabled={Boolean(countError) || hasNoCharset}
              aria-keyshortcuts="Meta+Enter Control+Enter"
            >
              <FontAwesomeIcon
                icon={faShieldHalved}
                className="h-3 w-3"
                aria-hidden="true"
              />
              Generate
              <RunShortcutHint />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <ToolMeta>
              {passwords.length > 0
                ? `${entropy.toFixed(1)} bits, ${getStrengthLabel(entropy)}`
                : `≈${entropy.toFixed(0)} bits with these settings`}
            </ToolMeta>
            {passwords.length > 0 && (
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
          <ToolbarGroup label="Length" htmlFor="password-length">
            <ToolbarSelect
              id="password-length"
              value={length}
              onChange={setLength}
              options={lengthOptions}
            />
          </ToolbarGroup>
          <ToolbarGroup label="Count" htmlFor="password-count">
            <ToolbarSelect
              id="password-count"
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
                aria-label="Custom password count"
                className="h-8 w-20 text-[13px] font-mono"
                inputMode="numeric"
                spellCheck={false}
              />
            </ToolbarGroup>
          )}

          <div className="hidden h-4 w-px bg-border sm:block" />

          <div className="flex flex-wrap items-center gap-4">
            <ToolbarCheckbox
              checked={options.includeUppercase}
              onChange={(checked) =>
                setOptions((previous) => ({
                  ...previous,
                  includeUppercase: checked,
                }))
              }
              label="Uppercase"
            />
            <ToolbarCheckbox
              checked={options.includeLowercase}
              onChange={(checked) =>
                setOptions((previous) => ({
                  ...previous,
                  includeLowercase: checked,
                }))
              }
              label="Lowercase"
            />
            <ToolbarCheckbox
              checked={options.includeNumbers}
              onChange={(checked) =>
                setOptions((previous) => ({
                  ...previous,
                  includeNumbers: checked,
                }))
              }
              label="Numbers"
            />
            <ToolbarCheckbox
              checked={options.includeSymbols}
              onChange={(checked) =>
                setOptions((previous) => ({
                  ...previous,
                  includeSymbols: checked,
                }))
              }
              label="Symbols"
            />
            <ToolbarCheckbox
              checked={options.excludeSimilar}
              onChange={(checked) =>
                setOptions((previous) => ({
                  ...previous,
                  excludeSimilar: checked,
                }))
              }
              label="Exclude similar (Il1O0o)"
            />
          </div>
        </ToolOptionsBar>

        <ToolStatusStack>
          {countError && (
            <AlertBox variant="error">
              <span>{countError}</span>
            </AlertBox>
          )}

          {hasNoCharset && (
            <AlertBox variant="error">
              <span>Select at least one character group.</span>
            </AlertBox>
          )}

          {error && (
            <AlertBox variant="error">
              <span>{error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody>
          <div>
            <ToolLabel htmlFor="password-exclude-chars">
              Exclude specific characters
            </ToolLabel>
            <Input
              id="password-exclude-chars"
              type="text"
              value={options.excludeChars}
              onChange={(e) =>
                setOptions((previous) => ({
                  ...previous,
                  excludeChars: e.target.value,
                }))
              }
              placeholder="e.g. @%#"
              aria-label="Characters to exclude"
              className="h-9 text-[13px] font-mono"
              spellCheck={false}
            />
          </div>
        </ToolBody>

        <ToolBody>
          {passwords.length > 0 ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <ToolMeta>Generated Passwords</ToolMeta>
                <CopyButton text={output} />
              </div>
              <Textarea
                readOnly
                ref={resultRef}
                value={output}
                rows={Math.min(20, passwords.length + 1)}
                aria-label="Generated passwords"
                className="max-h-[32rem] font-mono"
              />
            </section>
          ) : (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                <FontAwesomeIcon
                  icon={faKey}
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="text-[13px] text-muted-foreground">
                Click Generate to create secure passwords
              </p>
            </div>
          )}
        </ToolBody>
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Generated with{" "}
        <code className="font-mono">crypto.getRandomValues()</code>, never saved
        to localStorage, cookies, URL params, or server logs.
      </ToolFootnote>
    </ToolPage>
  );
}
