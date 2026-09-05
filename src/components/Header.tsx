"use client";

import { faGithub } from "@fortawesome/free-brands-svg-icons/faGithub";
import { faBars } from "@fortawesome/free-solid-svg-icons/faBars";
import { faMoon } from "@fortawesome/free-solid-svg-icons/faMoon";
import { faSun } from "@fortawesome/free-solid-svg-icons/faSun";
import { faWrench } from "@fortawesome/free-solid-svg-icons/faWrench";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GITHUB_REPO_URL } from "@/lib/site";

interface HeaderProps {
  onMenuClick: () => void;
  isSidebarOpen: boolean;
  mounted: boolean;
  themeMode: "light" | "dark";
  isDarkMode: boolean;
  onThemeToggle: () => void;
}

export function Header({
  onMenuClick,
  isSidebarOpen,
  mounted,
  themeMode,
  isDarkMode,
  onThemeToggle,
}: HeaderProps) {
  const nextThemeMode = themeMode === "light" ? "dark" : "light";
  const currentThemeLabel = themeMode === "dark" ? "Dark" : "Light";
  const themeIcon = isDarkMode ? faSun : faMoon;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/94 backdrop-blur-sm">
      <div className="relative flex h-14 w-full items-center justify-center px-3 sm:px-5 lg:px-7">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={onMenuClick}
          className="absolute left-3 lg:hidden sm:left-5 lg:left-7"
          aria-label="Toggle menu"
          aria-expanded={isSidebarOpen}
          aria-controls="sidebar-nav"
        >
          <FontAwesomeIcon
            icon={faBars}
            className="h-3.5 w-3.5"
            aria-hidden="true"
          />
        </Button>

        <Link
          href="/"
          className="group absolute left-1/2 flex min-h-10 -translate-x-1/2 items-center gap-2 rounded-md px-1 py-0.5 pr-1 transition-colors hover:text-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm transition-all duration-150 group-hover:shadow-md">
            <FontAwesomeIcon
              icon={faWrench}
              className="h-3 w-3 text-primary-foreground"
              aria-hidden="true"
            />
          </div>
          <span className="text-[14px] font-semibold tracking-tight text-foreground">
            SuperTools
          </span>
        </Link>

        <div className="absolute right-3 flex items-center gap-2 sm:right-5 lg:right-7">
          <Button variant="outline" asChild size="icon-sm">
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open project GitHub repository"
              title="GitHub repository"
            >
              <FontAwesomeIcon
                icon={faGithub}
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </a>
          </Button>

          {mounted ? (
            <Button
              variant="outline"
              size="icon-sm"
              onClick={onThemeToggle}
              aria-label={`Theme is ${currentThemeLabel}. Switch to ${nextThemeMode} mode.`}
              title={`Theme: ${currentThemeLabel} (click for ${nextThemeMode})`}
            >
              <FontAwesomeIcon
                icon={themeIcon}
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </Button>
          ) : (
            <div className="h-8 w-8" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}
