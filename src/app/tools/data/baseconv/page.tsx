"use client";

import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faRightLeft } from "@fortawesome/free-solid-svg-icons/faRightLeft";
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
  ToolMeta,
  ToolOptionsBar,
  ToolPage,
  ToolStatusStack,
  ToolToolbar,
} from "@/components/tool/ToolScaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { BASE_LABELS, convertBase, type NumberBase } from "@/lib/baseconv";

const baseOptions = [
  { value: "dec", label: "Decimal (10)" },
  { value: "hex", label: "Hexadecimal (16)" },
  { value: "bin", label: "Binary (2)" },
  { value: "oct", label: "Octal (8)" },
];

const allBases: NumberBase[] = ["bin", "oct", "dec", "hex"];

export default function NumberBaseConverter() {
  const { readText, pasteError } = useClipboard();

  const [input, setInput] = useState("");
  const [fromBase, setFromBase] = useState<NumberBase>("dec");

  const result = useMemo(() => convertBase(input, fromBase), [input, fromBase]);

  const announcement = useAnnouncement(
    result && !result.error
      ? `Converted from ${fromBase}. Decimal ${result.dec}.`
      : "",
    500,
    result?.dec,
  );

  const hasResult =
    !result.error &&
    (result.bin.length > 0 ||
      result.oct.length > 0 ||
      result.dec.length > 0 ||
      result.hex.length > 0);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setInput(text);
  }, [readText]);

  return (
    <ToolPage>
      <ToolHeader
        title="Number Base Converter"
        description="Convert numbers between binary, octal, decimal, and hexadecimal"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="ml-auto flex items-center gap-2">
            {input && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setInput("")}
              >
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
          <ToolbarGroup label="Input Base" htmlFor="baseconv-input-number-base">
            <ToolbarSelect
              id="baseconv-input-number-base"
              value={fromBase}
              onChange={(v) => setFromBase(v as NumberBase)}
              options={baseOptions}
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
          {result.error && (
            <AlertBox variant="error">
              <span>{result.error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="baseconv-input">Input Number</ToolLabel>
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
            <Input
              id="baseconv-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Enter a ${BASE_LABELS[fromBase].toLowerCase()} number...`}
              aria-label="Number input"
              className="h-10 text-[14px] font-mono"
              spellCheck={false}
            />
          </section>
        </ToolBody>

        {hasResult ? (
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <ToolMeta>All Bases</ToolMeta>
              <CopyButton
                text={allBases
                  .map((b) => `${BASE_LABELS[b]}: ${result[b]}`)
                  .join("\n")}
              />
            </div>
            <div className="divide-y divide-border">
              {allBases.map((base) => (
                <div key={base} className="flex items-center gap-4 px-4 py-3">
                  <ToolMeta className="w-24 shrink-0">
                    {BASE_LABELS[base]}
                  </ToolMeta>
                  <code className="flex-1 break-all font-mono text-[13px] leading-relaxed text-foreground">
                    {base === "hex" ? result[base].toUpperCase() : result[base]}
                  </code>
                  <CopyButton text={result[base]} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          !result.error && (
            <div className="border-t py-12 text-center border-border">
              <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                <FontAwesomeIcon
                  icon={faRightLeft}
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="text-[13px] text-muted-foreground">
                Converted bases appear here as you type
              </p>
            </div>
          )
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Supports arbitrary precision using <code>BigInt</code>. Accepts 0x, 0b,
        0o prefixes. All processing happens locally in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}
