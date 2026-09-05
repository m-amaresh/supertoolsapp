import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Regex Tester Online — Live Match & Groups | SuperTools",
  description:
    "Test regular expressions against sample text with live matches, capture groups, and flags. Free regex tester that runs entirely in your browser.",
  path: "/tools/text/regex",
  keywords: [
    "regex tester",
    "regex test online",
    "regular expression tester",
    "regex checker",
    "regex match tool",
    "regex capture groups",
    "javascript regex tester",
    "regex playground",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/text/regex" />
      {children}
      <ToolSeoFaqServer path="/tools/text/regex" />
    </>
  );
}
