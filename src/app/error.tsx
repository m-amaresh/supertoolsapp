"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);
  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          The page hit an unexpected error. You can retry safely.
        </p>
        <Button size="sm" onClick={reset} className="mt-4">
          Try again
        </Button>
      </div>
    </div>
  );
}
