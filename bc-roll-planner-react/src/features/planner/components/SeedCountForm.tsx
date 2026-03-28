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
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="space-y-2">
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
          <p className="text-sm text-muted-foreground">
            請輸入目前抽卡 seed。留空時無法開始計算。
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Label htmlFor="planner-count">Count</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted" className="gap-1.5">
                  <Sparkles className="size-3.5" />
                  自動 count
                </Badge>
                <span className="text-sm font-medium text-foreground">
                  {autoCount}
                </span>
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

          <p className="text-sm text-muted-foreground">
            預設會依可用資源與起始位置自動估算搜尋上限。
          </p>

          {manualCountExpanded ? (
            <div className="space-y-2 rounded-3xl border border-border/70 bg-muted/40 p-4">
              <Input
                id="planner-count"
                name="count"
                autoComplete="off"
                inputMode="numeric"
                value={countInput}
                onChange={(event) => onCountInputChange(event.target.value)}
                placeholder="輸入正整數"
              />
              <p className="text-sm text-muted-foreground">
                {manualCount != null
                  ? `目前將使用手動 count：${manualCount}`
                  : "留空時會退回自動 count。"}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {countError ? <Alert variant="error">{countError}</Alert> : null}
    </section>
  );
}
