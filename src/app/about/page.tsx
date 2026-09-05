import type { Metadata } from "next";
import Link from "next/link";
import { GITHUB_REPO_URL, getSiteUrl } from "@/lib/site";
import { toolCategories, toolDefinitions } from "@/lib/tools";

export const metadata: Metadata = {
  title: "About SuperTools | SuperTools",
  description:
    "What SuperTools is, who builds it, and why every tool runs in your browser instead of on a server. No accounts, no uploads, no tracking of your input.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: "/about",
    title: "About SuperTools",
    description:
      "What SuperTools is, who builds it, and why every tool runs in your browser instead of on a server.",
  },
};

const availableCount = toolDefinitions.filter((tool) => tool.available).length;

export default function AboutPage() {
  const siteUrl = getSiteUrl();

  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About SuperTools",
    url: `${siteUrl}/about`,
    mainEntity: {
      "@type": "Organization",
      name: "SuperTools",
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
      description:
        "Privacy-first browser developer utilities with client-side processing.",
      sameAs: [GITHUB_REPO_URL],
    },
  };

  return (
    <div className="p-1 lg:p-2">
      <script type="application/ld+json">{JSON.stringify(aboutSchema)}</script>

      <article className="mx-auto w-full max-w-[820px]">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            About SuperTools
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {availableCount} developer utilities that run entirely in your
            browser, across {toolCategories.length} categories.
          </p>
        </header>

        <div className="glass-panel space-y-4 rounded-xl border border-border p-5 sm:p-6">
          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              What this is
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              SuperTools is a collection of the small utilities developers reach
              for many times a day — encoding and decoding, hashing, formatting
              JSON and YAML, comparing text, generating IDs and passwords,
              reading certificates, doing subnet maths, unlocking PDFs. They are
              collected in one place with a consistent interface, keyboard
              shortcuts, and no advertising.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              Why it runs in your browser
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Most online tools of this kind send whatever you paste to a
              server. That is a poor trade when the thing you are pasting is an
              access token, a private key, a customer export, or a password-
              protected document. Every tool here does its work with JavaScript
              and WebAssembly running on your own machine, so the payload has no
              reason to leave it. The{" "}
              <Link
                href="/privacy"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                privacy page
              </Link>{" "}
              sets out exactly what that promise covers and what it does not.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              Who builds it
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              SuperTools is built and maintained by Amaresh as an open source
              project. The full source, including every tool implementation and
              its tests, is public — so the claim that nothing is uploaded is
              something you can verify rather than take on trust.
            </p>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                Read the source on GitHub
              </a>
              . Bug reports and tool suggestions are welcome there.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold tracking-tight text-foreground">
              How it is built
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Next.js and React, with every page prerendered as static HTML.
              Cryptography uses the browser's native Web Crypto API rather than
              a bundled implementation, and PDF decryption uses a WebAssembly
              build of qpdf served from this origin. There is no backend API
              behind any tool.
            </p>
          </section>
        </div>

        <nav aria-label="Tool categories" className="mt-8">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Browse the tools
          </h2>
          <div className="flex flex-wrap gap-2">
            {toolCategories.map((category) => (
              <Link
                key={category.slug}
                href={`/tools/category/${category.slug}`}
                className="inline-flex min-h-8 items-center rounded-full border border-border bg-background px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {category.heading}
              </Link>
            ))}
          </div>
        </nav>
      </article>
    </div>
  );
}
