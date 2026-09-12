"use client";

import { openCookiePreferences } from "@/components/ConsentManager";

/**
 * Reopens the consent dialog from the footer.
 *
 * A client island so `Footer` itself stays a server component — the rest of
 * that link block is rendered on the server and kept out of the client bundle.
 *
 * Consent that cannot be withdrawn as easily as it was given is not consent,
 * so this sits beside Privacy on all 46 routes rather than behind a floating
 * icon that only appears on some.
 */
export function CookiePreferencesButton() {
  return (
    <button
      type="button"
      onClick={openCookiePreferences}
      className="inline-flex min-h-6 items-center text-left text-[13px] text-muted-foreground transition-colors hover:text-foreground"
    >
      Cookie preferences
    </button>
  );
}
