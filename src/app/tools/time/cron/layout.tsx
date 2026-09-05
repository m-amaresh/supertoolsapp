import type { ReactNode } from "react";
import { ToolSeoFaqServer } from "@/components/ToolSeoFaqServer";
import { ToolBreadcrumbs } from "@/components/tool/ToolBreadcrumbs";
import { buildToolMetadata } from "@/lib/seo";

export const metadata = buildToolMetadata({
  title: "Cron Expression Parser & Builder | SuperTools",
  description:
    "Parse and build cron expressions with plain-English descriptions and a preview of upcoming run times. Free cron parser running in your browser.",
  path: "/tools/time/cron",
});

export default function ToolLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <ToolBreadcrumbs path="/tools/time/cron" />
      {children}
      <ToolSeoFaqServer path="/tools/time/cron" />
    </>
  );
}
