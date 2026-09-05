"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ToolbarGroupProps {
  label?: string;
  /**
   * `id` of the control this label names. Required whenever `label` names a
   * single form control, so the visible text becomes the control's accessible
   * name (WCAG 2.5.3) instead of a stray text node beside a differently-named
   * control. Omit only when the group wraps something that carries its own
   * group name, such as a `SegmentedControl`.
   */
  htmlFor?: string;
  children: React.ReactNode;
}

export function ToolbarGroup({ label, htmlFor, children }: ToolbarGroupProps) {
  return (
    <div className="flex items-center gap-2">
      {label && (
        <Label
          htmlFor={htmlFor}
          className="text-[13px] font-semibold tracking-[0.06em] text-muted-foreground"
        >
          {label}
        </Label>
      )}
      {children}
    </div>
  );
}

interface ToolbarSelectBaseProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
}

/**
 * A select must end up with a name. Prefer `id`, paired with the `htmlFor` of
 * the surrounding `ToolbarGroup`, so the name is the label the user can see.
 * `ariaLabel` remains for the few selects that have no visible label.
 *
 * There is deliberately no default: a nameless select fails to type-check
 * rather than shipping as "Toolbar select", which named nothing.
 */
type ToolbarSelectProps = ToolbarSelectBaseProps &
  ({ id: string; ariaLabel?: string } | { id?: undefined; ariaLabel: string });

export function ToolbarSelect({
  value,
  onChange,
  options,
  id,
  ariaLabel,
  className = "",
}: ToolbarSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={className} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ToolbarCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function ToolbarCheckbox({
  checked,
  onChange,
  label,
}: ToolbarCheckboxProps) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <Label
        htmlFor={id}
        className="cursor-pointer text-[13px] font-normal text-muted-foreground transition-colors hover:text-foreground"
      >
        {label}
      </Label>
    </div>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onChange(v as T);
      }}
      variant="outline"
      size="sm"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
