"use client";

import { faLink } from "@fortawesome/free-solid-svg-icons/faLink";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus";
import { faTrash } from "@fortawesome/free-solid-svg-icons/faTrash";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAnnouncement } from "@/hooks/useAnnouncement";
import { useClipboard } from "@/hooks/useClipboard";
import { useToolState } from "@/hooks/useToolState";
import {
  buildUrlFromParts,
  isNeutralUrlBuilderState,
  parseUrlParts,
  type UrlParam,
} from "@/lib/url-parser";

interface EditableParam extends UrlParam {
  id: string;
}

function createParam(id: string, key = "", value = ""): EditableParam {
  return { id, key, value };
}

export default function UrlParserBuilder() {
  const { readText, pasteError } = useClipboard();
  const [{ input, output }, { setInput, setOutput, handleClear }] =
    useToolState();

  const idRef = useRef(1);
  const nextId = useCallback(() => {
    idRef.current += 1;
    return `param-${idRef.current}`;
  }, []);

  const [protocol, setProtocol] = useState("https:");
  const [hostname, setHostname] = useState("");
  const [port, setPort] = useState("");
  const [pathname, setPathname] = useState("/");
  const [hash, setHash] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [params, setParams] = useState<EditableParam[]>([
    createParam("param-1"),
  ]);
  const isNeutralEmptyState = isNeutralUrlBuilderState({
    hostname,
    port,
    pathname,
    hash,
    username,
    password,
    params,
  });

  const buildResult = useMemo(() => {
    if (isNeutralEmptyState) {
      return {
        url: "",
        error: null as string | null,
      };
    }

    try {
      return {
        url: buildUrlFromParts({
          protocol,
          hostname,
          port,
          pathname,
          hash,
          username,
          password,
          params,
        }),
        error: null as string | null,
      };
    } catch (e) {
      return {
        url: "",
        error: e instanceof Error ? e.message : "Failed to build URL",
      };
    }
  }, [
    hash,
    hostname,
    isNeutralEmptyState,
    params,
    password,
    pathname,
    port,
    protocol,
    username,
  ]);

  useEffect(() => {
    setOutput(buildResult.url);
  }, [buildResult.url, setOutput]);

  const parseUrl = useCallback(
    (text: string) => {
      try {
        const parsed = parseUrlParts(text);
        setProtocol(parsed.protocol);
        setHostname(parsed.hostname);
        setPort(parsed.port);
        setPathname(parsed.pathname);
        setHash(parsed.hash);
        setUsername(parsed.username);
        setPassword(parsed.password);
        setParams(
          parsed.params.length > 0
            ? parsed.params.map((param) =>
                createParam(nextId(), param.key, param.value),
              )
            : [createParam(nextId())],
        );
        setParseError(null);
      } catch (e) {
        setParseError(e instanceof Error ? e.message : "Failed to parse URL");
      }
    },
    [nextId],
  );

  // Parse as you type, like the rest of the toolkit. Debounced so a half-typed
  // URL does not raise an error on every keystroke.
  const parseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!input.trim()) {
      setParseError(null);
      return;
    }
    if (parseDebounceRef.current) clearTimeout(parseDebounceRef.current);
    parseDebounceRef.current = setTimeout(() => parseUrl(input), 300);
    return () => {
      if (parseDebounceRef.current) clearTimeout(parseDebounceRef.current);
    };
  }, [input, parseUrl]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) {
      setInput(text);
      parseUrl(text);
    }
  }, [parseUrl, readText, setInput]);

  const handleFullClear = useCallback(() => {
    handleClear();
    setProtocol("https:");
    setHostname("");
    setPort("");
    setPathname("/");
    setHash("");
    setUsername("");
    setPassword("");
    setParams([createParam(nextId())]);
    setParseError(null);
  }, [handleClear, nextId]);

  const clearParseError = useCallback(() => {
    setParseError(null);
  }, []);

  const setProtocolField = useCallback(
    (value: string) => {
      setProtocol(value);
      clearParseError();
    },
    [clearParseError],
  );

  const setHostnameField = useCallback(
    (value: string) => {
      setHostname(value);
      clearParseError();
    },
    [clearParseError],
  );

  const setPortField = useCallback(
    (value: string) => {
      setPort(value);
      clearParseError();
    },
    [clearParseError],
  );

  const setPathnameField = useCallback(
    (value: string) => {
      setPathname(value);
      clearParseError();
    },
    [clearParseError],
  );

  const setHashField = useCallback(
    (value: string) => {
      setHash(value);
      clearParseError();
    },
    [clearParseError],
  );

  const setUsernameField = useCallback(
    (value: string) => {
      setUsername(value);
      clearParseError();
    },
    [clearParseError],
  );

  const setPasswordField = useCallback(
    (value: string) => {
      setPassword(value);
      clearParseError();
    },
    [clearParseError],
  );

  const updateParam = useCallback((id: string, patch: Partial<UrlParam>) => {
    setParseError(null);
    setParams((current) =>
      current.map((param) =>
        param.id === id ? { ...param, ...patch } : param,
      ),
    );
  }, []);

  const removeParam = useCallback(
    (id: string) => {
      setParseError(null);
      setParams((current) => {
        const next = current.filter((param) => param.id !== id);
        return next.length > 0 ? next : [createParam(nextId())];
      });
    },
    [nextId],
  );

  // Two sub-forms, two error scopes: `parseError` is about the Input URL the
  // user typed, `buildResult.error` is about the builder fields below it.
  // Rendering both in the card-level stack made builder errors read as a
  // verdict on the input.
  const builderError = buildResult.error;

  // Deliberately does not include the URL: the builder has username and
  // password fields, so reading the value aloud can disclose a credential, and
  // a long query string makes the announcement unusable.
  // Counts the same parameters the builder actually emits: it keeps an entry
  // with an empty key but a value, so filtering on `key` alone under-reported
  // `?=value` as zero.
  const countedParams = params.filter((p) => p.key || p.value).length;

  const announcement = useAnnouncement(
    output
      ? `URL built for ${hostname || "this host"}, ${countedParams} query parameter${
          countedParams === 1 ? "" : "s"
        }.`
      : "",
    500,
    output,
  );

  return (
    <ToolPage>
      <ToolHeader
        title="URL Parser & Query Builder"
        description="Inspect URL components and edit query parameters interactively"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            {(input || output) && (
              <Button type="button" variant="ghost" onClick={handleFullClear}>
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
          {parseError && (
            <AlertBox variant="error">
              <span>{parseError}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-0">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="url-parser-input" className="mb-0">
                Input URL
              </ToolLabel>
              {output && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setInput(output);
                    setParseError(null);
                  }}
                >
                  Use built URL as input
                </Button>
              )}
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
              id="url-parser-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setParseError(null);
              }}
              rows={3}
              className="font-mono min-h-32"
              spellCheck={false}
              placeholder="https://example.com/search?q=supertools#section"
            />
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-muted/15 p-3">
            {builderError && (
              <AlertBox variant="error">
                <span>{builderError}</span>
              </AlertBox>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                id="url-protocol"
                label="Protocol"
                value={protocol}
                onChange={setProtocolField}
                placeholder="https:"
              />
              <Field
                id="url-hostname"
                label="Hostname"
                value={hostname}
                onChange={setHostnameField}
                placeholder="example.com"
              />
              <Field
                id="url-port"
                label="Port"
                value={port}
                onChange={setPortField}
                placeholder="(default)"
              />
              <Field
                id="url-pathname"
                label="Path"
                value={pathname}
                onChange={setPathnameField}
                placeholder="/search"
              />
              <Field
                id="url-hash"
                label="Fragment (#)"
                value={hash}
                onChange={setHashField}
                placeholder="section"
              />
              <Field
                id="url-username"
                label="Username"
                value={username}
                onChange={setUsernameField}
                placeholder="(optional)"
              />
            </div>

            <div className="max-w-sm">
              <Field
                id="url-password"
                label="Password"
                value={password}
                onChange={setPasswordField}
                placeholder="(optional)"
              />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-muted/15 p-3">
            <div className="mb-2 flex items-center justify-between">
              <ToolMeta>Query Parameters</ToolMeta>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setParseError(null);
                  setParams((current) => [...current, createParam(nextId())]);
                }}
              >
                <FontAwesomeIcon
                  icon={faPlus}
                  className="h-3 w-3"
                  aria-hidden="true"
                />
                Add param
              </Button>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto">
              {params.map((param, index) => (
                <div
                  key={param.id}
                  className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <Input
                    value={param.key}
                    onChange={(e) =>
                      updateParam(param.id, { key: e.target.value })
                    }
                    aria-label={`Query parameter ${index + 1} name`}
                    placeholder="key"
                    className="h-9 font-mono text-[13px]"
                    spellCheck={false}
                  />
                  <Textarea
                    value={param.value}
                    onChange={(e) =>
                      updateParam(param.id, { value: e.target.value })
                    }
                    aria-label={`Query parameter ${index + 1} value`}
                    placeholder="value"
                    rows={1}
                    className="min-h-9 resize-none font-mono text-[13px] field-sizing-content"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParam(param.id)}
                    aria-label={`Remove query parameter ${index + 1}`}
                  >
                    <FontAwesomeIcon
                      icon={faTrash}
                      className="h-3 w-3"
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {output && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <ToolLabel htmlFor="url-parser-output" className="mb-0">
                  Built URL
                </ToolLabel>
                <CopyButton text={output} />
              </div>
              <Textarea
                id="url-parser-output"
                readOnly
                value={output}
                rows={4}
                className="field-sizing-content font-mono min-h-24 max-h-[32rem]"
              />
            </section>
          )}
        </ToolBody>

        {!output && (
          <div className="border-t border-border py-12 text-center">
            <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
              <FontAwesomeIcon
                icon={faLink}
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              URL components appear here as you type
            </p>
          </div>
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Parses standard absolute URLs and rebuilds encoded query strings with
        <code>URL</code> and <code>URLSearchParams</code>. Everything runs
        locally in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <ToolLabel htmlFor={id} className="mb-1.5">
        {label}
      </ToolLabel>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 font-mono text-[13px]"
        spellCheck={false}
      />
    </div>
  );
}
