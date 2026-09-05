import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "CSV to JSON Converter — CSV, TSV, JSON | SuperTools",
  description:
    "Convert CSV or TSV data to JSON and JSON arrays back to CSV/TSV online. Free converter that parses everything locally in your browser.",
  path: "/tools/data/csv",
  keywords: [
    "csv to json",
    "json to csv",
    "tsv to json",
    "json to tsv",
    "csv converter",
    "delimited data converter",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/data/csv" />
      {children}
      <ToolSeoFaqServer path="/tools/data/csv" />
    </>
  );
}
