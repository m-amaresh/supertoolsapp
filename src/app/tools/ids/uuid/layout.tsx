import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "UUID Generator — Free Online UUID v4 | SuperTools",
  description:
    "Generate random UUID v4 values in bulk using the Web Crypto API. Free, RFC 4122 compliant, and fully client-side — IDs never leave your browser.",
  path: "/tools/ids/uuid",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/ids/uuid" />
      {children}
      <ToolSeoFaqServer path="/tools/ids/uuid" />
    </>
  );
}
