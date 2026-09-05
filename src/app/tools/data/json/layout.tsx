import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "JSON Formatter, Validator & Minifier | SuperTools",
  description:
    "Format, validate, beautify, and minify JSON online with clear error messages. Free JSON formatter that runs client-side — your data is never uploaded.",
  path: "/tools/data/json",
  keywords: [
    "json formatter",
    "json beautifier",
    "json minify",
    "json validator",
    "format json online",
    "json prettify",
    "json parser",
    "fix json",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/data/json" />
      {children}
      <ToolSeoFaqServer path="/tools/data/json" />
    </>
  );
}
