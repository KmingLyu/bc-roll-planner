import { useMemo } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanResult } from "@/features/planner/logic/core";
import type { TrackGraph } from "@/types/models";
import { getEventDisplayLines } from "@/utils/event-display";
import { ACTIONS, actionLabelFromStep } from "../logic/view-model";
import type { ActionLabel } from "../logic/view-model";
import { ResourceImg } from "./ResourceImg";

function StatCard({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function ResultStatsCard(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  catNameById: Map<number, string>;
}) {
  const { result, graphsByEvent, catNameById } = props;

  const stats = useMemo(() => {
    const byAction = new Map<ActionLabel, number>();
    const byEvent = new Map<string, number>();

    for (const action of ACTIONS) {
      byAction.set(action, 0);
    }

    for (const step of result.plan || []) {
      const action = actionLabelFromStep(step);
      byAction.set(action, (byAction.get(action) || 0) + 1);
      byEvent.set(
        step.event_value,
        (byEvent.get(step.event_value) || 0) + (step.draws?.length ?? 0),
      );
    }

    const hitSet = new Set(result.targets_hit_ids || []);
    const drawCountById = new Map<number, number>();
    for (const draw of result.all_draws || []) {
      if (draw.cat_id != null && hitSet.has(draw.cat_id)) {
        drawCountById.set(draw.cat_id, (drawCountById.get(draw.cat_id) || 0) + 1);
      }
    }

    return {
      byAction,
      byEvent,
      hitTargets: [...hitSet].map((id) => ({
        id,
        name: catNameById.get(id) ?? `#${id}`,
        count: drawCountById.get(id) || 1,
      })),
      missingTargets: (result.targets_missing_ids || []).map((id) => ({
        id,
        name: catNameById.get(id) ?? `#${id}`,
      })),
    };
  }, [catNameById, result]);

  const statusVariant = result.success
    ? "success"
    : result.targets_hit > 0
      ? "warning"
      : "error";

  return (
    <Card className="rounded-[32px] border-border/80 shadow-none">
      <CardHeader className="space-y-3">
        <CardTitle className="text-lg">結果統計</CardTitle>
        <Alert
          variant={statusVariant}
          title={result.success ? "規劃成功" : "尚未完全命中"}
        >
          {result.success
            ? "所有目標都已命中。"
            : result.targets_hit > 0
              ? "目前顯示的是最佳可行路徑，你可以調整條件後再試一次。"
              : "這條路徑沒有命中任何目標，請確認條件或資源設定。"}
        </Alert>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="命中目標" value={`${result.targets_hit}/${result.targets_total}`} />
          <StatCard label="終點位置" value={result.final_cursor_id} />
          <StatCard label="抽卡步驟" value={result.plan?.length ?? 0} />
          <StatCard label="獲得貓咪" value={result.all_draws?.length ?? 0} />
        </div>

        <div className="space-y-4">
          <section className="space-y-3">
            <div className="text-sm font-semibold text-foreground">資源消耗</div>
            <div className="flex flex-wrap gap-2">
              {Array.from(stats.byAction.entries())
                .filter(([, count]) => count > 0)
                .map(([action, count]) => (
                  <div
                    key={action}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <ResourceImg label={action} height={18} showCount={false} />
                    <span>× {count}</span>
                  </div>
                ))}
              {Array.from(stats.byAction.values()).every((count) => count === 0) ? (
                <Badge variant="muted">沒有消耗任何資源</Badge>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-sm font-semibold text-foreground">命中目標</div>
            <div className="flex flex-wrap gap-2">
              {stats.hitTargets.length ? (
                stats.hitTargets.map((target) => (
                  <Badge key={target.id} variant="success" className="gap-1.5">
                    {target.name}
                    {target.count > 1 ? ` × ${target.count}` : ""}
                  </Badge>
                ))
              ) : (
                <Badge variant="muted">尚未命中任何目標</Badge>
              )}
              {stats.missingTargets.map((target) => (
                <Badge key={target.id} variant="outline">
                  未命中：{target.name}
                </Badge>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-sm font-semibold text-foreground">event 分布</div>
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from(stats.byEvent.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([eventValue, drawCount]) => {
                  const eventMeta = graphsByEvent[eventValue]?.event ?? {
                    name: eventValue,
                    raw_name: eventValue,
                    start_date: null,
                    end_date: null,
                  };
                  const display = getEventDisplayLines(eventMeta);
                  return (
                    <div
                      key={eventValue}
                      className="rounded-3xl border border-border/70 bg-muted/30 px-4 py-3"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {display.dateText}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-foreground">
                        {display.nameText}
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        共抽了 {drawCount} 次
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
