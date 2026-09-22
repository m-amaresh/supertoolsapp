"use client";

import { useIsMac } from "@/hooks/useRunShortcut";

/** Shows the platform-specific shortcut after mount. */
export function RunShortcutHint() {
  const isMac = useIsMac();
  if (isMac === null) return null;

  return (
    // The button carries aria-keyshortcuts; this span is decorative. A hidden
    // <kbd> triggers Biome's focusable-element rule.
    <span
      aria-hidden="true"
      className="ml-1 rounded border border-current/25 px-1 py-px font-sans text-[10px] leading-none opacity-70"
    >
      {isMac ? "⌘" : "Ctrl"}↵
    </span>
  );
}
