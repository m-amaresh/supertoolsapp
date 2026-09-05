import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Lorem Ipsum Generator — Placeholder Text | SuperTools",
  description:
    "Generate lorem ipsum placeholder text by words, sentences, or paragraphs. Free dummy text generator for designs and layouts, running in your browser.",
  path: "/tools/text/lorem",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/text/lorem" />
      {children}
      <ToolSeoFaqServer path="/tools/text/lorem" />
    </>
  );
}
