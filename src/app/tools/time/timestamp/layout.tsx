import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Unix Timestamp Converter — Epoch to Date | SuperTools",
  description:
    "Convert Unix timestamps to human-readable dates and back, in local time or UTC. Free epoch converter that runs entirely in your browser.",
  path: "/tools/time/timestamp",
  keywords: [
    "timestamp converter",
    "unix timestamp converter",
    "epoch converter",
    "unix to date",
    "date to unix timestamp",
    "timestamp to utc",
    "epoch time converter",
    "iso 8601 converter",
  ],
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/time/timestamp" />
      {children}
      <ToolSeoFaqServer path="/tools/time/timestamp" />
    </>
  );
}
