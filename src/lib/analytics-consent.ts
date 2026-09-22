/**
 * Browser-side consent helpers and the constants that name the stored choice.
 *
 * These keys deliberately live here rather than in `analytics.ts`. `ConsentManager`
 * is a client component, so anything it imports is pulled into the client bundle —
 * and `analytics.ts` reads `VERCEL_ENV`, which only exists on the server. Keeping
 * this module as the one thing the banner imports is what keeps `analytics.ts`
 * server-only, so that read cannot silently evaluate to `undefined` in a browser.
 *
 * Import direction is therefore one-way: `analytics.ts` may import from here,
 * never the reverse.
 */

export const CONSENT_NAMESPACE = "supertools_consent";

/**
 * Silktide derives both keys from the namespace: `stcm.<ns>.consent.<typeId>`
 * and `stcm.<ns>.hasConsented`. The analytics type ID in `ConsentManager` must
 * stay "analytics" for these to line up.
 */
export const ANALYTICS_CONSENT_KEY = `stcm.${CONSENT_NAMESPACE}.consent.analytics`;
export const HAS_CONSENTED_KEY = `stcm.${CONSENT_NAMESPACE}.hasConsented`;

export const ANALYTICS_CONSENT_SIGNAL = "analytics_storage";

export function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(ANALYTICS_CONSENT_KEY) === "true";
  } catch {
    return false;
  }
}

/** Remove GA cookies at the host and parent-domain scopes used by gtag.js. */
export function clearAnalyticsCookies(): void {
  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.trim().split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));
  const parts = window.location.hostname.split(".");
  const domains = ["", ...parts.map((_, i) => parts.slice(i).join("."))];

  for (const name of names) {
    for (const domain of domains) {
      // biome-ignore lint/suspicious/noDocumentCookie: synchronous deletion with explicit domain scopes, including browsers without Cookie Store API
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

/** Synchronize storage permission without stopping cookieless measurement. */
export function syncAnalyticsConsent(): void {
  const granted = hasAnalyticsConsent();
  window.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
  });
  if (!granted) clearAnalyticsCookies();
  const instance = window.silktideConsentManager?.getInstance();
  if (!instance) return;
  instance.updateCheckboxState(false);
  if (instance.getHasConsented()) {
    instance.removeBanner();
  } else if (!document.getElementById("stcm-banner")) {
    // Reinitialization restores the prompt and its listeners after storage
    // clearing. Ordinary answers preserve any open preferences modal.
    window.silktideConsentManager?.update({});
  }
}

export type ConsentStatus = "loading" | "ready" | "unavailable";
let consentStatus: ConsentStatus = "loading";
const statusListeners = new Set<() => void>();
export const getConsentStatus = () => consentStatus;
export const getServerConsentStatus = (): ConsentStatus => "loading";
export function subscribeConsentStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}
export function setConsentStatus(status: ConsentStatus): void {
  consentStatus = status;
  for (const listener of statusListeners) listener();
}
