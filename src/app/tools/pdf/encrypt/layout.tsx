import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Password Protect PDF Online — Add a Password Free | SuperTools",
  description:
    "Add a password to a PDF with AES-256 encryption. Set printing, copying and editing permissions. Runs entirely in your browser — nothing is ever uploaded.",
  path: "/tools/pdf/encrypt",
  keywords: [
    "password protect pdf",
    "add password to pdf",
    "encrypt pdf",
    "lock pdf",
    "pdf password protection",
    "secure pdf online",
    "aes 256 pdf encryption",
    "protect pdf no upload",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/pdf/encrypt" />
      {children}
      <ToolSeoFaqServer path="/tools/pdf/encrypt" />
    </>
  );
}
