import Script from "next/script";
import { buildConsentBootstrap, gtagScriptUrl } from "@/lib/analytics";

/** Establish consent synchronously before loading Google for measurement. */
export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      {/*
       * Keep this as a raw inline script. The consent defaults must execute
       * before gtag.js, and Next's `beforeInteractive` does not place an
       * inline tag at this exact point: it queues a source for Next's own
       * bootstrap to evaluate. That can let gtag.js run before these defaults.
       * The raw script is parsed synchronously; the external tag remains
       * `afterInteractive` so it cannot overtake the defaults.
       */}
      <script
        id="ga-consent-default"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: fixed bootstrap with a validated measurement ID
        dangerouslySetInnerHTML={{
          __html: buildConsentBootstrap(measurementId),
        }}
      />
      <Script src={gtagScriptUrl(measurementId)} strategy="afterInteractive" />
    </>
  );
}
