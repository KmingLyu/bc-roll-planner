import NumberField from "@/components/inputs/NumberField";
import type { PlannerResources } from "@/features/planner/types";

function ResourceAdornment({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
    />
  );
}

type ResourceField = {
  key: keyof PlannerResources;
  label: string;
  src: string;
};

const RESOURCE_FIELDS: ResourceField[] = [
  { key: "tickets", label: "金券", src: "/稀有券.png" },
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
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
