import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SeedCountForm(props: {
  seed: string;
  countInput: string;
  countError: string;
  autoCount: number;
  manualCount: number | null;
  manualCountExpanded: boolean;
  onSeedChange: (value: string) => void;
  onCountInputChange: (value: string) => void;
  onToggleManualCount: () => void;
}) {
  const {
    seed,
    countInput,
    countError,
    autoCount,
    manualCount,
    manualCountExpanded,
    onSeedChange,
    onCountInputChange,
    onToggleManualCount,
  } = props;

  return (
    <section className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="planner-seed">Seed</Label>
        <Input
          id="planner-seed"
          name="seed"
          autoComplete="off"
          inputMode="numeric"
          value={seed}
          onChange={(event) => onSeedChange(event.target.value)}
          placeholder="例如 1234"
        />
      </div>

      <div className="border-t border-border/60 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Label htmlFor="planner-count">Count</Label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="muted" className="gap-1.5">
                <Sparkles className="size-3.5" />
                自動 count
              </Badge>
              <span className="font-medium text-foreground">{autoCount}</span>
            </div>
          </div>

          <Button
            variant={manualCountExpanded ? "outline" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={onToggleManualCount}
          >
            {manualCountExpanded ? "改回自動" : "手動覆寫"}
          </Button>
        </div>

        {manualCountExpanded ? (
          <div className="mt-4 space-y-2">
            <Input
              id="planner-count"
              name="count"
              autoComplete="off"
              inputMode="numeric"
              value={countInput}
              onChange={(event) => onCountInputChange(event.target.value)}
              placeholder="輸入正整數"
            />
            {manualCount != null ? (
              <p className="text-sm text-muted-foreground">目前將使用手動 count：{manualCount}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      {countError ? <Alert variant="error">{countError}</Alert> : null}
    </section>
  );
}
