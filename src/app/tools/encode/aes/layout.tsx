import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "AES Encryption Online — AES-256-GCM | SuperTools",
  description:
    "Encrypt and decrypt text with AES-256-GCM and PBKDF2 key derivation. Runs entirely in your browser using Web Crypto, so keys never leave your device.",
  path: "/tools/encode/aes",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/aes" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/aes" />
    </>
  );
}
