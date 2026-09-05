import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Strong Password Generator — Secure & Random | SuperTools",
  description:
    "Generate strong, random passwords with configurable length and character sets. Built on Web Crypto and fully client-side — passwords are never transmitted.",
  path: "/tools/ids/password",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/ids/password" />
      {children}
      <ToolSeoFaqServer path="/tools/ids/password" />
    </>
  );
}
