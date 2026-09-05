"use client";

import { faCertificate } from "@fortawesome/free-solid-svg-icons/faCertificate";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faUpload } from "@fortawesome/free-solid-svg-icons/faUpload";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useMemo, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import { RunShortcutHint } from "@/components/tool/RunShortcutHint";
import {
  ToolBody,
  ToolCard,
  ToolFootnote,
  ToolHeader,
  ToolLabel,
  ToolLiveRegion,
  ToolMeta,
  ToolPage,
  ToolStatusStack,
  ToolToolbar,
} from "@/components/tool/ToolScaffold";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncer } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { useFocusResult, useRunShortcut } from "@/hooks/useRunShortcut";
import { useToolState } from "@/hooks/useToolState";
import {
  inspectTlsCertificates,
  type ParsedTlsCertificate,
} from "@/lib/tls-cert";

const MAX_INPUT_SIZE = 2 * 1024 * 1024;

// Generate stable React keys for lists that may have duplicate values
// (e.g. repeated SAN entries). Appends a per-value occurrence index.
function withStableKeys(values: string[]) {
  const counts = new Map<string, number>();
  return values.map((value) => {
    const seen = counts.get(value) ?? 0;
    counts.set(value, seen + 1);
    return {
      key: `${value}-${seen}`,
      value,
    };
  });
}

function withStableCertificateKeys(values: ParsedTlsCertificate[]) {
  const counts = new Map<string, number>();
  return values.map((cert) => {
    const base = `${cert.sha256Fingerprint}-${cert.serialNumber}`;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return {
      key: `${base}-${seen}`,
      cert,
    };
  });
}

export default function TlsCertificateViewer() {
  const { readText, pasteError } = useClipboard();
  const [{ input, error }, { setInput, setError, handleClear }] =
    useToolState();

  const [certificates, setCertificates] = useState<ParsedTlsCertificate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const [announcement, announce] = useAnnouncer();

  const [resultRef, focusResultOnNextRender] = useFocusResult<HTMLDivElement>();

  const handleAnalyze = useCallback(async () => {
    setError(null);
    setCertificates([]);
    announce("");

    if (!input.trim()) return;
    if (input.length > MAX_INPUT_SIZE) {
      setError(
        "Input exceeds 2MB — reduce content size before certificate inspection.",
      );
      return;
    }

    setIsProcessing(true);
    try {
      const parsed = await inspectTlsCertificates(input);
      setCertificates(parsed);
      if (parsed.length === 0) {
        setError("No certificate content found");
      } else {
        focusResultOnNextRender();
        announce(
          `${parsed.length} certificate${parsed.length === 1 ? "" : "s"} parsed.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse certificates");
    } finally {
      setIsProcessing(false);
    }
  }, [announce, focusResultOnNextRender, input, setError]);

  useRunShortcut(handleAnalyze, !isProcessing);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) {
      setInput(text);
      setCertificates([]);
      setError(null);
    }
  }, [readText, setError, setInput]);

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const inputElement = event.currentTarget;
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        setInput(text);
        setCertificates([]);
        setError(null);
      } catch {
        setError("Failed to read certificate file");
      } finally {
        inputElement.value = "";
      }
    },
    [setError, setInput],
  );

  const outputJson = useMemo(
    () =>
      certificates.length > 0 ? JSON.stringify(certificates, null, 2) : "",
    [certificates],
  );

  return (
    <ToolPage>
      <ToolHeader
        title="TLS Certificate Content Viewer"
        description="Inspect PEM certificate metadata locally (subject, issuer, validity, SAN, and fingerprints)"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleAnalyze}
              aria-keyshortcuts="Meta+Enter Control+Enter"
            >
              {isProcessing ? "Analyzing..." : "Analyze"}
              <RunShortcutHint />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <label htmlFor="tls-cert-upload" className="cursor-pointer">
                <FontAwesomeIcon
                  icon={faUpload}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                Upload
              </label>
            </Button>
            <input
              id="tls-cert-upload"
              type="file"
              className="hidden"
              onChange={handleUpload}
            />

            {(input || certificates.length > 0) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  handleClear();
                  setCertificates([]);
                }}
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
                Large input detected. Certificate parsing is capped at 2MB.
              </span>
            </AlertBox>
          )}
          {error && (
            <AlertBox variant="error">
              <span>{error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="tls-cert-input">
                PEM Certificate Input (supports multiple cert blocks)
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
              id="tls-cert-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={10}
              className="font-mono min-h-72"
              spellCheck={false}
              placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
            />
          </section>
        </ToolBody>

        {certificates.length > 0 ? (
          // tabIndex -1 so Analyze can move focus here without adding the
          // region to the tab order.
          <div
            ref={resultRef}
            tabIndex={-1}
            className="border-t border-border outline-none"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <ToolMeta>
                Parsed {certificates.length} certificate
                {certificates.length > 1 ? "s" : ""}
              </ToolMeta>
              {outputJson && <CopyButton text={outputJson} />}
            </div>

            <div className="space-y-3 px-4 pb-4">
              {withStableCertificateKeys(certificates).map(({ key, cert }) => (
                <section
                  key={key}
                  className="rounded-lg border border-border bg-muted/15 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <ToolMeta>
                      {cert.subject || "Certificate"} ({cert.pemLabel})
                    </ToolMeta>
                    <CopyButton text={JSON.stringify(cert, null, 2)} />
                  </div>

                  <div className="space-y-1.5 text-[12px]">
                    <Row label="Subject" value={cert.subject || "(empty)"} />
                    <Row label="Issuer" value={cert.issuer || "(empty)"} />
                    <Row label="Version" value={`v${cert.version}`} />
                    <Row label="Serial" value={cert.serialNumber} mono />
                    <Row
                      label="Valid From"
                      value={cert.notBefore ?? "Unavailable"}
                      mono
                    />
                    <Row
                      label="Valid Until"
                      value={cert.notAfter ?? "Unavailable"}
                      mono
                    />
                    <Row
                      label="Signature Algorithm"
                      value={cert.signatureAlgorithm}
                      mono
                    />
                    <Row
                      label="Public Key Algorithm"
                      value={`${cert.publicKeyAlgorithm}${cert.publicKeyBitLength ? ` (${cert.publicKeyBitLength} bits)` : ""}`}
                      mono
                    />
                    <Row
                      label="SHA-256 Fingerprint"
                      value={cert.sha256Fingerprint}
                      mono
                    />
                    <Row
                      label="DER Size"
                      value={`${cert.derLength} bytes`}
                      mono
                    />
                  </div>

                  {cert.subjectAltNames.length > 0 && (
                    <div className="mt-3">
                      <ToolMeta className="mb-1 block">
                        Subject Alt Names
                      </ToolMeta>
                      <div className="flex flex-wrap gap-1.5">
                        {withStableKeys(cert.subjectAltNames).map((san) => (
                          <span
                            key={san.key}
                            className="rounded border border-border bg-background px-2 py-0.5 font-mono text-[12px] text-foreground"
                          >
                            {san.value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="border-t border-border py-12 text-center">
            <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
              <FontAwesomeIcon
                icon={faCertificate}
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              Paste a certificate block and click Analyze
            </p>
          </div>
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Parses PEM certificate content client-side and extracts X.509 fields
        with no network calls.
      </ToolFootnote>
    </ToolPage>
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono break-all" : "break-all"}>
        {value}
      </span>
    </div>
  );
}
