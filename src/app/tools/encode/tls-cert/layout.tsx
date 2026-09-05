import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "TLS/SSL Certificate Decoder — View PEM | SuperTools",
  description:
    "Decode a PEM TLS/SSL certificate to view its subject, issuer, validity dates, SAN entries, and fingerprints. Parsed locally, never uploaded.",
  path: "/tools/encode/tls-cert",
  keywords: [
    "tls certificate viewer",
    "x509 certificate parser",
    "pem certificate inspector",
    "certificate fingerprint",
    "subject alt names",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/encode/tls-cert" />
      {children}
      <ToolSeoFaqServer path="/tools/encode/tls-cert" />
    </>
  );
}
