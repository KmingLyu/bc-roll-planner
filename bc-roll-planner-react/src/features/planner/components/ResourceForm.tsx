import { ChevronDown } from "lucide-react";
import NumberField from "@/components/inputs/NumberField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  PlannerResources,
  PlannerUiConfig,
} from "@/features/planner/types";
import { cn } from "@/lib/utils";

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
  cfg: PlannerUiConfig;
  advancedOpen: boolean;
  onChange: (next: PlannerResources) => void;
  onCfgChange: (next: PlannerUiConfig) => void;
  onToggleAdvanced: () => void;
}) {
  const { value, cfg, advancedOpen, onChange, onCfgChange, onToggleAdvanced } =
    props;

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

      <div className="rounded-3xl border border-border/70 bg-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">進階設定</div>
            <div className="text-sm text-muted-foreground">
              只有在你要覆寫起始位置或搜尋上限時才需要修改。
            </div>
          </div>
          <Button
            variant={advancedOpen ? "outline" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={onToggleAdvanced}
          >
            {advancedOpen ? "收合" : "展開"}
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                advancedOpen && "rotate-180",
              )}
            />
          </Button>
        </div>

        {advancedOpen ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="planner-start-pos">start_pos_id</Label>
              <Input
                id="planner-start-pos"
                name="start_pos_id"
                autoComplete="off"
                value={cfg.start_pos_id}
                onChange={(event) =>
                  onCfgChange({ ...cfg, start_pos_id: event.target.value })
                }
                placeholder="例如 1A"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="planner-max-expansions">max_expansions</Label>
              <Input
                id="planner-max-expansions"
                name="max_expansions"
                autoComplete="off"
                inputMode="numeric"
                value={String(cfg.max_expansions)}
                onChange={(event) =>
                  onCfgChange({
                    ...cfg,
                    max_expansions: Number(event.target.value || 0),
                  })
                }
                placeholder="例如 200000"
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
