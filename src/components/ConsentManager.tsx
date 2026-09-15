"use client";

import Script from "next/script";
import { useCallback, useEffect } from "react";
import {
  ANALYTICS_CONSENT_KEY,
  ANALYTICS_CONSENT_SIGNAL,
  CONSENT_NAMESPACE,
  clearAnalyticsCookies,
  getConsentStatus,
  HAS_CONSENTED_KEY,
  hasAnalyticsConsent,
  setConsentStatus,
  syncAnalyticsConsent,
} from "@/lib/analytics-consent";

/*
 * Silktide Consent Manager v2.0, vendored into `public/consent/` rather than
 * pulled from a CDN, so the banner needs only the site's own origin in CSP and
 * makes no third-party request before the visitor has chosen. To update,
 * replace both files from https://github.com/silktide/consent-manager.
 */
const SCRIPT_SRC = "/consent/silktide-consent-manager.js";
const STYLESHEET_HREF = "/consent/silktide-consent-manager.css";

/**
 * Collect the visitor's choice and synchronize consent across browser tabs.
 *
 * The library calls `gtag('consent', 'update', …)` itself from the `gtag` keys
 * below, and replays the stored choice on every load. The analytics type ID
 * must stay in step with the keys derived in `analytics-consent.ts`.
 * Google loads independently; this manager controls analytics cookies.
 *
 * There is no marketing consent type because the site runs no advertising —
 * the ad signals stay denied in the bootstrap and are never offered.
 */
export function ConsentManager() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.storageArea === window.localStorage &&
        (event.key === ANALYTICS_CONSENT_KEY ||
          event.key === HAS_CONSENTED_KEY ||
          event.key === null)
      ) {
        syncAnalyticsConsent();
      }
    };
    // Reconcile a resumed tab without resetting an unchanged, unsaved toggle.
    let consentWhenHidden = hasAnalyticsConsent();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        consentWhenHidden = hasAnalyticsConsent();
      } else if (hasAnalyticsConsent() !== consentWhenHidden) {
        syncAnalyticsConsent();
      }
    };
    const timeout = window.setTimeout(() => {
      if (getConsentStatus() === "loading") setConsentStatus("unavailable");
    }, 10000);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  const init = useCallback(() => {
    if (!window.silktideConsentManager) {
      setConsentStatus("unavailable");
      return;
    }
    try {
      window.silktideConsentManager.init({
        namespace: CONSENT_NAMESPACE,
        consentTypes: [
          {
            id: "necessary",
            label: "Essential",
            description:
              "Remembers your theme and privacy preferences in this browser.",
            required: true,
          },
          {
            id: "analytics",
            label: "Analytics cookies",
            description:
              "Allow Google Analytics cookies to recognise returning visits and understand journeys between pages. Without these cookies, Google still receives limited page-view and engagement measurements.",
            defaultValue: false,
            gtag: ANALYTICS_CONSENT_SIGNAL,
            onReject: clearAnalyticsCookies,
          },
        ],
        prompt: { position: "bottomRight" },
        backdrop: { show: false },
        text: {
          prompt: {
            description:
              'Vercel measures visits and performance without cookies. Google also receives limited measurements without cookies. Allow analytics cookies for more detailed visit statistics? <a href="/privacy">Privacy policy</a>',
            acceptAllButtonText: "Allow analytics cookies",
            acceptAllButtonAccessibleLabel: "Accept analytics cookies",
            rejectNonEssentialButtonAccessibleLabel:
              "Reject non-essential cookies",
            rejectNonEssentialButtonText: "Decline",
            preferencesButtonText: "Choose what to allow",
          },
          preferences: {
            title: "Cookie preferences",
            description:
              "Analytics cookies are off until you allow them. Google’s limited cookieless measurement and Vercel measurement continue whatever you choose. We store your preference in this browser; you can change it any time from the footer.",
            saveButtonText: "Save preferences",
            saveButtonAccessibleLabel: "Save cookie preferences",
            creditLinkText: "Consent manager by Silktide",
          },
        },
      });
      // Also clean up cookies left by an earlier version or a cleared preference.
      if (!hasAnalyticsConsent()) clearAnalyticsCookies();
      setConsentStatus("ready");
    } catch {
      setConsentStatus("unavailable");
    }
  }, []);

  return (
    <>
      {/* `precedence` is what gets React to hoist this into <head>. */}
      <link rel="stylesheet" href={STYLESHEET_HREF} precedence="default" />
      <Script
        id="silktide-consent"
        strategy="afterInteractive"
        src={SCRIPT_SRC}
        onReady={init}
        onError={() => setConsentStatus("unavailable")}
      />
    </>
  );
}
