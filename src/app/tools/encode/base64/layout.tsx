import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Base64 Encode & Decode Online | SuperTools",
  description:
    "Free Base64 encoder and decoder for text and files. Supports standard Base64 and Base64url. Runs entirely in your browser — nothing is ever uploaded.",
  path: "/tools/encode/base64",
  keywords: [
    "base64 encode",
    "base64 decode",
    "base64 encoder",
    "base64 decoder",
    "base64url",
    "encode to base64",
    "decode base64 online",
    "online base64 tool",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/base64" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/base64" />
    </>
  );
}
