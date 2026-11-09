"use client";

import { useId, useSyncExternalStore } from "react";
import {
  getConsentStatus,
  getServerConsentStatus,
  openConsentPreferences,
  subscribeConsentStatus,
} from "@/lib/analytics-consent";

/** Shared state and fallback for footer, privacy page and preferences page. */
export function CookiePreferencesButton({ className }: { className?: string }) {
  const status = useSyncExternalStore(
    subscribeConsentStatus,
    getConsentStatus,
    getServerConsentStatus,
  );
  const messageId = useId();
  // A failed save leaves the manager usable; only loading/failure disable it.
  const usable = status === "ready" || status === "unsaved";
  const message =
    status === "unavailable"
      ? "Preferences unavailable. Reload to try again. To reset a saved choice, clear this site’s data in your browser settings."
      : status === "unsaved"
        ? "Your choice to turn off analytics cookies could not be saved in this browser. It applies until this tab is reloaded or closed. To withdraw consent permanently, clear this site’s data in your browser settings."
        : null;
  return (
    <span>
      <button
        type="button"
        aria-disabled={!usable}
        aria-busy={status === "loading"}
        aria-describedby={message ? messageId : undefined}
        className={`${className ?? ""} inline-flex min-h-6 items-center text-left text-[13px] text-muted-foreground transition-colors hover:text-foreground aria-disabled:opacity-50 aria-disabled:cursor-not-allowed`}
        onClick={(event) => {
          if (usable) openConsentPreferences(event.currentTarget);
        }}
      >
        Cookie preferences
      </button>
      {message ? (
        <span
          id={messageId}
          role="status"
          className="mt-2 block text-sm text-muted-foreground"
        >
          {message}
        </span>
      ) : null}
      <noscript>
        <span className="block text-sm normal-case tracking-normal">
          Enable JavaScript to change preferences, or clear this site’s data in
          your browser settings.
        </span>
      </noscript>
    </span>
  );
}
