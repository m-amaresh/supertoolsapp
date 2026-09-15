import type { Metadata } from "next";
import Link from "next/link";
import { CookiePreferencesButton } from "@/components/CookiePreferencesButton";
import { isAnalyticsConfigured } from "@/lib/analytics";
import { getSiteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy — What SuperTools Does With Your Data | SuperTools",
  description:
    "SuperTools processes your text, files, keys, and passwords entirely in your browser. Here is exactly what that means, what is collected, and what is not.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    url: "/privacy",
    title: "Privacy — What SuperTools Does With Your Data",
    description:
      "SuperTools processes your text, files, keys, and passwords entirely in your browser. Here is exactly what that means.",
  },
};

export default function PrivacyPage() {
  const siteUrl = getSiteUrl();

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy",
    url: `${siteUrl}/privacy`,
    description:
      "How SuperTools handles the data you put into its tools: processed locally in the browser, never uploaded.",
    isPartOf: {
      "@type": "WebSite",
      name: "SuperTools",
      url: siteUrl,
    },
  };

  return (
    <div className="p-1 lg:p-2">
      <script type="application/ld+json">{JSON.stringify(schema)}</script>

      <article className="mx-auto w-full max-w-[820px]">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Privacy
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Privacy is how these tools are built, not a promise bolted on
            afterwards. This page explains it in concrete terms, including the
            limits.
          </p>
        </header>

        <div className="glass-panel space-y-5 rounded-xl border border-border p-5 sm:p-6">
          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              The core promise
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              The content you put into a tool is processed by code running in
              your browser. It is not sent to a backend service in order to make
              the tool work. That covers pasted text, uploaded files, JSON, YAML
              and CSV input, tokens, ciphertext, passphrases, generated
              passwords and UUIDs, and PDF files together with the passwords
              used to unlock them.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              What the promise does not mean
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              It does not mean the page makes no network requests at all. Like
              any website, this one serves HTML, JavaScript, CSS, fonts, and
              images, and your browser fetches them from the server. The
              boundary that matters is between serving the application and
              processing your payload — the first happens over the network, the
              second does not.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              Analytics
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Vercel Analytics and Speed Insights record page views and
              performance timings without cookies. Web Analytics uses a
              temporary hash derived from the request to distinguish visitors.
              These services run independently of your Google Analytics cookie
              preference. Tool input is not included in these measurements.
            </p>
            {isAnalyticsConfigured() && (
              <>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  Google Analytics loads before you answer the banner. Before
                  you allow analytics cookies, and when you decline, it sends
                  limited page-view and engagement measurements without reading
                  or writing analytics cookies. Requests can include page URLs,
                  referrers, browser information and temporary values. Google
                  receives your IP address when your browser connects.
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  Allowing analytics cookies lets Google recognise returning
                  visits and connect activity across pages. Google can set _ga
                  and _ga_ followed by the measurement stream ID. These cookies
                  normally expire after two years, subject to browser limits and
                  Google settings. Advertising features are disabled.
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  You can turn Analytics cookies off and save using Cookie
                  preferences below or in the footer. This updates consent in
                  other open tabs on this origin and removes existing GA cookies
                  for this site. Cookieless Google and Vercel measurement
                  continues. It does not reload the page or delete previously
                  collected data.
                </p>
                <div className="mt-2">
                  <CookiePreferencesButton />
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  Analytics does not receive what you put into a tool. Tool
                  input is processed in your browser. Every tool also works if
                  Google's script is blocked.
                </p>
              </>
            )}
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              <Link
                href="/cookies"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                About cookie preferences
              </Link>
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              The PDF password remover
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              This one is worth calling out, because it is the category where
              hosted tools most often claim privacy they do not deliver. Most
              online PDF unlockers upload the document <em>and its password</em>{" "}
              to a server.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1.5 text-[14px] leading-relaxed text-muted-foreground">
              <li>
                Neither the PDF nor the password is ever sent over the network.
              </li>
              <li>
                The file is read in the page, handed to a Web Worker, and
                decrypted there by a WebAssembly build of qpdf.
              </li>
              <li>
                The worker is created per attempt and terminated as soon as it
                answers, releasing the memory holding your file.
              </li>
              <li>
                The result is a blob URL that is revoked when you clear the tool
                or leave the page.
              </li>
              <li>
                The qpdf engine is served from this origin, so no CDN sits in
                the path.
              </li>
            </ul>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              Once the page has loaded, unlocking works with no network
              connection at all — you can disconnect and try it.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              Browser storage
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Stored state is kept minimal: your light or dark theme preference,
              {isAnalyticsConfigured()
                ? " your cookie choice, the browser's ordinary cache of the site's assets, and — only if you accept analytics — Google Analytics' own cookies."
                : " plus the browser's ordinary cache of the site's assets."}{" "}
              Tool input is not persisted between visits.
            </p>
            {isAnalyticsConfigured() && (
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Silktide stores preferences in localStorage under keys beginning
                stcm.supertools_consent., including a necessary-storage flag
                before you answer. Your analytics consent state is communicated
                to Google. Your choice is specific to this browser and site
                origin; clearing site storage resets it.
              </p>
            )}
          </section>

          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              Verifying any of this
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              You do not have to take it on trust. Open your browser's network
              panel and use any tool — you will see no request carrying your
              input. The source is public, and the site sends a strict Content
              Security Policy that confines network access to this origin
              {isAnalyticsConfigured()
                ? " and, where analytics is enabled, to Google's measurement endpoints — nothing else"
                : ""}
              . See the{" "}
              <Link
                href="/about"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                about page
              </Link>{" "}
              for the project background.
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
