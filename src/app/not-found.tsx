import { faCompass } from "@fortawesome/free-solid-svg-icons/faCompass";
import { faHouse } from "@fortawesome/free-solid-svg-icons/faHouse";
import { faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons/faMagnifyingGlass";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page Not Found - SuperTools",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="p-1 lg:p-2">
      <div className="mx-auto w-full max-w-[960px]">
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="h-3.5 w-3.5"
              aria-hidden="true"
            />
            Page Not Found
          </div>

          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            This route does not exist
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            The link may be outdated, mistyped, or moved. Return to the tool
            gallery to continue.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/">
                <FontAwesomeIcon
                  icon={faHouse}
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                Back to Home
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/#all-tools">
                <FontAwesomeIcon
                  icon={faCompass}
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                Browse Tools
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
