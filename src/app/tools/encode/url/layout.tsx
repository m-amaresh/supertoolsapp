import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "URL Encoder & Decoder Online | SuperTools",
  description:
    "Percent-encode and decode URL components and query strings online. Free and fully client-side, so nothing you paste is sent to any server.",
  path: "/tools/encode/url",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/url" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/url" />
    </>
  );
}
