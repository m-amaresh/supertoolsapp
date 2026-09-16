import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Split PDF Online — Extract Pages Free | SuperTools",
  description:
    "Split a PDF into separate files or extract the pages you want. Supports ranges like 1-5, 8. Runs entirely in your browser — nothing is ever uploaded.",
  path: "/tools/pdf/split",
  keywords: [
    "split pdf",
    "extract pdf pages",
    "pdf splitter",
    "separate pdf pages",
    "delete pages from pdf",
    "split pdf by page range",
    "pdf page extractor",
    "split pdf no upload",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/pdf/split" />
      {children}
      <ToolSeoFaqServer path="/tools/pdf/split" />
    </>
  );
}
