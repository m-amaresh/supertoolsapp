import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "QR Code Generator — URL, Wi-Fi, vCard | SuperTools",
  description:
    "Create QR codes for URLs, Wi-Fi credentials, vCards, or any text and download them as PNG or SVG. Generated in your browser — nothing is uploaded.",
  path: "/tools/ids/qrcode",
  keywords: [
    "qr code generator",
    "qr generator",
    "create qr code",
    "url qr code",
    "wifi qr code",
    "vcard qr code",
    "download qr code svg",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/ids/qrcode" />
      {children}
      <ToolSeoFaqServer path="/tools/ids/qrcode" />
    </>
  );
}
