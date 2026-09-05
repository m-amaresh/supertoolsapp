"use client";

import { faFilePen } from "@fortawesome/free-solid-svg-icons/faFilePen";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useMemo, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import {
  SegmentedControl,
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
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncer } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { useFocusResult, useRunShortcut } from "@/hooks/useRunShortcut";
import { useToolState } from "@/hooks/useToolState";
import type { ByteTextEncoding } from "@/lib/bytes";
import { MAX_INPUT_SIZE, TEXT_ENCODING_OPTIONS } from "@/lib/constants";
import {
  type RsaSignatureEncoding,
  signRsaSha256,
  verifyRsaSha256,
} from "@/lib/rsa";

type Mode = "sign" | "verify";

const signatureEncodingOptions = [
  { value: "base64", label: "Base64" },
  { value: "base64url", label: "Base64URL" },
  { value: "hex", label: "Hex" },
] as const;

export default function RsaSignVerifyPage() {
  const { readText, pasteError } = useClipboard();
  const [{ error }, { setError }] = useToolState();

  const [mode, setMode] = useState<Mode>("sign");
  const [message, setMessage] = useState("");
  const [keyPem, setKeyPem] = useState("");
  const [signature, setSignature] = useState("");
  const [messageEncoding, setMessageEncoding] =
    useState<ByteTextEncoding>("utf8");
  const [signatureEncoding, setSignatureEncoding] =
    useState<RsaSignatureEncoding>("base64");
  const [isProcessing, setIsProcessing] = useState(false);
  const [announcement, announce] = useAnnouncer();
  const [success, setSuccess] = useState<string | null>(null);

  const keyLabel = useMemo(
    () => (mode === "sign" ? "Private Key (PEM)" : "Public Key (PEM)"),
    [mode],
  );

  const keyPlaceholder = useMemo(
    () =>
      mode === "sign"
        ? "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----"
        : "-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----",
    [mode],
  );

  const messageLabel =
    mode === "sign" ? "Message to Sign" : "Message to Verify";
  const signatureLabel =
    mode === "sign" ? "Signature Output" : "Signature to Verify";

  const handleClear = useCallback(() => {
    setMessage("");
    setKeyPem("");
    setSignature("");
    setSuccess(null);
    setError(null);
  }, [setError]);

  const handlePasteMessage = useCallback(async () => {
    const text = await readText();
    if (text !== null) {
      setMessage(text);
      setError(null);
      setSuccess(null);
    }
  }, [readText, setError]);

  // Signing produces the signature textarea; verifying produces a status
  // message, and leaves that same textarea as an input the user typed into.
  const [resultRef, focusResultOnNextRender] = useFocusResult<HTMLElement>();

  const handleExecute = useCallback(async () => {
    setSuccess(null);
    setError(null);

    if (!message.trim()) {
      setError("Message is required");
      return;
    }

    if (!keyPem.trim()) {
      setError(
        mode === "sign"
          ? "Private key PEM is required"
          : "Public key PEM is required",
      );
      return;
    }

    if (mode === "verify" && !signature.trim()) {
      setError("Signature is required for verification");
      return;
    }

    if (
      message.length > MAX_INPUT_SIZE ||
      keyPem.length > MAX_INPUT_SIZE ||
      (mode === "verify" && signature.length > MAX_INPUT_SIZE)
    ) {
      setError("Input exceeds 1MB — reduce input size before processing");
      return;
    }

    setIsProcessing(true);

    try {
      if (mode === "sign") {
        const nextSignature = await signRsaSha256(message, keyPem, {
          messageEncoding,
          signatureEncoding,
        });
        setSignature(nextSignature);
        setSuccess("Signature generated");
        focusResultOnNextRender();
        announce("Signature generated.");
      } else {
        const valid = await verifyRsaSha256(message, signature, keyPem, {
          messageEncoding,
          signatureEncoding,
        });

        if (valid) {
          setSuccess("Signature is valid");
          announce("Signature is valid.");
          focusResultOnNextRender();
        } else {
          // The AlertBox carries role="alert", which announces this already.
          setError("Signature is invalid");
          focusResultOnNextRender();
        }
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to process RSA operation",
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    announce,
    focusResultOnNextRender,
    keyPem,
    message,
    messageEncoding,
    mode,
    setError,
    signature,
    signatureEncoding,
  ]);

  useRunShortcut(handleExecute, !isProcessing);

  return (
    <ToolPage>
      <ToolHeader
        title="RSA Sign/Verify"
        description="Sign and verify messages with RSA (SHA-256) using PEM keys"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleExecute}
              aria-keyshortcuts="Meta+Enter Control+Enter"
            >
              <FontAwesomeIcon
                icon={faFilePen}
                className="h-3 w-3"
                aria-hidden="true"
              />
              {isProcessing
                ? "Working..."
                : mode === "sign"
                  ? "Sign"
                  : "Verify"}
              <RunShortcutHint />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {(message || keyPem || signature) && (
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
          <ToolbarGroup label="Operation">
            <SegmentedControl
              value={mode}
              onChange={(value) => {
                setMode(value as Mode);
                setError(null);
                setSuccess(null);
              }}
              ariaLabel="RSA operation"
              options={[
                { value: "sign", label: "Sign" },
                { value: "verify", label: "Verify" },
              ]}
            />
          </ToolbarGroup>

          <ToolbarGroup label="Message Encoding" htmlFor="rsa-message-encoding">
            <ToolbarSelect
              id="rsa-message-encoding"
              value={messageEncoding}
              onChange={(value) =>
                setMessageEncoding(value as ByteTextEncoding)
              }
              options={TEXT_ENCODING_OPTIONS}
            />
          </ToolbarGroup>

          <ToolbarGroup
            label="Signature Encoding"
            htmlFor="rsa-signature-encoding"
          >
            <ToolbarSelect
              id="rsa-signature-encoding"
              value={signatureEncoding}
              onChange={(value) =>
                setSignatureEncoding(value as RsaSignatureEncoding)
              }
              options={[...signatureEncodingOptions]}
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
          {mode === "verify" && (success || error) && (
            <div
              ref={resultRef as React.RefObject<HTMLDivElement>}
              tabIndex={-1}
              className="space-y-2 outline-none"
            >
              {success && (
                <AlertBox variant="success" role="presentation">
                  <span>{success}</span>
                </AlertBox>
              )}
              {error && (
                <AlertBox variant="error">
                  <span>{error}</span>
                </AlertBox>
              )}
            </div>
          )}

          {mode === "sign" && success && (
            <AlertBox variant="success" role="presentation">
              <span>{success}</span>
            </AlertBox>
          )}

          {mode === "sign" && error && (
            <AlertBox variant="error">
              <span>{error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <ToolMeta>
            Supports PKCS#8 private keys and SPKI public keys in PEM format.
            Hash algorithm is fixed to SHA-256.
          </ToolMeta>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="rsa-message">{messageLabel}</ToolLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handlePasteMessage}
              >
                <FontAwesomeIcon
                  icon={faPaste}
                  className="h-2.5 w-2.5"
                  aria-hidden="true"
                />
                Paste Message
              </Button>
            </div>
            <Textarea
              id="rsa-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message to sign or verify..."
              rows={8}
              className="font-mono min-h-56"
              spellCheck={false}
            />
          </section>

          <section>
            <ToolLabel htmlFor="rsa-key">{keyLabel}</ToolLabel>
            <Textarea
              id="rsa-key"
              value={keyPem}
              onChange={(e) => setKeyPem(e.target.value)}
              placeholder={keyPlaceholder}
              rows={8}
              className="font-mono min-h-56"
              spellCheck={false}
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="rsa-signature" className="mb-0">
                {signatureLabel}
              </ToolLabel>
              {mode === "sign" && signature && <CopyButton text={signature} />}
            </div>
            <Textarea
              id="rsa-signature"
              ref={
                mode === "sign"
                  ? (resultRef as React.RefObject<HTMLTextAreaElement>)
                  : undefined
              }
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              readOnly={mode === "sign"}
              placeholder={
                mode === "sign"
                  ? "Signature output will appear here"
                  : "Paste signature to verify"
              }
              rows={5}
              className="font-mono min-h-40"
              spellCheck={false}
            />
          </section>
        </ToolBody>
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Uses Web Crypto <code>RSASSA-PKCS1-v1_5</code> with SHA-256. Private
        keys never leave your browser.
      </ToolFootnote>
    </ToolPage>
  );
}
