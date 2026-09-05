import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "CIDR Calculator — IPv4 & IPv6 Subnets | SuperTools",
  description:
    "Calculate subnet ranges, masks, wildcard masks, and host counts for IPv4 and IPv6, plus VLSM splitting. Free CIDR calculator running in your browser.",
  path: "/tools/network/cidr",
  keywords: [
    "cidr calculator",
    "subnet calculator",
    "ipv4 subnet",
    "ipv6 subnet",
    "network mask",
    "ip range calculator",
    "wildcard mask",
    "cidr to netmask",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/network/cidr" />
      {children}
      <ToolSeoFaqServer path="/tools/network/cidr" />
    </>
  );
}
