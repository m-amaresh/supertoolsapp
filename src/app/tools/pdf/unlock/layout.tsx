import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "PDF Password Remover — Unlock PDF Free | SuperTools",
  description:
    "Remove the password from a PDF you can already open. Unlike other PDF unlockers, the file and its password are decrypted in your browser and never uploaded.",
  path: "/tools/pdf/unlock",
  keywords: [
    "remove pdf password",
    "unlock pdf",
    "pdf password remover",
    "decrypt pdf",
    "remove pdf restrictions",
    "unlock pdf offline",
    "pdf password remover no upload",
    "local pdf unlocker",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/pdf/unlock" />
      {children}
      <ToolSeoFaqServer path="/tools/pdf/unlock" />
    </>
  );
}
