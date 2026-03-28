import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import type { PlanResult } from "@/features/planner/logic/core";
import type { TrackGraph } from "@/types/models";
import { getEventDisplayLines } from "@/utils/event-display";
import { ACTIONS, actionLabelFromStep } from "../logic/view-model";
import type { ActionLabel } from "../logic/view-model";
import { ResourceImg } from "./ResourceImg";

type ResultStatsModel = {
  byAction: Map<ActionLabel, number>;
  byEvent: Array<{
    eventValue: string;
    drawCount: number;
    dateText: string;
    nameText: string;
  }>;
  hitTargets: Array<{
    id: number;
    name: string;
    count: number;
  }>;
  missingTargets: Array<{
    id: number;
    name: string;
  }>;
};

function useResultStatsModel(params: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  catNameById: Map<number, string>;
}): ResultStatsModel {
  const { result, graphsByEvent, catNameById } = params;

  return useMemo(() => {
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
      byEvent: Array.from(byEvent.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([eventValue, drawCount]) => {
          const eventMeta = graphsByEvent[eventValue]?.event ?? {
            name: eventValue,
            raw_name: eventValue,
            start_date: null,
            end_date: null,
          };
          const display = getEventDisplayLines(eventMeta);
          return {
            eventValue,
            drawCount,
            dateText: display.dateText,
            nameText: display.nameText,
          };
        }),
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
  }, [catNameById, graphsByEvent, result]);
}

function StatItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="text-[28px] font-semibold tracking-tight text-foreground">{value}</div>
    </div>
  );
}

export function ResultStatsSidebar(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  catNameById: Map<number, string>;
  compact?: boolean;
}) {
  const { result, graphsByEvent, catNameById, compact = false } = props;
  const stats = useResultStatsModel({ result, graphsByEvent, catNameById });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant={result.success ? "success" : "warning"}>
          {result.success ? "已命中全部目標" : "尚未完全命中"}
        </Badge>
      </div>

      <div className={compact ? "grid gap-4 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2"}>
        <StatItem label="命中目標" value={`${result.targets_hit}/${result.targets_total}`} />
        <StatItem label="終點位置" value={result.final_cursor_id} />
        <StatItem label="抽卡步驟" value={result.plan?.length ?? 0} />
        <StatItem label="獲得貓咪" value={result.all_draws?.length ?? 0} />
      </div>

      <section className="space-y-3 border-t border-border/45 pt-3.5">
        <div className="text-sm font-semibold text-foreground">資源消耗</div>
        <div className="flex flex-wrap gap-2">
          {Array.from(stats.byAction.entries())
            .filter(([, count]) => count > 0)
            .map(([action, count]) => (
              <div
                key={action}
                className="inline-flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
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

      <section className="space-y-3 border-t border-border/45 pt-3.5">
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

      <section className="space-y-3 border-t border-border/45 pt-3.5">
        <div className="text-sm font-semibold text-foreground">event 分布</div>
        {stats.byEvent.length ? (
          <div className="space-y-3">
            {stats.byEvent.map((event) => (
              <div key={event.eventValue} className="space-y-1 border-b border-border/40 pb-3 last:border-b-0 last:pb-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {event.dateText}
                </div>
                <div className="text-sm font-medium text-foreground">{event.nameText}</div>
                <div className="text-sm text-muted-foreground">{event.drawCount} 抽</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">沒有 event 資料</div>
        )}
      </section>
    </div>
  );
}
