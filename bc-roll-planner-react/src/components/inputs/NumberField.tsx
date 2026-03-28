import * as React from "react";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NumberField({
  id: idProp,
  label,
  error = false,
  startAdornment,
  className,
  inputProps,
  ...other
}: BaseNumberField.Root.Props & {
  label?: React.ReactNode;
  error?: boolean;
  startAdornment?: React.ReactNode;
  className?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}) {
  let id = React.useId();
  if (idProp) {
    id = idProp;
  }
  return (
    <BaseNumberField.Root {...other} className={cn("w-full", className)}>
      <div className="flex flex-col gap-2">
        {label ? (
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            "field-shell gap-2",
            error && "border-destructive ring-4 ring-destructive/10",
          )}
        >
          {startAdornment ? <span className="shrink-0">{startAdornment}</span> : null}
          <BaseNumberField.Decrement className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Minus className="size-4" />
          </BaseNumberField.Decrement>
          <BaseNumberField.Input
            id={id}
            className="h-10 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
            {...inputProps}
          />
          <BaseNumberField.Increment className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Plus className="size-4" />
          </BaseNumberField.Increment>
        </div>
      </div>
    </BaseNumberField.Root>
  );
}
