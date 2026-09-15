"use client";

import { useId, useSyncExternalStore } from "react";
import {
  getConsentStatus,
  getServerConsentStatus,
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
  return (
    <span>
      <button
        type="button"
        aria-disabled={status !== "ready"}
        aria-busy={status === "loading"}
        aria-describedby={status === "unavailable" ? messageId : undefined}
        className={`${className ?? ""} inline-flex min-h-6 items-center text-left text-[13px] text-muted-foreground transition-colors hover:text-foreground aria-disabled:opacity-50 aria-disabled:cursor-not-allowed`}
        onClick={() => {
          if (status === "ready")
            window.silktideConsentManager?.getInstance()?.toggleModal(true);
        }}
      >
        Cookie preferences
      </button>
      {status === "unavailable" ? (
        <span
          id={messageId}
          role="status"
          className="mt-2 block text-sm text-muted-foreground"
        >
          Preferences unavailable. Reload to try again. To reset a saved choice,
          clear this site’s data in your browser settings.
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
