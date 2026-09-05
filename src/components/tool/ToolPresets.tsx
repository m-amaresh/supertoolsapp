"use client";

import { faChevronDown } from "@fortawesome/free-solid-svg-icons/faChevronDown";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

interface ToolPresetsProps extends React.PropsWithChildren {
  /** Shown on the toggle, e.g. "Common Patterns". */
  label: string;
  /** Number of presets inside, shown so the toggle says what it hides. */
  count: number;
  className?: string;
}

/**
 * A collapsed row of preset chips.
 *
 * Presets are a first-visit affordance, but rendered as a permanent row they
 * cost vertical space on every visit — and on regex, cron and cidr they sat
 * *between* the two fields the user works in together. Collapsing them keeps
 * the discoverability and returns the space.
 *
 * Starts closed. The chips stay in the DOM via `hidden` rather than being
 * unmounted, so the browser's find-in-page still reaches them.
 */
export function ToolPresets({
  label,
  count,
  className,
  children,
}: ToolPresetsProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex min-h-6 items-center gap-1.5 rounded-md text-[13px] font-semibold tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {label}
        <span className="font-normal opacity-70">({count})</span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={cn(
            "h-2.5 w-2.5 transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      <div id={panelId} hidden={!open} className="mt-2 flex flex-wrap gap-1.5">
        {children}
      </div>
    </div>
  );
}
