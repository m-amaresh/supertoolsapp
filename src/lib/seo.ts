import type { Metadata } from "next";
import { TOOL_INTENT_KEYWORDS } from "./tool-seo";

export const GLOBAL_KEYWORDS = [
  "developer tools",
  "online tools",
  "privacy-first tools",
  "client-side tools",
  "json formatter",
  "yaml converter",
  "base64 encoder",
  "hash generator",
  "regex tester",
  "timestamp converter",
  "uuid generator",
  "password generator",
  "aes encryption",
  "rsa sign verify",
  "text diff",
  "csv to json",
  "url parser",
  "base58 converter",
  "tls certificate viewer",
  "cidr calculator",
  "qr code generator",
];

export const TOOLS_KEYWORDS = [
  "browser developer tools",
  "local processing",
  "no upload tools",
  "encoding tools",
  "data conversion tools",
  "text utilities",
  "time utilities",
  "cryptography utilities",
];

function stripBrand(title: string): string {
  return title.replace(/\s*[-–—|]\s*SuperTools$/i, "").trim();
}

// Build a complete Next.js Metadata object for a tool page, merging
// global keywords with per-tool intent keywords for SEO.
export function buildToolMetadata({
  title,
  description,
  path,
  keywords = [],
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const cleanTitle = stripBrand(title);
  const mergedKeywords = Array.from(
    new Set([
      ...TOOLS_KEYWORDS,
      ...(TOOL_INTENT_KEYWORDS[path] ?? []),
      ...keywords,
    ]),
  );

  return {
    title,
    description,
    keywords: mergedKeywords,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      url: path,
      title: `${cleanTitle} | SuperTools`,
      description,
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
      title: `${cleanTitle} | SuperTools`,
      description,
      images: ["/twitter-image"],
    },
  };
}
