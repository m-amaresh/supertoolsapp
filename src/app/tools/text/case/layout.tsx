import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Case Converter — camelCase, snake_case | SuperTools",
  description:
    "Convert text between camelCase, PascalCase, snake_case, kebab-case, and more. Free online case converter with instant client-side conversion.",
  path: "/tools/text/case",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/text/case" />
      {children}
      <ToolSeoFaqServer path="/tools/text/case" />
    </>
  );
}
