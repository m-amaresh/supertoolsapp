/**
 * GA4 configuration and the Consent Mode bootstrap. Vercel runs independently.
 *
 * Server- and build-time only. `isAnalyticsConfigured` reads `VERCEL_ENV`, which
 * is not a `NEXT_PUBLIC_` variable and therefore reads as `undefined` in a
 * browser — so importing this module from a client component would make it
 * quietly report "configured" on preview deployments. The constants the banner
 * needs live in `analytics-consent.ts` precisely so it never has to.
 */
import { ANALYTICS_CONSENT_KEY } from "./analytics-consent";

export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";

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
  return (
    process.env.VERCEL_ENV?.trim() !== "preview" && isValidMeasurementId(id)
  );
}

/** Optional storage starts denied until the visitor grants consent. */
export const CONSENT_DEFAULTS: Readonly<Record<string, string>> = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  personalization_storage: "denied",
  functionality_storage: "granted",
  security_storage: "granted",
};

/**
 * The inline script that must run *before* gtag.js.
 *
 * gtag.js replays whatever is already queued on `dataLayer`, so the defaults
 * have to be pushed first. Loading the library first and calling `consent
 * default` afterwards is the classic way to leak a measured hit from someone
 * who never agreed to be measured.
 */
export function buildConsentBootstrap(id: string): string {
  if (!isValidMeasurementId(id)) throw new Error("Invalid GA4 measurement ID");
  const defaults = JSON.stringify(CONSENT_DEFAULTS);
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    `var consentDefaults=${defaults};`,
    `try{if(localStorage.getItem(${JSON.stringify(ANALYTICS_CONSENT_KEY)})==='true')consentDefaults.analytics_storage='granted';}catch(e){}`,
    "gtag('consent','default',consentDefaults);",
    "gtag('js',new Date());",
    // No `anonymize_ip`: that is a Universal Analytics setting. GA4 ignores it
    // and drops the IP unconditionally after deriving coarse geography, so
    // passing it anonymises nothing and lands on every hit as a meaningless
    // custom event parameter (`ep.anonymize_ip=true`, visible on the wire).
    `gtag('config',${JSON.stringify(id.trim())},{allow_google_signals:false,allow_ad_personalization_signals:false});`,
  ].join("");
}

export function gtagScriptUrl(id: string): string {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id.trim())}`;
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
