import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "RSA Sign & Verify Online — PEM Keys | SuperTools",
  description:
    "Sign and verify messages with RSA and SHA-256 using PEM keys. All cryptography runs locally via Web Crypto — your private key never leaves the browser.",
  path: "/tools/encode/rsa",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/rsa" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/rsa" />
    </>
  );
}
