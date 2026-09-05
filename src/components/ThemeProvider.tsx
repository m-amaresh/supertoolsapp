"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Wraps next-themes with project defaults: data-theme attribute (not class)
// for CSS variable switching, system preference tracking, and transition
// suppression during theme changes to prevent FOUC.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      storageKey="supertools-theme-mode"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
