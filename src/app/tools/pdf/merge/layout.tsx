import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "PDF Merger — Combine PDF Files Free | SuperTools",
  description:
    "Combine several PDFs into one document in the order you choose. Unlike other PDF mergers, your files are combined in your browser and never uploaded.",
  path: "/tools/pdf/merge",
  keywords: [
    "merge pdf",
    "combine pdf",
    "pdf merger",
    "join pdf files",
    "merge pdf offline",
    "combine pdf files free",
    "pdf merger no upload",
    "local pdf merger",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/pdf/merge" />
      {children}
      <ToolSeoFaqServer path="/tools/pdf/merge" />
    </>
  );
}
