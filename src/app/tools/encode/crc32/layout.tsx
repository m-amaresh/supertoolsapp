import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "CRC32 Checksum Calculator Online | SuperTools",
  description:
    "Compute CRC32 checksums for text and files instantly. Free online checksum calculator with local processing — files are never uploaded anywhere.",
  path: "/tools/encode/crc32",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/crc32" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/crc32" />
    </>
  );
}
