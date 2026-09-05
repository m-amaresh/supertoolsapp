import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Hash Generator — MD5, SHA-256, SHA-3, HMAC | SuperTools",
  description:
    "Generate MD5, SHA-1, SHA-256, SHA-512, SHA-3, and HMAC digests from text or files. Free online hash generator that runs entirely in your browser.",
  path: "/tools/encode/hash",
  keywords: [
    "hash generator",
    "sha256 generator",
    "md5 hash",
    "sha512 hash",
    "hmac generator",
    "hash text online",
    "checksum generator",
    "sha3-256",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/hash" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/hash" />
    </>
  );
}
