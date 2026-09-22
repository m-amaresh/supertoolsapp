"use client";

import { faFlask } from "@fortawesome/free-solid-svg-icons/faFlask";
import { faKey } from "@fortawesome/free-solid-svg-icons/faKey";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faShieldHalved } from "@fortawesome/free-solid-svg-icons/faShieldHalved";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import {
  ToolBody,
  ToolCard,
  ToolCodeBlock,
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
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { useToolState } from "@/hooks/useToolState";
import { MAX_INPUT_SIZE } from "@/lib/constants";
import { decodeJwt } from "@/lib/jwt";

const SAMPLE_HEADER = { alg: "HS256", typ: "JWT" };
const SAMPLE_PAYLOAD = {
  sub: "1234567890",
  name: "John Doe",
  iat: 1516239022,
};

function formatDate(date: Date): string {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
}

export default function JwtDecoder() {
  const { readText, pasteError } = useClipboard();
  const [{ input }, { setInput, handleClear }] = useToolState();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const oversized = input.length > MAX_INPUT_SIZE;
  const result = useMemo(
    () => (oversized ? null : decodeJwt(input)),
    [input, oversized],
  );

  const announcement = useAnnouncement(
    result?.decoded
      ? `JWT decoded. Algorithm ${String(result.decoded.header.alg ?? "unknown")}.`
      : "",
    500,
    input,
  );

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setInput(text);
  }, [readText, setInput]);

  const handleSample = useCallback(() => {
    const header = btoa(JSON.stringify(SAMPLE_HEADER))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const payload = btoa(JSON.stringify(SAMPLE_PAYLOAD))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    setInput(
      `${header}.${payload}.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c`,
    );
  }, [setInput]);

  return (
    <ToolPage>
      <ToolHeader
        title="JWT Decoder"
        description="Decode JSON Web Tokens to inspect header, payload, and expiration"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleSample}>
              <FontAwesomeIcon
                icon={faFlask}
                className="h-3 w-3"
                aria-hidden="true"
              />
              Load sample
            </Button>

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

        <ToolStatusStack>
          {pasteError && (
            <AlertBox variant="error">
              <span>
                Clipboard access denied — use Ctrl+V / Cmd+V to paste directly.
              </span>
            </AlertBox>
          )}
          {result?.decoded && (
            <AlertBox variant="warn">
              <span>
                Signature not verified — this tool decodes JWTs but does not
                validate token integrity.
              </span>
            </AlertBox>
          )}
          {oversized && (
            <AlertBox variant="warn">
              <span>Input exceeds 1MB — reduce input size to decode.</span>
            </AlertBox>
          )}
          {result?.error && (
            <AlertBox variant="error">
              <span>{result.error}</span>
            </AlertBox>
          )}
          {mounted && result?.decoded && result.isExpired !== null && (
            <AlertBox variant={result.isExpired ? "error" : "success"}>
              <span>
                {result.isExpired
                  ? "Token is expired"
                  : "Token is valid (not expired)"}
                {result.expiresAt &&
                  ` — expires ${formatDate(result.expiresAt)}`}
              </span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <ToolMeta>
            <FontAwesomeIcon
              icon={faShieldHalved}
              className="h-2.5 w-2.5 mr-1.5"
              aria-hidden="true"
            />
            Decoding only — signature is not verified
          </ToolMeta>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="jwt-input">JWT Token</ToolLabel>
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
              id="jwt-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste a JWT token here (eyJhbGciOi...)..."
              rows={4}
              aria-label="JWT token input"
              className="font-mono min-h-40"
              spellCheck={false}
            />
          </section>
        </ToolBody>

        {result?.decoded ? (
          <div className="border-t border-border">
            {mounted && (result.issuedAt || result.notBefore) && (
              <div className="flex flex-wrap gap-4 px-4 pt-3">
                {result.issuedAt && (
                  <div className="text-[12px] text-muted-foreground">
                    <span className="font-medium">Issued:</span>{" "}
                    {formatDate(result.issuedAt)}
                  </div>
                )}
                {result.notBefore && (
                  <div className="text-[12px] text-muted-foreground">
                    <span className="font-medium">Not before:</span>{" "}
                    {formatDate(result.notBefore)}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 pb-0">
              <div className="mb-2 flex items-center justify-between">
                <ToolMeta>Header</ToolMeta>
                <CopyButton text={result.decoded.headerRaw} />
              </div>
              <ToolCodeBlock>{result.decoded.headerRaw}</ToolCodeBlock>
            </div>

            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <ToolMeta>Payload</ToolMeta>
                <CopyButton text={result.decoded.payloadRaw} />
              </div>
              <ToolCodeBlock>{result.decoded.payloadRaw}</ToolCodeBlock>
            </div>

            <div className="px-4 pb-4">
              <div className="mb-2 flex items-center justify-between">
                <ToolMeta>Signature</ToolMeta>
                <CopyButton text={result.decoded.signature} />
              </div>
              <ToolCodeBlock className="break-all whitespace-pre-wrap">
                {result.decoded.signature}
              </ToolCodeBlock>
            </div>
          </div>
        ) : (
          !result?.error &&
          !input && (
            <div className="border-t py-12 text-center border-border">
              <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
                <FontAwesomeIcon
                  icon={faKey}
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <p className="text-[13px] text-muted-foreground">
                The decoded token appears here as you type
              </p>
            </div>
          )
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Decodes JWT tokens locally. Signature verification requires the secret
        key and is not performed. All processing happens in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}
