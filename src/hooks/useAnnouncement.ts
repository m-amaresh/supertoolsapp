"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Announce a result in response to an explicit action.
 *
 * Screen readers only speak a live region when its text actually changes, so
 * generating five UUIDs twice in a row would announce once and then fall
 * silent — exactly the repeat case generators exist for. Alternating an
 * invisible zero-width space keeps consecutive identical results distinct in
 * the DOM without changing what is read aloud.
 */
export function useAnnouncer(): [string, (text: string) => void] {
  const [message, setMessage] = useState("");
  const alternate = useRef(false);

  const announce = useCallback((text: string) => {
    if (!text) {
      setMessage("");
      return;
    }
    alternate.current = !alternate.current;
    setMessage(alternate.current ? `${text}\u200B` : text);
  }, []);

  return [message, announce];
}

/**
 * Delays a `ToolLiveRegion` message so a live tool announces its result once
 * the user stops typing, rather than after every keystroke.
 *
 * Manual tools do not need this — their result changes only on a button press,
 * so they can pass their message straight to `ToolLiveRegion`.
 */
export function useAnnouncement(
  message: string,
  delayMs = 500,
  /**
   * Anything that identifies *this particular result*. Pass the output itself
   * (or a hash of it) whenever the summary describes only the shape of the
   * result — "4 characters", "5 digests" — otherwise two different results
   * produce identical text, the DOM never mutates, and nothing is announced.
   */
  token: unknown = undefined,
): string {
  const [announced, setAnnounced] = useState("");
  const alternate = useRef(false);
  const lastToken = useRef<unknown>(undefined);

  useEffect(() => {
    // Clear immediately so a stale result is never left announced while the
    // next one is still being computed.
    if (!message) {
      setAnnounced("");
      lastToken.current = undefined;
      return;
    }
    const timer = setTimeout(() => {
      // A screen reader only speaks a live region whose text actually changed.
      // When the result changed but its summary did not, flip an invisible
      // zero-width space so the text differs without altering what is read.
      const changed = token !== undefined && token !== lastToken.current;
      lastToken.current = token;
      setAnnounced((current) => {
        const base = message;
        if (!changed) return base;
        alternate.current = !alternate.current;
        const next = alternate.current ? `${base}\u200B` : base;
        return next === current ? `${base}\u200B\u200B` : next;
      });
    }, delayMs);
    return () => clearTimeout(timer);
  }, [message, delayMs, token]);

  return announced;
}
