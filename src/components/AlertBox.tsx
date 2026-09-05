"use client";

import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons/faCircleCheck";
import { faCircleExclamation } from "@fortawesome/free-solid-svg-icons/faCircleExclamation";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons/faTriangleExclamation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "warn" | "success";

interface AlertBoxProps {
  variant: AlertVariant;
  children: React.ReactNode;
  className?: string;
  /**
   * Overrides the underlying `role="alert"`. Pass `"presentation"` when the
   * surrounding page already announces the same state through its own live
   * region, so assistive tech does not read the message twice.
   */
  role?: React.AriaRole;
}

const VARIANT_ICONS: Record<AlertVariant, IconDefinition> = {
  error: faCircleExclamation,
  warn: faTriangleExclamation,
  success: faCircleCheck,
};

export function AlertBox({
  variant,
  children,
  className = "",
  role,
}: AlertBoxProps) {
  const icon = VARIANT_ICONS[variant];
  return (
    <Alert
      variant={variant}
      // Spread last inside Alert, so an undefined value would strip the
      // default instead of falling back to it.
      role={role ?? "alert"}
      className={cn("flex items-start gap-2", className)}
    >
      <FontAwesomeIcon
        icon={icon}
        className="mt-0.5 h-3.5 w-3.5 shrink-0"
        aria-hidden={true}
      />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
