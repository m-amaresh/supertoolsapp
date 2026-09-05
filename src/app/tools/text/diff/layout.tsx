import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Text Diff Checker — Compare Two Texts | SuperTools",
  description:
    "Compare two blocks of text side by side and highlight every line-level difference. Free online diff checker that runs entirely in your browser.",
  path: "/tools/text/diff",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/text/diff" />
      {children}
      <ToolSeoFaqServer path="/tools/text/diff" />
    </>
  );
}
