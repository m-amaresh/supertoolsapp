import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "JWT Decoder — Decode JSON Web Tokens | SuperTools",
  description:
    "Decode a JWT to inspect its header, payload, and expiry. Tokens are parsed in your browser and never transmitted — safe for real access tokens.",
  path: "/tools/encode/jwt",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/jwt" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/jwt" />
    </>
  );
}
