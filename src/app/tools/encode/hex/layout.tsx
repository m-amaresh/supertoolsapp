import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Hex Encoder & Decoder — Text to Hex | SuperTools",
  description:
    "Convert text to hexadecimal and decode hex back to text online. Free, instant, and fully client-side — your input never leaves your device.",
  path: "/tools/encode/hex",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/hex" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/hex" />
    </>
  );
}
