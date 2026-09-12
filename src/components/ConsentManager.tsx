"use client";

import Script from "next/script";
import { useCallback } from "react";
import {
  ANALYTICS_CONSENT_SIGNAL,
  buildConsentBootstrap,
  CONSENT_NAMESPACE,
  gtagScriptUrl,
} from "@/lib/analytics";

/** The slice of the vendored banner's API this file uses. */
interface SilktideConsentManager {
  init: (config: Record<string, unknown>) => void;
  getInstance: () => { toggleModal: (show: boolean) => void } | null;
}

declare global {
  interface Window {
    silktideConsentManager?: SilktideConsentManager;
  }
}

/** Opens the preferences dialog. Exported for the footer link. */
export function openCookiePreferences(): void {
  window.silktideConsentManager?.getInstance()?.toggleModal(true);
}

interface ConsentManagerProps {
  /** A validated GA4 measurement ID. The caller decides whether to render. */
  measurementId: string;
}

/**
 * Google Analytics behind a Consent Mode v2 banner.
 *
 * Script order is the whole correctness story here:
 *
 * 1. `beforeInteractive` — declare `dataLayer`, define `gtag`, and set every
 *    consent signal to denied. gtag.js replays whatever is already queued, so
 *    this has to be on the queue before the library arrives.
 * 2. `afterInteractive` — gtag.js itself, which starts up already denied.
 * 3. `afterInteractive` — the banner, which flips `analytics_storage` to
 *    granted only if the visitor says so.
 *
 * The banner is served from this origin rather than from jsDelivr so that
 * `script-src` keeps naming Google and nothing else.
 */
export function ConsentManager({ measurementId }: ConsentManagerProps) {
  const initBanner = useCallback(() => {
    window.silktideConsentManager?.init({
      namespace: CONSENT_NAMESPACE,
      // The stock copy claims the site provides "personalized content", which
      // it does not do and has no way to do. Consent text has to describe what
      // actually happens, so all of it is replaced.
      text: {
        prompt: {
          description:
            "<p>This site stores nothing on your device unless you allow it. Analytics cookies tell us which tools people use — they never see what you put <em>into</em> a tool. That is processed in your browser and is not sent anywhere either way.</p>",
          acceptAllButtonText: "Accept",
          rejectNonEssentialButtonText: "Reject",
          preferencesButtonText: "Preferences",
          acceptAllButtonAccessibleLabel: "Accept analytics cookies",
          rejectNonEssentialButtonAccessibleLabel:
            "Reject non-essential cookies",
          preferencesButtonAccessibleLabel: "Change cookie preferences",
        },
        preferences: {
          title: "Cookie preferences",
          description:
            "<p>Your choice is stored on this device and you can change it at any time from the footer of any page.</p>",
          saveButtonText: "Save",
          saveButtonAccessibleLabel: "Save cookie preferences",
          // The stock text is "Get this consent manager for free", which reads
          // as an ad inside our own dialog. Credit the project instead.
          creditLinkText: "Consent manager by Silktide",
          creditLinkAccessibleLabel:
            "Silktide Consent Manager, the open-source banner this site uses",
        },
      },
      // The floating cookie icon is suppressed in globals.css, not here: the
      // banner creates it unconditionally and shows it with an inline style,
      // so there is no config that prevents it. The footer's "Cookie
      // preferences" link replaces it.
      consentTypes: [
        {
          id: "necessary",
          label: "Strictly necessary",
          description:
            "Remembers your theme choice and this consent decision. Stored on your device only, and never sent anywhere.",
          required: true,
        },
        {
          id: "analytics",
          label: "Analytics",
          description:
            "Google Analytics, used to count visits and see which tools get used. Off unless you turn it on. Your tool input — text, files, keys, passwords — is never part of this; it never leaves your browser at all.",
          // Silktide maps this straight onto gtag('consent','update',…).
          gtag: ANALYTICS_CONSENT_SIGNAL,
          defaultValue: false,
        },
      ],
    });
  }, []);

  return (
    <>
      {/* `precedence` is React 19's stylesheet API: it hoists this into
          <head> and de-duplicates it across renders. */}
      <link
        rel="stylesheet"
        href="/consent/silktide-consent-manager.css"
        precedence="default"
      />

      <Script id="ga-consent-default" strategy="beforeInteractive">
        {buildConsentBootstrap(measurementId)}
      </Script>

      <Script src={gtagScriptUrl(measurementId)} strategy="afterInteractive" />

      <Script
        src="/consent/silktide-consent-manager.js"
        strategy="afterInteractive"
        onReady={initBanner}
      />
    </>
  );
}
