import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "String Escape & Unescape — HTML, JSON, Regex | SuperTools",
  description:
    "Escape and unescape strings for HTML, JSON, URL, and regular expressions. Free online tool that processes everything locally in your browser.",
  path: "/tools/encode/escape",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/escape" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/escape" />
    </>
  );
}
