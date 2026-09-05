"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Wraps the Clipboard API with transient "copied" / "pasteError" states
// that auto-reset after a timeout, so callers get feedback without managing timers.
export function useClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false);
  const [pasteError, setPasteError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pasteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => setCopied(false), timeout);
        return true;
      } catch {
        return false;
      }
    },
    [timeout],
  );

  const readText = useCallback(async (): Promise<string | null> => {
    try {
      const text = await navigator.clipboard.readText();
      setPasteError(false);
      return text;
    } catch {
      setPasteError(true);
      if (pasteTimerRef.current) clearTimeout(pasteTimerRef.current);
      pasteTimerRef.current = setTimeout(() => setPasteError(false), 4000);
      return null;
    }
  }, []);

  return { copied, copy, readText, pasteError };
}
