import { Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SeedForm(props: {
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
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div className="space-y-1.5">
        <Label htmlFor="planner-seed">種子碼</Label>
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

      <div className="space-y-2 border-t border-border/50 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="planner-count">Count</Label>
          <Button
            variant={manualCountExpanded ? "outline" : "ghost"}
            size="sm"
            onClick={onToggleManualCount}
          >
            {manualCountExpanded ? "改回自動" : "手動填入"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="muted" className="gap-1.5">
            <Sparkles className="size-3.5" />
            自動估算
          </Badge>
          <span className="font-medium text-foreground">{autoCount}</span>
        </div>

        {manualCountExpanded ? (
          <div className="space-y-2">
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
              <p className="text-sm text-muted-foreground">
                手動 count：{manualCount}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {countError ? (
        <Alert variant="error" className="lg:col-span-2">
          {countError}
        </Alert>
      ) : null}
    </section>
  );
}
