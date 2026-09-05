import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "URL Parser & Query String Builder | SuperTools",
  description:
    "Parse any URL into its protocol, host, path, and query parameters, then edit the query string interactively. Runs locally in your browser.",
  path: "/tools/encode/url-parser",
  keywords: [
    "url parser",
    "query string builder",
    "url query editor",
    "parse url online",
    "url components",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/url-parser" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/url-parser" />
    </>
  );
}
