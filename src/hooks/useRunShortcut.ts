"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Binds ⌘/Ctrl+Enter anywhere on the page; `enabled` should match the action button. */
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

/** Returns null until mount because the platform is unavailable during SSR. */
export function useIsMac(): boolean | null {
  const [isMac, setIsMac] = useState<boolean | null>(null);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform ?? ""));
  }, []);
  return isMac;
}

/**
 * Focuses a manual tool's result after it renders. Attach `ref` to the result
 * for the current mode, and request focus only after a successful action.
 * In RSA verify mode, the signature field is an input; the verdict is the result.
 */
export function useFocusResult<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const pending = useRef(false);

  // Run after every render: a repeated result may have the same value, and the
  // request remains pending until its target exists.
  useEffect(() => {
    if (!pending.current) return;
    const el = ref.current;
    if (!el) return;
    pending.current = false;
    el.focus();
  });

  const request = useCallback(() => {
    pending.current = true;
  }, []);

  return [ref, request] as const;
}
