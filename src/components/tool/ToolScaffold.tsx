"use client";

import type * as React from "react";
import { useId, useState } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ClassNameProps {
  className?: string;
}

interface ToolPageProps extends React.PropsWithChildren, ClassNameProps {}

export function ToolPage({ children, className }: ToolPageProps) {
  return <div className={cn("p-1 lg:p-2", className)}>{children}</div>;
}

interface ToolHeaderProps extends ClassNameProps {
  title: string;
  description: string;
}

export function ToolHeader({ title, description, className }: ToolHeaderProps) {
  return (
    <header className={cn("mb-6", className)}>
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
        {description}
      </p>
    </header>
  );
}

interface ToolCardProps extends React.PropsWithChildren, ClassNameProps {}

export function ToolCard({ children, className }: ToolCardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ToolToolbarProps extends React.PropsWithChildren, ClassNameProps {}

export function ToolToolbar({ children, className }: ToolToolbarProps) {
  return (
    <div
      data-slot="tool-toolbar"
      className={cn(
        // Hide the bar when its conditional controls leave it empty.
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-3 [&>div]:flex-wrap",
        "[&:not(:has(button,a,label,input,select,[role=radio]))]:hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ToolOptionsBarProps extends React.PropsWithChildren, ClassNameProps {}

/**
 * Collapses settings below `sm` to leave room for inputs. On wider screens the
 * panel stays visible, regardless of the mobile toggle state.
 */
export function ToolOptionsBar({ children, className }: ToolOptionsBarProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={cn("border-b border-border bg-muted/30", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[13px] font-semibold tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:hidden"
      >
        Settings
        <span
          aria-hidden="true"
          className={cn(
            "transition-transform duration-150",
            open && "rotate-180",
          )}
        >
          ▾
        </span>
      </button>

      <div
        id={panelId}
        className={cn(
          "flex-wrap items-center gap-x-6 gap-y-2 px-4 pb-3 sm:flex sm:pt-3",
          open ? "flex pt-0" : "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface ToolStatusStackProps
  extends React.PropsWithChildren,
    ClassNameProps {}

export function ToolStatusStack({ children, className }: ToolStatusStackProps) {
  return (
    <div
      data-slot="tool-status-stack"
      className={cn("peer mx-4 mt-4 space-y-2", className)}
    >
      {children}
    </div>
  );
}

interface ToolBodyProps extends React.PropsWithChildren, ClassNameProps {}

export function ToolBody({ children, className }: ToolBodyProps) {
  return (
    <div
      className={cn(
        "space-y-4 p-4 peer-data-[slot=tool-status-stack]:pt-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ToolHintProps extends React.PropsWithChildren, ClassNameProps {
  /**
   * Must match the field's `aria-describedby`, so the hint is read out when the
   * field takes focus rather than being a stray sentence beside it.
   */
  id: string;
}

/**
 * Helper text for a field. Belongs *below* the input it describes: rendered
 * above, it reads as a comment on the page rather than guidance for the field,
 * and it is passed before the user reaches the control it explains.
 */
export function ToolHint({ id, children, className }: ToolHintProps) {
  return (
    <p
      id={id}
      className={cn(
        "mt-2 text-[12px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

interface ToolLiveRegionProps {
  /**
   * One sentence describing the outcome, e.g. "5 UUIDs generated." Pass the
   * empty string when there is nothing to announce.
   */
  message: string;
}

/**
 * Announces a tool's result to assistive technology.
 *
 * Errors already speak for themselves — `AlertBox` defaults to `role="alert"` —
 * but success was silent, so a screen-reader user was told when they failed and
 * heard nothing when they succeeded (WCAG 4.1.3).
 *
 * Always mounted, never conditionally rendered: a live region inserted at the
 * same moment its content changes is unreliably announced across screen
 * readers. Live tools should debounce the message they pass in, or typing
 * produces a stream of interruptions.
 */
export function ToolLiveRegion({ message }: ToolLiveRegionProps) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

interface ToolFootnoteProps extends React.PropsWithChildren, ClassNameProps {}

export function ToolFootnote({ children, className }: ToolFootnoteProps) {
  return (
    <p
      className={cn(
        "mt-4 text-[12px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

interface ToolLabelProps extends React.PropsWithChildren, ClassNameProps {
  htmlFor?: string;
}

export function ToolLabel({ children, className, htmlFor }: ToolLabelProps) {
  return (
    <Label
      htmlFor={htmlFor}
      className={cn(
        "mb-2 text-[13px] font-semibold tracking-wide text-muted-foreground",
        className,
      )}
    >
      {children}
    </Label>
  );
}

interface ToolMetaProps extends React.PropsWithChildren, ClassNameProps {}

export function ToolMeta({ children, className }: ToolMetaProps) {
  return (
    <span
      className={cn("text-[13px] font-medium text-muted-foreground", className)}
    >
      {children}
    </span>
  );
}

interface ToolCodeBlockProps extends React.PropsWithChildren, ClassNameProps {}

export function ToolCodeBlock({ children, className }: ToolCodeBlockProps) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-md border border-border bg-muted/25 p-3 font-mono text-[13px] leading-relaxed text-foreground",
        className,
      )}
    >
      {children}
    </pre>
  );
}
