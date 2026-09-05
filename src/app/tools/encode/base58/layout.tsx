import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Base58 & Base58Check Encoder Online | SuperTools",
  description:
    "Encode and decode Bitcoin-style Base58 and Base58Check payloads online. All conversion happens in your browser — no upload, no account, no tracking.",
  path: "/tools/encode/base58",
  keywords: [
    "base58 encode",
    "base58 decode",
    "base58check",
    "bitcoin base58",
    "base58 converter",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/base58" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/base58" />
    </>
  );
}
