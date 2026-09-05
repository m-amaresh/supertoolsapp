"use client";

import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faQrcode } from "@fortawesome/free-solid-svg-icons/faQrcode";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { ToolbarGroup, ToolbarSelect } from "@/components/Toolbar";
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
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import {
  generateQrMatrix,
  generateQrPngDataUrl,
  matrixToSvg,
  type QrErrorCorrection,
  type QrMatrix,
  qrErrorCorrectionOptions,
  qrPresets,
} from "@/lib/qrcode";

const MARGIN = 2;
const MODULE_SIZE = 8;

export default function QrCodeGenerator() {
  const { readText, pasteError } = useClipboard();
  const [input, setInput] = useState("");
  const [errorCorrection, setErrorCorrection] =
    useState<QrErrorCorrection>("M");
  const [matrix, setMatrix] = useState<QrMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const announcement = useAnnouncement(
    matrix
      ? `QR code generated, ${matrix.size} by ${matrix.size} modules.`
      : "",
    500,
    input,
  );

  // Generate only the matrix on input changes — preview is rendered as native
  // React rects, so PNG is not needed until the user clicks Download. Keeping
  // PNG out of the hot path also means a PNG failure can't clobber a valid
  // preview matrix.
  useEffect(() => {
    let cancelled = false;

    if (!input) {
      setMatrix(null);
      setError(null);
      return;
    }

    (async () => {
      try {
        const next = await generateQrMatrix(input, { errorCorrection });
        if (cancelled) return;
        setMatrix(next);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setMatrix(null);
        setError(e instanceof Error ? e.message : "Failed to generate QR code");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [input, errorCorrection]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setInput(text);
  }, [readText]);

  const handleClear = useCallback(() => {
    setInput("");
    setMatrix(null);
    setError(null);
  }, []);

  const downloadSvg = useCallback(() => {
    if (!matrix) return;
    const svg = matrixToSvg(matrix, {
      margin: MARGIN,
      moduleSize: MODULE_SIZE,
    });
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, "qrcode.svg");
    URL.revokeObjectURL(url);
  }, [matrix]);

  const downloadPng = useCallback(async () => {
    if (!input) return;
    setIsExportingPng(true);
    try {
      const png = await generateQrPngDataUrl(input, {
        errorCorrection,
        scale: 12,
      });
      triggerDownload(png, "qrcode.png");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to render PNG download",
      );
    } finally {
      setIsExportingPng(false);
    }
  }, [input, errorCorrection]);

  return (
    <ToolPage>
      <ToolHeader
        title="QR Code Generator"
        description="Encode URLs, Wi-Fi credentials, vCards, or any text into a scannable QR code"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            {matrix && (
              <>
                <Button type="button" onClick={downloadSvg}>
                  <FontAwesomeIcon
                    icon={faDownload}
                    className="h-3 w-3"
                    aria-hidden="true"
                  />
                  SVG
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={downloadPng}
                  disabled={isExportingPng}
                >
                  <FontAwesomeIcon
                    icon={faDownload}
                    className="h-3 w-3"
                    aria-hidden="true"
                  />
                  {isExportingPng ? "Rendering…" : "PNG"}
                </Button>
              </>
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
          <ToolbarGroup
            label="Error Correction"
            htmlFor="qrcode-error-correction-level"
          >
            <ToolbarSelect
              id="qrcode-error-correction-level"
              value={errorCorrection}
              onChange={(v) => setErrorCorrection(v as QrErrorCorrection)}
              options={qrErrorCorrectionOptions}
              className="min-w-[220px]"
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
          {error && (
            <AlertBox variant="error">
              <span>{error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-4">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="qr-input">Text or URL</ToolLabel>
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
              id="qr-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://example.com or any text..."
              rows={5}
              aria-label="QR code text input"
              className="font-mono"
              spellCheck={false}
            />
          </section>

          <ToolPresets label="Presets" count={qrPresets.length}>
            {qrPresets.map((preset) => (
              <Button
                key={preset.name}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setInput(preset.template)}
                title={preset.description}
              >
                {preset.name}
              </Button>
            ))}
          </ToolPresets>
        </ToolBody>

        {matrix ? (
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-4 py-3">
              <ToolMeta>
                {matrix.size}×{matrix.size} modules · level{" "}
                {matrix.errorCorrection} · {matrix.byteLength} bytes
              </ToolMeta>
            </div>
            <div className="flex items-center justify-center bg-muted/40 p-6">
              <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
                <QrPreview matrix={matrix} />
              </div>
            </div>
          </div>
        ) : (
          !error && (
            <div className="border-t border-border py-12 text-center">
              <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                <FontAwesomeIcon
                  icon={faQrcode}
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="text-[13px] text-muted-foreground">
                The QR code appears here as you type
              </p>
            </div>
          )
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Generation runs locally using the audited <code>qrcode</code> library.
        Higher error correction levels produce denser QR codes but tolerate more
        damage when scanned.
      </ToolFootnote>
    </ToolPage>
  );
}

function QrPreview({ matrix }: { matrix: QrMatrix }) {
  const dimension = (matrix.size + MARGIN * 2) * MODULE_SIZE;
  const rects: React.ReactElement[] = [];

  for (let row = 0; row < matrix.size; row++) {
    for (let col = 0; col < matrix.size; col++) {
      if (!matrix.modules[row][col]) continue;
      rects.push(
        <rect
          key={`${row}-${col}`}
          x={(col + MARGIN) * MODULE_SIZE}
          y={(row + MARGIN) * MODULE_SIZE}
          width={MODULE_SIZE}
          height={MODULE_SIZE}
          fill="#000"
        />,
      );
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${dimension} ${dimension}`}
      shapeRendering="crispEdges"
      width="256"
      height="256"
      role="img"
      aria-label="Generated QR code"
    >
      <rect width={dimension} height={dimension} fill="#fff" />
      {rects}
    </svg>
  );
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
