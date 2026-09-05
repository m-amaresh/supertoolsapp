"use client";

import { faPalette } from "@fortawesome/free-solid-svg-icons/faPalette";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
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
  ToolHint,
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
import { useToolState } from "@/hooks/useToolState";
import { generatePalette, parseColor } from "@/lib/color";

const paletteCountOptions = [
  { value: "4", label: "4" },
  { value: "6", label: "6" },
  { value: "8", label: "8" },
  { value: "12", label: "12" },
];

export default function ColorConverter() {
  const { readText, pasteError } = useClipboard();
  const [{ input }, { setInput, handleClear }] = useToolState();

  const [paletteCount, setPaletteCount] = useState("6");

  const result = useMemo(() => parseColor(input), [input]);

  const announcement = useAnnouncement(
    result && !result.error ? `Colour parsed. Hex ${result.hex}.` : "",
    500,
    result?.hex,
  );
  const hasResult = !result.error && result.hex.length > 0;

  const palette = useMemo(() => {
    if (!hasResult) return [];
    return generatePalette(result.hex, Number.parseInt(paletteCount, 10));
  }, [hasResult, paletteCount, result.hex]);

  const handlePickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInput(e.target.value);
    },
    [setInput],
  );

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setInput(text);
  }, [readText, setInput]);

  const rgbString = `rgb(${result.rgb.r}, ${result.rgb.g}, ${result.rgb.b})`;
  const hslString = `hsl(${result.hsl.h}, ${result.hsl.s}%, ${result.hsl.l}%)`;
  const oklchString = `oklch(${(result.oklch.l * 100).toFixed(2)}% ${result.oklch.c.toFixed(3)} ${result.oklch.h.toFixed(2)})`;

  return (
    <ToolPage>
      <ToolHeader
        title="Color Converter"
        description="Convert between HEX, RGB, HSL, and OKLCH with palette generation"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="ml-auto flex items-center gap-2">
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
          <ToolbarGroup label="Palette Size" htmlFor="color-palette-size">
            <ToolbarSelect
              id="color-palette-size"
              value={paletteCount}
              onChange={setPaletteCount}
              options={paletteCountOptions}
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
          {result.error && input && (
            <AlertBox variant="error">
              <span>{result.error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="color-input">Color Input</ToolLabel>
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
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/25 p-3">
              <label className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Picker
                </span>
                <input
                  type="color"
                  value={hasResult ? result.hex : "#000000"}
                  onChange={handlePickerChange}
                  aria-label="Color picker"
                  className="h-12 w-20 cursor-pointer rounded-md border border-border bg-transparent p-0.5 shadow-sm"
                />
              </label>
              <Input
                id="color-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="#ff6600"
                aria-label="Color value"
                className="h-10 flex-1 text-[13px] font-mono"
                spellCheck={false}
                aria-describedby="color-format-hint"
              />
            </div>
            {/* Below the row, not inside it: as a flex sibling the hint
                competed with the picker and text field for one non-wrapping
                line, squeezing the input to 26px at 375px. */}
            <ToolHint id="color-format-hint">
              Accepts hex, rgb(), hsl() and oklch() — for example #ff6600,
              rgb(255,102,0), hsl(24,100%,50%), or oklch(65% 0.2 30).
            </ToolHint>
          </section>
        </ToolBody>

        {hasResult ? (
          <div className="border-t border-border">
            <div className="px-4 pt-4">
              <div
                className="h-20 rounded-lg border border-border"
                style={{ backgroundColor: result.hex }}
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <ToolMeta>All Formats</ToolMeta>
              <CopyButton
                text={`HEX: ${result.hex}\nRGB: ${rgbString}\nHSL: ${hslString}\nOKLCH: ${oklchString}`}
              />
            </div>
            <div className="divide-y divide-border">
              <div className="flex items-center gap-4 px-4 py-3">
                <ToolMeta className="w-24 shrink-0">HEX</ToolMeta>
                <code className="flex-1 font-mono text-[13px] text-foreground">
                  {result.hex}
                </code>
                <CopyButton text={result.hex} />
              </div>

              <div className="flex items-center gap-4 px-4 py-3">
                <ToolMeta className="w-24 shrink-0">RGB</ToolMeta>
                <code className="flex-1 font-mono text-[13px] text-foreground">
                  {rgbString}
                </code>
                <CopyButton text={rgbString} />
              </div>

              <div className="flex items-center gap-4 px-4 py-3">
                <ToolMeta className="w-24 shrink-0">HSL</ToolMeta>
                <code className="flex-1 font-mono text-[13px] text-foreground">
                  {hslString}
                </code>
                <CopyButton text={hslString} />
              </div>

              <div className="flex items-center gap-4 px-4 py-3">
                <ToolMeta className="w-24 shrink-0">OKLCH</ToolMeta>
                <code className="flex-1 font-mono text-[13px] text-foreground">
                  {oklchString}
                </code>
                <CopyButton text={oklchString} />
              </div>
            </div>

            {palette.length > 0 && (
              <div className="border-t px-4 pb-4 pt-4 border-border">
                <div className="mb-2 flex items-center justify-between">
                  <ToolMeta>Palette (evenly spaced hues)</ToolMeta>
                  <CopyButton text={palette.join(", ")} />
                </div>
                {/* Wraps and gives each swatch a floor: six fixed swatches
                    overflowed the card at 375px. */}
                <div className="flex flex-wrap gap-1.5">
                  {palette.map((color) => (
                    <div key={color} className="group relative min-w-14 flex-1">
                      <div
                        className="h-10 cursor-pointer rounded-md border border-border"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                      <span className="mt-1 block truncate text-center font-mono text-[12px] text-muted-foreground">
                        {color}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          !result.error && (
            <div className="border-t py-12 text-center border-border">
              <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                <FontAwesomeIcon
                  icon={faPalette}
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="text-[13px] text-muted-foreground">
                Colour formats appear here as you type
              </p>
            </div>
          )
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Accepts HEX (#rgb, #rrggbb), RGB (rgb(r, g, b)), HSL (hsl(h, s%, l%)),
        OKLCH (oklch(L% C H)), or bare values (r, g, b). All processing happens
        locally in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}
