import Link from "next/link";
import { GITHUB_REPO_URL } from "@/lib/site";
import { toolCategories } from "@/lib/tools";

// Rendered as a server component and passed into AppShell as a prop, so the
// site-wide link block stays out of the client bundle.
//
// Every page carries these links: they give the category hubs and the About /
// Privacy pages an inbound link from all 45 routes, which is how a crawler
// reaches them without depending on the sidebar.
export function Footer() {
  return (
    <footer className="mt-10 border-t border-border">
      <div className="mx-auto w-full max-w-[1680px] px-3 py-8 sm:px-5 lg:px-7">
        <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <p className="text-[14px] font-semibold tracking-tight text-foreground">
              SuperTools
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Free developer utilities that run entirely in your browser. Text,
              files, keys, and passwords are processed on your device and are
              never uploaded to a server.
            </p>
          </div>

          <nav aria-label="Tool categories">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Categories
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1.5">
              {toolCategories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/tools/category/${category.slug}`}
                    className="inline-flex min-h-6 items-center text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="About this site">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Project
            </h2>
            <ul className="mt-3 space-y-1.5">
              <li>
                <Link
                  href="/about"
                  className="inline-flex min-h-6 items-center text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="inline-flex min-h-6 items-center text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex min-h-6 items-center text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Source on GitHub
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <p className="mt-8 border-t border-border pt-5 text-[12px] text-muted-foreground">
          © {new Date().getFullYear()} SuperTools. Built by Amaresh. Every tool
          runs client-side.
        </p>
      </div>
    </footer>
  );
}
