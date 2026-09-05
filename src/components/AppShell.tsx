"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  children: React.ReactNode;
  /**
   * Passed in from the root layout rather than imported here, so the footer is
   * server-rendered and its link list stays out of this client component's
   * bundle.
   */
  footer?: React.ReactNode;
}

export function AppShell({ children, footer }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Wait until mount before reading the resolved theme.
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const themeMode =
    mounted && resolvedTheme === "dark" ? "dark" : mounted ? "light" : "light";
  const isDarkMode = mounted ? resolvedTheme === "dark" : false;

  const cycleThemeMode = () => {
    setTheme(themeMode === "dark" ? "light" : "dark");
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-shell-bg">
      <a
        href="#main-content"
        className="fixed left-3 top-2 z-50 -translate-y-[180%] rounded-lg border border-border-strong bg-surface px-3 py-2 text-[13px] font-semibold text-foreground shadow-lg transition-transform duration-150 focus:translate-y-0"
      >
        Skip to main content
      </a>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -top-28 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-linear-to-r from-primary/10 via-ring/8 to-success/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-warn/8 blur-3xl" />
      </div>

      <Header
        onMenuClick={() => setSidebarOpen((prev) => !prev)}
        isSidebarOpen={sidebarOpen}
        mounted={mounted}
        themeMode={themeMode}
        isDarkMode={isDarkMode}
        onThemeToggle={cycleThemeMode}
      />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main id="main-content" className="pt-14 lg:pl-64">
        <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-[1680px] px-3 py-3 sm:px-5 sm:py-5 lg:px-7">
          {children}
        </div>
      </main>
      {footer ? <div className="lg:pl-64">{footer}</div> : null}
    </div>
  );
}
