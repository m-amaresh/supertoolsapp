"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Forces a live-region change when an explicit action repeats the same result. */
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

/** Debounces live-tool announcements until the user stops typing. */
export function useAnnouncement(
  message: string,
  delayMs = 500,
  /**
   * Identifies the specific result when the spoken summary may stay the same
   * (for example, "5 digests"). A changed token forces a live-region update.
   */
  token: unknown = undefined,
): string {
  const [announced, setAnnounced] = useState("");
  const alternate = useRef(false);
  const lastToken = useRef<unknown>(undefined);

  useEffect(() => {
    // Clear stale announcements while the next result is being computed.
    if (!message) {
      setAnnounced("");
      lastToken.current = undefined;
      return;
    }
    const timer = setTimeout(() => {
      // Vary invisible text so an unchanged summary is spoken again.
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
