import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "YAML to JSON Converter & Validator | SuperTools",
  description:
    "Convert YAML to JSON and JSON to YAML, and validate YAML syntax online. Free, instant, and fully client-side — nothing is sent to a server.",
  path: "/tools/data/yaml",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/data/yaml" />
      {children}
      <ToolSeoFaqServer path="/tools/data/yaml" />
    </>
  );
}
