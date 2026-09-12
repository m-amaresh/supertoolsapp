import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ConsentManager } from "@/components/ConsentManager";
import { Footer } from "@/components/Footer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GA_MEASUREMENT_ID, isAnalyticsConfigured } from "@/lib/analytics";
import { GLOBAL_KEYWORDS } from "@/lib/seo";
import { getSiteUrl, shouldIndexSite } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: "SuperTools",
  description:
    "Fast, privacy-first developer utilities that run 100% in your browser",
  applicationName: "SuperTools",
  category: "Developer Tools",
  keywords: GLOBAL_KEYWORDS,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "SuperTools",
    title: "SuperTools",
    description:
      "Fast, privacy-first developer utilities that run 100% in your browser",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SuperTools - Privacy-first browser developer tools",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SuperTools",
    description:
      "Fast, privacy-first developer utilities that run 100% in your browser",
    images: ["/twitter-image"],
  },
  robots: shouldIndexSite()
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

// suppressHydrationWarning on <html> is required by next-themes —
// it injects a script that sets the theme attribute before React hydrates.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={`${inter.variable} ${ibmPlexMono.variable}`}>
        <ThemeProvider>
          <AppShell footer={<Footer />}>{children}</AppShell>
        </ThemeProvider>
        {/* Vercel's analytics are cookieless and store nothing on the
            device, so they are not gated behind the banner. Google Analytics
            is, and does not render at all without a measurement ID. */}
        <Analytics />
        <SpeedInsights />
        {isAnalyticsConfigured() && (
          <ConsentManager measurementId={GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
