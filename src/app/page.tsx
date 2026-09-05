import { faBolt } from "@fortawesome/free-solid-svg-icons/faBolt";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons/faChevronRight";
import { faKey } from "@fortawesome/free-solid-svg-icons/faKey";
import { faShieldHalved } from "@fortawesome/free-solid-svg-icons/faShieldHalved";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Metadata } from "next";
import Link from "next/link";
import { GLOBAL_KEYWORDS } from "@/lib/seo";
import { GITHUB_REPO_URL, getSiteUrl } from "@/lib/site";
import {
  featuredTools,
  homeTools,
  sidebarToolGroups,
  slugForCategory,
} from "@/lib/tools";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "SuperTools | Privacy-First Browser Developer Tools",
  description:
    "Use fast browser-based developer tools for encoding, formatting, cryptography, text processing, IDs, and time utilities with local processing.",
  keywords: GLOBAL_KEYWORDS,
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SuperTools",
    url: siteUrl,
    description:
      "Privacy-first browser developer utilities with client-side processing.",
  };

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SuperTools",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    url: siteUrl,
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SuperTools",
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    description:
      "Privacy-first browser developer utilities with client-side processing.",
    sameAs: [GITHUB_REPO_URL],
  };

  const availableToolCount = homeTools.filter((tool) => tool.available).length;
  const featuredCount = featuredTools.filter((tool) => tool.available).length;
  const comingSoonCount = homeTools.length - availableToolCount;
  const categorySummary = sidebarToolGroups.map((group) => ({
    name: group.name,
    slug: slugForCategory(group.name),
    count: group.tools.filter((tool) => tool.available).length,
  }));

  return (
    <div className="p-1 lg:p-2">
      <script type="application/ld+json">
        {JSON.stringify(websiteSchema)}
      </script>
      <script type="application/ld+json">{JSON.stringify(appSchema)}</script>
      <script type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </script>
      <div className="mx-auto w-full max-w-[1500px]">
        <section
          className="glass-panel reveal-up mb-6 rounded-2xl p-5 sm:p-7 lg:p-8"
          style={{ "--reveal-delay": "20ms" } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-primary dark:text-primary">
                Private by Default
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-[2.1rem]">
                Clean, local-first developer tools
              </h1>
              <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                Convert, parse, generate, and inspect data without sending
                anything to a backend. Built for speed, readability, and
                keyboard-friendly workflows.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link
                  href="#popular-tools"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Quick start tools
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    className="h-3 w-3"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  href="#all-tools"
                  className="inline-flex min-h-10 items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Browse all tools
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              <Stat value={String(availableToolCount)} label="Tools" />
              <Stat value={String(featuredCount)} label="Featured" />
              <Stat value="100%" label="Client-side" />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            {categorySummary.map((group) => (
              <Link
                key={group.name}
                href={`/tools/category/${group.slug}`}
                className="inline-flex min-h-8 items-center rounded-full border border-border bg-background px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {group.name}
                <span className="ml-1 text-foreground">{group.count}</span>
              </Link>
            ))}
          </div>
        </section>

        <section
          id="popular-tools"
          className="reveal-up mb-7"
          style={{ "--reveal-delay": "80ms" } as React.CSSProperties}
        >
          <SectionHeader
            title="Quick Start"
            subtitle="Essential tools for common workflows"
            count={featuredCount}
          />
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredTools.map((tool, i) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="glass-panel reveal-up transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg group flex min-h-28 items-start justify-between gap-3 rounded-xl p-4 sm:p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={
                  {
                    "--reveal-delay": `${120 + Math.floor(i / 2) * 35}ms`,
                  } as React.CSSProperties
                }
              >
                <div>
                  <h3 className="text-[15px] font-medium text-foreground">
                    {tool.name}
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </section>

        <section
          id="all-tools"
          className="reveal-up"
          style={{ "--reveal-delay": "140ms" } as React.CSSProperties}
        >
          <SectionHeader
            title="All Tools"
            subtitle="Complete toolkit grouped by use case"
            count={homeTools.length}
          />
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {homeTools.map((tool, i) => (
              <div key={tool.href}>
                {tool.available ? (
                  <Link
                    href={tool.href}
                    className="glass-panel reveal-up transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg group flex min-h-24 items-center justify-between gap-3 rounded-xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    style={
                      {
                        "--reveal-delay": `${180 + Math.floor(i / 4) * 30}ms`,
                      } as React.CSSProperties
                    }
                  >
                    <div>
                      <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {tool.sidebarCategory}
                      </p>
                      <h3 className="text-[15px] font-medium text-foreground">
                        {tool.name}
                      </h3>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>
                    <FontAwesomeIcon
                      icon={faChevronRight}
                      className="h-3 w-3 flex-shrink-0 text-muted-foreground transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                ) : (
                  <div className="glass-panel flex min-h-24 items-center justify-between gap-3 rounded-xl p-4">
                    <div>
                      <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {tool.sidebarCategory}
                      </p>
                      <h3 className="text-[15px] font-medium text-foreground">
                        {tool.name}
                      </h3>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>
                    <span className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                      Soon
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="reveal-up mt-8">
          <div className="glass-panel flex flex-wrap items-center gap-4 rounded-xl p-4 text-[13px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FontAwesomeIcon
                icon={faShieldHalved}
                className="h-2.5 w-2.5"
                aria-hidden="true"
              />
              No data sent to servers
            </div>
            <div className="flex items-center gap-1.5">
              <FontAwesomeIcon
                icon={faBolt}
                className="h-2.5 w-2.5"
                aria-hidden="true"
              />
              Instant results
            </div>
            <div className="flex items-center gap-1.5">
              <FontAwesomeIcon
                icon={faKey}
                className="h-2.5 w-2.5"
                aria-hidden="true"
              />
              No account needed
            </div>
            {comingSoonCount > 0 ? (
              <div className="ml-auto text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
                {comingSoonCount} tool{comingSoonCount === 1 ? "" : "s"} coming
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: number;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </h2>
        <p className="mt-0.5 text-[14px] text-muted-foreground">{subtitle}</p>
      </div>
      <span className="inline-flex min-h-7 items-center rounded-full border border-border px-2.5 text-[12px] font-medium text-muted-foreground">
        {count} items
      </span>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="glass-panel min-w-[5.5rem] rounded-lg px-3 py-2 text-right">
      <p className="text-[15px] font-semibold text-foreground">{value}</p>
      <p className="text-[12px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
