import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Number Base Converter — Binary, Hex, Decimal | SuperTools",
  description:
    "Convert numbers between binary, octal, decimal, and hexadecimal instantly. Free online base converter with arbitrary precision, running in your browser.",
  path: "/tools/data/baseconv",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/data/baseconv" />
      {children}
      <ToolSeoFaqServer path="/tools/data/baseconv" />
    </>
  );
}
