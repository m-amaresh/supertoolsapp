"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Binds ⌘/Ctrl+Enter to a manual tool's action.
 *
 * Manual tools are the ones where the user finishes typing and then has to
 * reach for a button. Live tools need nothing. `diff` already had this bound to
 * a single textarea; this generalises it and, paired with `RunShortcutHint`,
 * makes it discoverable — previously it worked but nothing said so.
 *
 * Bound on `document`, so it fires wherever focus sits on the page — a tool
 * page is a single tool, so there is no competing action to disambiguate
 * against. Pass `enabled` to match whatever disables the visible button:
 * a shortcut that runs an action the UI shows as unavailable is a bug.
 */
export function useRunShortcut(run: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        run();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [run, enabled]);
}

/**
 * Whether to render the shortcut hint as ⌘ or Ctrl.
 *
 * Resolved after mount: the platform is not knowable during SSR, and rendering
 * one and swapping to the other would hydrate-mismatch.
 */
export function useIsMac(): boolean | null {
  const [isMac, setIsMac] = useState<boolean | null>(null);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform ?? ""));
  }, []);
  return isMac;
}

/**
 * Moves focus to a manual tool's result once it renders.
 *
 * Attach `ref` to whatever *is* the result for the current mode — that is not
 * always one element: RSA's outcome is the signature textarea when signing and
 * the status message when verifying, where the same textarea is an input.
 *
 * **Call the returned request only on the success path.** Requesting it at the
 * top of a handler focuses whichever target happens to exist, so a failed RSA
 * Sign moved focus to the empty signature box instead of leaving the user at
 * the error. The request stands until a target renders, which is only correct
 * when a result is genuinely on its way.
 *
 * After pressing the action button, focus stayed on the button, so the next
 * Tab went back through the toolbar rather than to the result and its Copy.
 * The focus cannot happen in the click handler: the result element does not
 * exist until the state update has rendered, so the action requests it and an
 * effect performs it on the next commit.
 *
 * Only for manual tools — moving focus while someone is typing would be
 * hostile, which is why live tools do not use this.
 */
export function useFocusResult<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const pending = useRef(false);

  // Deliberately no dependency array. Keying this on the result *value* meant
  // it never fired when the value did not change — signing the same input
  // twice produces an identical signature, and a successful Verify changes
  // nothing at all, so focus stayed on the button in both cases. Instead the
  // request stands until the target actually exists, and clears itself on the
  // first successful focus.
  useEffect(() => {
    if (!pending.current) return;
    const el = ref.current;
    if (!el) return;
    pending.current = false;
    el.focus();
  });

  // Stable, so callers can list it in their dependency arrays without
  // re-creating the action on every render.
  const request = useCallback(() => {
    pending.current = true;
  }, []);

  return [ref, request] as const;
}
