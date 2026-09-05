import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Color Converter — HEX, RGB, HSL, OKLCH | SuperTools",
  description:
    "Convert colors between HEX, RGB, HSL, and OKLCH and generate palettes. Free online color converter with instant, fully client-side conversion.",
  path: "/tools/data/color",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/data/color" />
      {children}
      <ToolSeoFaqServer path="/tools/data/color" />
    </>
  );
}
