/**
 * Google Analytics 4 and cookie consent, in one place.
 *
 * Everything here is framework- and DOM-independent so it can be unit tested.
 * The components that use it are thin.
 *
 * The site runs Consent Mode v2 with everything defaulted to **denied**:
 * `gtag.js` loads on every page, but it is told up front that it may not use
 * storage, and only a deliberate acceptance in the banner lifts that. Nothing
 * is written to the visitor's device until then.
 */

/**
 * GA4 measurement ID, inlined at build time.
 *
 * Unset means no analytics at all — no gtag, no banner, and no CSP relaxation.
 * That is the default for local development and for anyone running their own
 * copy, so a fork does not silently report to this project's property.
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

/** GA4 IDs look like `G-XXXXXXXXXX`. A stream ID or a UA- tag is not one. */
export function isValidMeasurementId(id: string): boolean {
  return /^G-[A-Z0-9]{6,}$/.test(id.trim());
}

/**
 * Whether analytics should run in this build.
 *
 * Deliberately strict about the format: a mistyped ID would otherwise load
 * gtag.js, relax the CSP and show a cookie banner while reporting to nothing.
 */
export function isAnalyticsConfigured(id: string = GA_MEASUREMENT_ID): boolean {
  return isValidMeasurementId(id);
}

/**
 * Consent Mode v2 signals, all denied except the two that cannot carry
 * tracking: `security_storage` (CSRF and abuse prevention) and
 * `functionality_storage`, which here is only the theme preference.
 *
 * `wait_for_update` holds GA's first hit briefly so a returning visitor whose
 * stored choice is "granted" is not measured as denied before the banner has
 * had a chance to restore it.
 */
export const CONSENT_DEFAULTS: Readonly<Record<string, string | number>> = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  personalization_storage: "denied",
  functionality_storage: "granted",
  security_storage: "granted",
  wait_for_update: 500,
};

/** The gtag signal the banner's analytics toggle controls. */
export const ANALYTICS_CONSENT_SIGNAL = "analytics_storage";

/** Where the visitor's choice is kept. Namespaced so it is recognisable. */
export const CONSENT_NAMESPACE = "supertools_consent";

/**
 * The inline script that must run *before* gtag.js.
 *
 * gtag.js replays whatever is already queued on `dataLayer`, so the defaults
 * have to be pushed first. Loading the library first and calling `consent
 * default` afterwards is the classic way to leak a measured hit from someone
 * who never agreed to be measured.
 */
export function buildConsentBootstrap(id: string): string {
  const defaults = JSON.stringify(CONSENT_DEFAULTS);
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    `gtag('consent','default',${defaults});`,
    "gtag('js',new Date());",
    // No `anonymize_ip`: that is a Universal Analytics setting. GA4 ignores it
    // and drops the IP unconditionally after deriving coarse geography, so
    // passing it anonymises nothing and lands on every hit as a meaningless
    // custom event parameter (`ep.anonymize_ip=true`, visible on the wire).
    `gtag('config','${id}');`,
  ].join("");
}

/** Source URL for the GA library. */
export function gtagScriptUrl(id: string): string {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
}

/**
 * Hosts GA needs, and the only reason the site's CSP names anything external.
 *
 * Kept here rather than in next.config.ts so the policy and the code that
 * depends on it cannot drift apart, and so the relaxation can be switched off
 * entirely when no measurement ID is configured.
 */
export const GA_SCRIPT_HOSTS = ["https://www.googletagmanager.com"] as const;

export const GA_CONNECT_HOSTS = [
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://*.googletagmanager.com",
] as const;

export const GA_IMG_HOSTS = [
  "https://*.google-analytics.com",
  "https://www.googletagmanager.com",
] as const;
