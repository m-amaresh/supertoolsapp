import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CONSENT_SIGNAL,
  buildConsentBootstrap,
  CONSENT_DEFAULTS,
  GA_CONNECT_HOSTS,
  GA_SCRIPT_HOSTS,
  gtagScriptUrl,
  isAnalyticsConfigured,
  isValidMeasurementId,
} from "./analytics";

describe("analytics: measurement id", () => {
  it("accepts a GA4 id", () => {
    expect(isValidMeasurementId("G-ABC1234567")).toBe(true);
  });

  it("tolerates surrounding whitespace from an env var", () => {
    expect(isValidMeasurementId("  G-ABC1234567  ")).toBe(true);
  });

  it("rejects a Universal Analytics tag", () => {
    expect(isValidMeasurementId("UA-12345-1")).toBe(false);
  });

  it("rejects a bare stream id", () => {
    expect(isValidMeasurementId("1234567890")).toBe(false);
  });

  it("rejects an empty or unset id", () => {
    expect(isValidMeasurementId("")).toBe(false);
  });

  it("treats a malformed id as not configured", () => {
    // Otherwise a typo loads gtag.js, relaxes the CSP and shows a cookie
    // banner while reporting to nothing at all.
    expect(isAnalyticsConfigured("G-")).toBe(false);
    expect(isAnalyticsConfigured("G-ABC1234567")).toBe(true);
  });
});

describe("analytics: consent mode defaults", () => {
  it("denies every signal that can carry tracking", () => {
    for (const signal of [
      "ad_storage",
      "ad_user_data",
      "ad_personalization",
      "analytics_storage",
      "personalization_storage",
    ]) {
      expect(CONSENT_DEFAULTS[signal], `${signal} must default to denied`).toBe(
        "denied",
      );
    }
  });

  it("grants only the signals that cannot", () => {
    expect(CONSENT_DEFAULTS.security_storage).toBe("granted");
    expect(CONSENT_DEFAULTS.functionality_storage).toBe("granted");
  });

  it("holds the first hit so a stored choice can be restored", () => {
    expect(CONSENT_DEFAULTS.wait_for_update).toBeGreaterThan(0);
  });
});

describe("analytics: bootstrap script", () => {
  const script = buildConsentBootstrap("G-ABC1234567");

  it("declares dataLayer and gtag before using them", () => {
    expect(script.indexOf("window.dataLayer")).toBeLessThan(
      script.indexOf("gtag('consent'"),
    );
  });

  it("sets consent defaults before configuring the property", () => {
    // gtag.js replays whatever is already queued, so a config that lands
    // first is a measured hit from someone who never agreed to be measured.
    expect(script.indexOf("gtag('consent','default'")).toBeLessThan(
      script.indexOf("gtag('config'"),
    );
  });

  it("denies analytics storage in the emitted defaults", () => {
    expect(script).toContain('"analytics_storage":"denied"');
  });

  it("carries the measurement id it was given", () => {
    expect(script).toContain("G-ABC1234567");
  });
});

describe("analytics: external hosts", () => {
  it("points gtag at the measurement id", () => {
    expect(gtagScriptUrl("G-ABC1234567")).toBe(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC1234567",
    );
  });

  it("only ever names Google in script-src", () => {
    // The consent banner is vendored into public/consent/ so that adding it
    // did not also mean trusting a CDN with script execution on every page.
    expect(GA_SCRIPT_HOSTS).toEqual(["https://www.googletagmanager.com"]);
  });

  it("names every host GA beacons to", () => {
    expect(GA_CONNECT_HOSTS).toContain("https://*.google-analytics.com");
    expect(GA_CONNECT_HOSTS).toContain("https://*.analytics.google.com");
  });

  it("controls the signal the banner toggles", () => {
    expect(ANALYTICS_CONSENT_SIGNAL).toBe("analytics_storage");
  });
});
