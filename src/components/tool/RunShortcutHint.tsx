"use client";

import { useIsMac } from "@/hooks/useRunShortcut";

/**
 * The ⌘↵ / Ctrl↵ badge inside a manual tool's action button.
 *
 * An accelerator nobody can discover is not an accelerator — `diff` had the
 * binding for months with nothing on screen to reveal it. Rendered muted so it
 * labels the button without competing with the verb.
 *
 * Renders nothing until the platform is known, so the button does not flip
 * between ⌘ and Ctrl after hydration.
 */
export function RunShortcutHint() {
  const isMac = useIsMac();
  if (isMac === null) return null;

  return (
    // A <span>, not a <kbd>: the button already carries aria-keyshortcuts, so
    // this is decoration and must stay out of the accessibility tree — and
    // aria-hidden on a <kbd> trips biome's focusable-element rules.
    <span
      aria-hidden="true"
      className="ml-1 rounded border border-current/25 px-1 py-px font-sans text-[10px] leading-none opacity-70"
    >
      {isMac ? "⌘" : "Ctrl"}↵
    </span>
  );
}
