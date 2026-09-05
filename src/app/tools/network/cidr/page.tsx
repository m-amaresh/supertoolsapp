"use client";

import { faNetworkWired } from "@fortawesome/free-solid-svg-icons/faNetworkWired";
import { faPaste } from "@fortawesome/free-solid-svg-icons/faPaste";
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus";
import { faTrash } from "@fortawesome/free-solid-svg-icons/faTrash";
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useMemo, useState } from "react";
import { AlertBox } from "@/components/AlertBox";
import { CopyButton } from "@/components/CopyButton";
import { SegmentedControl, ToolbarGroup } from "@/components/Toolbar";
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
import {
  type AllocatedSubnet,
  type CidrInfo,
  parseCidr,
  type SubnetRequest,
  splitCidr,
  type VlsmResult,
} from "@/lib/cidr";

type Mode = "info" | "split";

const presets = [
  { label: "10.0.0.0/8", value: "10.0.0.0/8" },
  { label: "172.16.0.0/12", value: "172.16.0.0/12" },
  { label: "192.168.1.0/24", value: "192.168.1.0/24" },
  { label: "100.64.0.0/10", value: "100.64.0.0/10" },
  { label: "2001:db8::/32", value: "2001:db8::/32" },
  { label: "fe80::/10", value: "fe80::/10" },
];

let requestIdCounter = 0;
function makeRequest(prefix: number, name = ""): SubnetRequest {
  requestIdCounter += 1;
  return { id: `sub-${requestIdCounter}`, name, prefix };
}

export default function CidrCalculator() {
  const { readText, pasteError } = useClipboard();
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("info");
  const [requests, setRequests] = useState<SubnetRequest[]>(() => [
    makeRequest(24, "subnet-1"),
    makeRequest(24, "subnet-2"),
  ]);

  const infoResult = useMemo(() => parseCidr(input), [input]);
  const info = infoResult.info;

  const splitResult = useMemo<VlsmResult | null>(
    () =>
      mode === "split" && input.trim() ? splitCidr(input, requests) : null,
    [mode, input, requests],
  );

  const handlePaste = useCallback(async () => {
    const text = await readText();
    if (text !== null) setInput(text.trim());
  }, [readText]);

  const addRequest = useCallback(() => {
    setRequests((prev) => {
      const suggested = suggestNextPrefix(prev);
      return [...prev, makeRequest(suggested, `subnet-${prev.length + 1}`)];
    });
  }, []);

  const removeRequest = useCallback((id: string) => {
    setRequests((prev) => prev.filter((req) => req.id !== id));
  }, []);

  const updateRequest = useCallback(
    (id: string, patch: Partial<Omit<SubnetRequest, "id">>) => {
      setRequests((prev) =>
        prev.map((req) => (req.id === id ? { ...req, ...patch } : req)),
      );
    },
    [],
  );

  const announcement = useAnnouncement(
    mode === "info"
      ? info
        ? `Network parsed. ${info.network}/${info.prefix}, ${info.usableHostCount} usable hosts.`
        : ""
      : splitResult && !splitResult.error
        ? `${splitResult.allocated.length} subnet${splitResult.allocated.length === 1 ? "" : "s"} allocated in ${splitResult.parentCidr}, ${splitResult.remaining.length} free block${splitResult.remaining.length === 1 ? "" : "s"} remaining.`
        : "",
    500,
    mode === "info" ? info : splitResult,
  );

  const copyAllInfo = info ? formatInfoForCopy(info) : "";
  const copyAllSplit = splitResult ? formatSplitForCopy(splitResult) : "";
  const copyTarget = mode === "info" ? copyAllInfo : copyAllSplit;
  const hasCopyable =
    (mode === "info" && info) ||
    (mode === "split" && splitResult && splitResult.allocated.length > 0);

  return (
    <ToolPage>
      <ToolHeader
        title="CIDR / Subnet Calculator"
        description="Analyze a CIDR range or split it into variable-size child subnets (VLSM)"
      />

      <ToolCard>
        <ToolToolbar>
          <div className="flex items-center gap-2"></div>
          <div className="flex items-center gap-2">
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
          <ToolbarGroup label="Mode">
            <SegmentedControl
              value={mode}
              onChange={setMode}
              ariaLabel="CIDR mode"
              options={[
                { value: "info", label: "Info" },
                { value: "split", label: "Split" },
              ]}
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
          {mode === "info" && infoResult.error && (
            <AlertBox variant="error">
              <span>{infoResult.error}</span>
            </AlertBox>
          )}
          {mode === "split" && splitResult?.error && (
            <AlertBox variant="error">
              <span>{splitResult.error}</span>
            </AlertBox>
          )}
        </ToolStatusStack>

        <ToolBody className="pt-4">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <ToolLabel htmlFor="cidr-input">
                {mode === "split" ? "Parent CIDR" : "CIDR or IP Address"}
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
              id="cidr-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="192.168.1.0/24"
              aria-label="CIDR or IP address input"
              className="h-10 text-[14px] font-mono"
              spellCheck={false}
              autoComplete="off"
              aria-describedby="cidr-format-hint"
            />
            <ToolHint id="cidr-format-hint">
              Accepts IPv4 and IPv6 with a prefix length, or a bare address —
              for example 192.168.1.0/24 or 2001:db8::/32.
            </ToolHint>
          </section>

          <ToolPresets label="Common Ranges" count={presets.length}>
            {presets.map((preset) => {
              const isActive = input.trim() === preset.value;
              return (
                <Button
                  key={preset.value}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className={isActive ? "ring-1 ring-ring" : undefined}
                  onClick={() => setInput(preset.value)}
                  aria-pressed={isActive}
                >
                  {preset.label}
                </Button>
              );
            })}
          </ToolPresets>

          {mode === "split" && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <ToolLabel>Required Subnets</ToolLabel>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addRequest}
                >
                  <FontAwesomeIcon
                    icon={faPlus}
                    className="h-3 w-3"
                    aria-hidden="true"
                  />
                  Add subnet
                </Button>
              </div>
              <div className="space-y-2">
                {requests.map((req, index) => (
                  <RequestRow
                    key={req.id}
                    request={req}
                    index={index}
                    onNameChange={(name) => updateRequest(req.id, { name })}
                    onPrefixChange={(prefix) =>
                      updateRequest(req.id, { prefix })
                    }
                    onRemove={
                      requests.length > 1
                        ? () => removeRequest(req.id)
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </ToolBody>

        {mode === "info" && (
          <InfoResult
            copyAll={hasCopyable && copyTarget ? copyTarget : ""}
            info={info}
            hasError={Boolean(infoResult.error)}
          />
        )}
        {mode === "split" && (
          <SplitResult
            copyAll={hasCopyable && copyTarget ? copyTarget : ""}
            result={splitResult}
            hasInput={Boolean(input.trim())}
          />
        )}
        <ToolLiveRegion message={announcement} />
      </ToolCard>

      <ToolFootnote>
        Uses <code className="font-mono">BigInt</code> math for IPv4 (/0–/32)
        and IPv6 (/0–/128). Split mode packs largest-first into the parent and
        decomposes leftover space into valid CIDR blocks. All processing happens
        locally in your browser.
      </ToolFootnote>
    </ToolPage>
  );
}

function RequestRow({
  request,
  index,
  onNameChange,
  onPrefixChange,
  onRemove,
}: {
  request: SubnetRequest;
  index: number;
  onNameChange: (name: string) => void;
  onPrefixChange: (prefix: number) => void;
  onRemove?: () => void;
}) {
  // Cap to the absolute IPv6 maximum (128). Per-version validation happens
  // in splitCidr so the user gets a real error rather than a silent clamp
  // while typing toward an IPv6 parent or correcting a malformed one.
  const ABSOLUTE_MAX_PREFIX = 128;
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
        {index + 1}
      </span>
      <Input
        type="text"
        value={request.name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Name (optional)"
        aria-label={`Subnet ${index + 1} name`}
        className="h-9 flex-1 text-[13px]"
        spellCheck={false}
      />
      <div className="flex items-center gap-1">
        <span className="text-[13px] font-mono text-muted-foreground">/</span>
        <Input
          type="text"
          inputMode="numeric"
          value={Number.isFinite(request.prefix) ? String(request.prefix) : ""}
          onChange={(e) => {
            const next = Number.parseInt(e.target.value, 10);
            if (!Number.isNaN(next)) {
              onPrefixChange(Math.max(0, Math.min(ABSOLUTE_MAX_PREFIX, next)));
            }
          }}
          aria-label={`Subnet ${index + 1} prefix`}
          className="h-9 w-16 text-[13px] font-mono"
          spellCheck={false}
        />
      </div>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove subnet ${index + 1}`}
        >
          <FontAwesomeIcon
            icon={faTrash}
            className="h-3 w-3"
            aria-hidden="true"
          />
        </Button>
      )}
    </div>
  );
}

function InfoResult({
  copyAll,
  info,
  hasError,
}: {
  copyAll: string;
  info: CidrInfo | null;
  hasError: boolean;
}) {
  if (!info) {
    if (hasError) return null;
    return (
      <div className="border-t border-border py-12 text-center">
        <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
          <FontAwesomeIcon
            icon={faNetworkWired}
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <p className="text-[13px] text-muted-foreground">
          Subnet details appear here as you type
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between px-4 py-3">
        <ToolMeta>
          IPv{info.version} · /{info.prefix}
          {info.ipClass ? ` · Class ${info.ipClass}` : ""}
        </ToolMeta>
        <FlagList info={info} />
        {copyAll && <CopyButton text={copyAll} />}
      </div>

      <div className="divide-y divide-border border-t border-border">
        <InfoRow label="Network" value={info.network} />
        {info.broadcast && <InfoRow label="Broadcast" value={info.broadcast} />}
        {info.firstHost && (
          <InfoRow label="First Host" value={info.firstHost} />
        )}
        {info.lastHost && <InfoRow label="Last Host" value={info.lastHost} />}
        <InfoRow
          label="Range"
          value={`${info.rangeStart} – ${info.rangeEnd}`}
        />
        <InfoRow label="Netmask" value={info.netmask} />
        {info.wildcard && <InfoRow label="Wildcard" value={info.wildcard} />}
        <InfoRow label="Total addresses" value={info.totalHostCount} />
        <InfoRow label="Usable hosts" value={info.usableHostCount} />
        <InfoRow label="Hex network" value={info.hexNetwork} />
        <InfoRow label="Binary network" value={info.binaryNetwork} />
      </div>
    </div>
  );
}

function SplitResult({
  copyAll,
  result,
  hasInput,
}: {
  copyAll: string;
  result: VlsmResult | null;
  hasInput: boolean;
}) {
  if (!hasInput || !result) {
    return (
      <div className="border-t border-border py-12 text-center">
        <div className="inline-flex items-center justify-center size-10 mb-3 rounded-lg bg-foreground/[0.07]">
          <FontAwesomeIcon
            icon={faNetworkWired}
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
        </div>
        <p className="text-[13px] text-muted-foreground">
          Enter a parent CIDR and at least one subnet to split
        </p>
      </div>
    );
  }

  if (result.allocated.length === 0 && !result.error) {
    return (
      <div className="border-t border-border py-12 text-center">
        <p className="text-[13px] text-muted-foreground">
          Add a subnet to start allocating
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <ToolMeta>
          Parent {result.parentCidr} · requested {result.requestedTotal} /{" "}
          {result.parentCapacity}
        </ToolMeta>
        {copyAll && <CopyButton text={copyAll} />}
      </div>

      {result.allocated.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          <SubnetHeaderRow label="Allocated" />
          {result.allocated.map((sub) => (
            <SubnetRow key={sub.id ?? sub.cidr} subnet={sub} />
          ))}
        </div>
      )}

      {result.remaining.length > 0 && (
        <div className="divide-y divide-border border-t border-border">
          <SubnetHeaderRow label="Remaining free space" />
          {result.remaining.map((sub) => (
            <SubnetRow key={`free-${sub.cidr}`} subnet={sub} muted />
          ))}
        </div>
      )}
    </div>
  );
}

function SubnetHeaderRow({ label }: { label: string }) {
  return (
    <div className="bg-muted/40 px-4 py-2">
      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function SubnetRow({
  subnet,
  muted = false,
}: {
  subnet: AllocatedSubnet;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 ${
        muted ? "bg-muted/20" : ""
      }`}
    >
      <code className="min-w-[180px] font-mono text-[13px] text-foreground">
        {subnet.cidr}
      </code>
      {subnet.name && (
        <span className="text-[12px] text-muted-foreground">{subnet.name}</span>
      )}
      <span className="flex-1 font-mono text-[12px] text-muted-foreground">
        {subnet.rangeStart} – {subnet.rangeEnd}
      </span>
      <span className="tabular-nums text-[12px] text-muted-foreground">
        {subnet.hostCount} addrs
      </span>
      <CopyButton text={subnet.cidr} />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <ToolMeta className="w-36 shrink-0">{label}</ToolMeta>
      <code className="flex-1 break-all font-mono text-[13px] leading-relaxed text-foreground">
        {value}
      </code>
      <CopyButton text={value} />
    </div>
  );
}

function FlagList({ info }: { info: CidrInfo }) {
  const flags: string[] = [];
  if (info.isPrivate) flags.push("private");
  if (info.isLoopback) flags.push("loopback");
  if (info.isLinkLocal) flags.push("link-local");
  if (info.isMulticast) flags.push("multicast");

  if (flags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <span
          key={flag}
          className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground"
        >
          {flag}
        </span>
      ))}
    </div>
  );
}

function formatInfoForCopy(info: CidrInfo): string {
  const lines: string[] = [
    `Address: ${info.address}/${info.prefix}`,
    `Network: ${info.network}`,
  ];
  if (info.broadcast) lines.push(`Broadcast: ${info.broadcast}`);
  if (info.firstHost) lines.push(`First Host: ${info.firstHost}`);
  if (info.lastHost) lines.push(`Last Host: ${info.lastHost}`);
  lines.push(`Range: ${info.rangeStart} – ${info.rangeEnd}`);
  lines.push(`Netmask: ${info.netmask}`);
  if (info.wildcard) lines.push(`Wildcard: ${info.wildcard}`);
  lines.push(`Total: ${info.totalHostCount}`);
  lines.push(`Usable: ${info.usableHostCount}`);
  return lines.join("\n");
}

// Build the export. When allocation failed, lead with a clear PARTIAL banner
// and include the error message so a pasted plan can never silently look
// complete to a network reviewer.
function formatSplitForCopy(result: VlsmResult): string {
  const lines: string[] = [];
  if (result.error) {
    lines.push("# PARTIAL ALLOCATION — review carefully");
    lines.push(`# Error: ${result.error}`);
    lines.push(
      `# Requested: ${result.requestedTotal} / Capacity: ${result.parentCapacity}`,
    );
    lines.push("");
  }
  if (result.parentCidr) lines.push(`Parent: ${result.parentCidr}`);
  lines.push("");
  lines.push(result.error ? "Allocated (partial):" : "Allocated:");
  for (const sub of result.allocated) {
    const label = sub.name ? ` (${sub.name})` : "";
    lines.push(
      `  ${sub.cidr}${label}  ${sub.rangeStart} - ${sub.rangeEnd}  [${sub.hostCount} addrs]`,
    );
  }
  if (result.remaining.length > 0) {
    lines.push("");
    lines.push("Remaining:");
    for (const sub of result.remaining) {
      lines.push(`  ${sub.cidr}  ${sub.rangeStart} - ${sub.rangeEnd}`);
    }
  }
  return lines.join("\n");
}

// Pick a default prefix for a newly added subnet that's unlikely to overflow:
// same as the largest existing prefix, or one step finer if the list is empty.
function suggestNextPrefix(existing: SubnetRequest[]): number {
  if (existing.length === 0) return 24;
  const biggest = existing.reduce((acc, req) => Math.max(acc, req.prefix), 0);
  return biggest;
}
