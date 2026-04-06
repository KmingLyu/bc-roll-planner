import * as React from "react";
import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlannerResources } from "@/features/planner/types";

function NumberField({
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
      <div className="flex flex-col gap-1">
        {label ? (
          <label htmlFor={id} className="text-[13px] font-medium text-foreground">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            "field-shell gap-1",
            error && "border-destructive ring-4 ring-destructive/10",
          )}
        >
          {startAdornment ? <span className="shrink-0">{startAdornment}</span> : null}
          <BaseNumberField.Decrement className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Minus className="size-4" />
          </BaseNumberField.Decrement>
          <BaseNumberField.Input
            id={id}
            className="h-8 min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
            {...inputProps}
          />
          <BaseNumberField.Increment className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Plus className="size-4" />
          </BaseNumberField.Increment>
        </div>
      </div>
    </BaseNumberField.Root>
  );
}

function ResourceAdornment({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={32}
      height={32}
      className="h-8 w-8 object-contain"
    />
  );
}

type ResourceField = {
  key: keyof PlannerResources;
  label: string;
  src: string;
};

const RESOURCE_FIELDS: ResourceField[] = [
  { key: "tickets", label: "稀有券", src: "/稀有券.png" },
  { key: "platinum_tickets", label: "白金券", src: "/白金券.png" },
  { key: "legend_tickets", label: "傳說券", src: "/傳說券.png" },
  { key: "food", label: "罐頭", src: "/貓罐頭.png" },
];

export function ResourceForm(props: {
  value: PlannerResources;
  onChange: (next: PlannerResources) => void;
}) {
  const { value, onChange } = props;

  return (
    <section className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {RESOURCE_FIELDS.map((field) => (
          <NumberField
            key={field.key}
            label={field.label}
            min={0}
            value={value[field.key]}
            inputProps={{
              name: field.key,
              autoComplete: "off",
            }}
            onValueChange={(nextValue) =>
              onChange({
                ...value,
                [field.key]: Math.max(0, nextValue ?? 0),
              })
            }
            startAdornment={
              <ResourceAdornment src={field.src} alt={field.label} />
            }
          />
        ))}
      </div>
    </section>
  );
}
