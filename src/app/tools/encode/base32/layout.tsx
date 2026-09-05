import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Base32 Encode & Decode Online | SuperTools",
  description:
    "Free RFC 4648 Base32 encoder and decoder for text and bytes. Everything is processed locally in your browser, so your data is never sent to a server.",
  path: "/tools/encode/base32",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/base32" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/base32" />
    </>
  );
}
