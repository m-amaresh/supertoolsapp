import type { Metadata } from "next";
import Link from "next/link";
import { CookiePreferencesButton } from "@/components/CookiePreferencesButton";
import { isAnalyticsConfigured } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Cookie preferences | SuperTools",
  description:
    "Manage Google Analytics cookies and learn what measurement continues when you decline.",
  alternates: { canonical: "/cookies" },
  robots: { index: false, follow: true },
};

export default function CookiesPage() {
  return (
    <div className="p-1 lg:p-2">
      <article className="mx-auto w-full max-w-[820px]">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Cookie preferences
        </h1>
        <div className="glass-panel space-y-5 rounded-xl border border-border p-5 text-[14px] leading-relaxed text-muted-foreground sm:p-6">
          <p>
            Vercel measures page views and loading performance without cookies.
            This measurement continues whatever you choose here.
          </p>
          {isAnalyticsConfigured() ? (
            <>
              <p>
                Google Analytics receives limited page-view and engagement
                measurements without analytics cookies before you choose and
                when you decline. Allowing analytics cookies helps recognise
                returning visits and understand journeys between pages.
                Advertising features are disabled.
              </p>
              <p>
                Open preferences, change the Analytics cookies option, then
                save. Declining removes existing Google Analytics cookies for
                this site. Limited cookieless measurement continues. Your choice
                applies to other open tabs on this origin and future visits in
                this browser. Changing your choice does not reload the page or
                delete data already collected.
              </p>
              <p>
                Your tool input is processed in your browser and is not included
                in analytics. Your theme and consent preferences are stored
                locally. Clearing site storage resets your consent choice.
              </p>
              <CookiePreferencesButton className="rounded-md border border-border px-4 py-2" />
            </>
          ) : (
            <p>
              Google Analytics is not enabled on this deployment. There are no
              optional analytics cookies to manage.
            </p>
          )}
          <p>
            <Link
              href="/privacy"
              className="text-foreground underline underline-offset-2 hover:text-primary"
            >
              Read the privacy policy
            </Link>
          </p>
        </div>
      </article>
    </div>
  );
}
