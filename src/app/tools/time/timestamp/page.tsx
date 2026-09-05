"use client";

import { faClock } from "@fortawesome/free-solid-svg-icons/faClock";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import { ToolbarGroup, ToolbarSelect } from "@/components/Toolbar";
import { ToolPresets } from "@/components/tool/ToolPresets";
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
import {
  commonTimezones,
  formatTimestamp,
  getCurrentTimestamp,
  parseTimestamp,
  type TimestampFormats,
} from "@/lib/timestamp";

export default function TimestampConverter() {
  const { readText, pasteError } = useClipboard();
  const [{ input, error }, { setInput, setError }] = useToolState();

  const [timezone, setTimezone] = useState("UTC");
  const [localTimezone, setLocalTimezone] = useState("UTC");
  const [formats, setFormats] = useState<TimestampFormats | null>(null);

  const announcement = useAnnouncement(
    formats ? `Timestamp parsed. ${formats.iso8601}.` : "",
    500,
    formats?.iso8601,
  );
  const [mounted, setMounted] = useState(false);
  const [liveTime, setLiveTime] = useState<Date>(new Date());

  useEffect(() => {
    setMounted(true);
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected) setLocalTimezone(detected);
    const interval = setInterval(() => {
      setLiveTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const processInput = useCallback(
    (text: string, tz: string) => {
      setError(null);
      setFormats(null);

      if (!text.trim()) return;

      const date = parseTimestamp(text);
      if (!date) {
        setError(
          "Could not parse timestamp. Try Unix timestamp, ISO 8601, or other standard formats.",
        );
        return;
      }

      setFormats(formatTimestamp(date, tz));
    },
    [setError],
  );

  useEffect(() => {
    processInput(input, timezone);
  }, [input, timezone, processInput]);

  const handleUseNow = useCallback(() => {
    const now = getCurrentTimestamp();
    setInput(Math.floor(now.getTime() / 1000).toString());
  }, [setInput]);

  const handleClear = useCallback(() => {
    setInput("");
    setFormats(null);
    setError(null);
  }, [setError, setInput]);

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setInput(text);
  }, [readText, setInput]);

  const handleUseLocalTimezone = useCallback(() => {
    setTimezone(localTimezone);
  }, [localTimezone]);

  const quickTimezones = useMemo(
    () =>
      [
        "UTC",
        localTimezone,
        "America/New_York",
        "Europe/London",
        "Asia/Kolkata",
        "Asia/Tokyo",
      ].filter((value, index, values) => values.indexOf(value) === index),
    [localTimezone],
  );

  const timezoneLabel =
    commonTimezones.find((zone) => zone.value === timezone)?.label ?? timezone;
  const liveFormats = mounted ? formatTimestamp(liveTime, timezone) : null;

  return (
    <ToolPage>
      <ToolHeader
        title="Timestamp Converter"
        description="Convert between Unix timestamps and human-readable dates"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2">
            {/* Ghost, not the default filled variant: timestamp is a live
                tool, so nothing here should read as the primary action. This
                fills the input rather than computing anything. */}
            <Button type="button" variant="ghost" onClick={handleUseNow}>
              <FontAwesomeIcon
                icon={faClock}
                className="h-3 w-3"
                aria-hidden="true"
              />
              Use current time
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {(input || formats) && (
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
          <ToolbarGroup label="Timezone" htmlFor="timestamp-timezone">
            <ToolbarSelect
              id="timestamp-timezone"
              value={timezone}
              onChange={setTimezone}
              options={commonTimezones}
              className="min-w-[180px]"
            />
          </ToolbarGroup>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUseLocalTimezone}
            disabled={timezone === localTimezone}
          >
            Use local ({localTimezone})
          </Button>
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

        <ToolBody className="space-y-4 pt-3">
          <ToolPresets label="Quick Zones" count={quickTimezones.length}>
            {quickTimezones.map((zone) => (
              <Button
                key={zone}
                type="button"
                size="sm"
                variant={timezone === zone ? "default" : "secondary"}
                onClick={() => setTimezone(zone)}
              >
                {zone}
              </Button>
            ))}
          </ToolPresets>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <ToolMeta>Current Time</ToolMeta>
              <div className="flex items-center gap-1.5">
                <span className="bg-success h-2 w-2 animate-pulse rounded-full" />
                <span className="text-[12px] text-muted-foreground">Live</span>
              </div>
            </div>
            <p className="mb-3 text-[13px] text-muted-foreground">
              Display timezone:{" "}
              <span className="font-medium">{timezoneLabel}</span>
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <span className="text-[12px] uppercase tracking-[0.06em] text-muted-foreground">
                  Unix
                </span>
                <p className="font-mono text-[14px] tabular-nums text-foreground">
                  {liveFormats?.unix ?? "---"}
                </p>
              </div>
              <div>
                <span className="text-[12px] uppercase tracking-[0.06em] text-muted-foreground">
                  ISO 8601
                </span>
                <p className="truncate font-mono text-[14px] text-foreground">
                  {liveFormats?.iso8601 ?? "---"}
                </p>
              </div>
              <div>
                <span className="text-[12px] uppercase tracking-[0.06em] text-muted-foreground">
                  Local
                </span>
                <p className="font-mono text-[14px] text-foreground">
                  {liveFormats?.local ?? "---"}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <ToolLabel htmlFor="timestamp-input">
              Enter timestamp or date
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
          <Input
            id="timestamp-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="1704067200"
            aria-label="Timestamp or date input"
            className="font-mono"
            aria-describedby="timestamp-format-hint"
          />
          <ToolHint id="timestamp-format-hint">
            Accepts Unix seconds or milliseconds, and ISO 8601 dates — for
            example 1704067200, 2024-01-01, or 2024-01-01T00:00:00Z.
          </ToolHint>
        </ToolBody>

        {formats ? (
          <div className="px-4 pb-4">
            <div className="divide-y divide-border rounded-lg border border-border bg-muted/40">
              <FormatRow
                label="Unix (seconds)"
                value={formats.unix.toString()}
              />
              <FormatRow
                label="Unix (milliseconds)"
                value={formats.unixMs.toString()}
              />
              <FormatRow label="ISO 8601" value={formats.iso8601} />
              <FormatRow label="UTC" value={formats.utc} />
              <FormatRow label="Local" value={formats.local} />
              <FormatRow label="Relative" value={formats.relative} />
            </div>
          </div>
        ) : (
          <div className="border-t border-border py-12 text-center">
            <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
              <FontAwesomeIcon
                icon={faClock}
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p className="text-[13px] text-muted-foreground">
              Converted formats appear here as you type
            </p>
          </div>
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Supports Unix timestamps (seconds/milliseconds), ISO 8601, and most
        standard date formats.
      </ToolFootnote>
    </ToolPage>
  );
}

function FormatRow({ label, value }: { label: string; value: string }) {
  return (
    // Wraps and lets the value break: `2024-01-01T00:00:00.000Z` plus its
    // label and Copy button is wider than a 375px card on one line.
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2.5">
      <ToolMeta className="w-24 shrink-0 leading-tight">{label}</ToolMeta>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="min-w-0 break-all font-mono text-[14px] text-foreground">
          {value}
        </span>
        <CopyButton text={value} className="h-7 shrink-0 px-2 text-[12px]" />
      </div>
    </div>
  );
}
