import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanResult } from "@/features/planner/logic/core";
import type { TrackGraph } from "@/types/models";
import { ACTIONS, actionLabelFromStep } from "../logic/view-model";
import type { ActionLabel } from "../logic/view-model";
import { ResourceImg } from "./ResourceImg";

type ResultStatsModel = {
  byAction: Map<ActionLabel, number>;
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

type ResourceUsageItem = {
  key: ActionLabel;
  label: ActionLabel;
  value: number;
};

function useResultStatsModel(params: {
  result: PlanResult;
  catNameById: Map<number, string>;
}): ResultStatsModel {
  const { result, catNameById } = params;

  return useMemo(() => {
    const byAction = new Map<ActionLabel, number>();

    for (const action of ACTIONS) {
      byAction.set(action, 0);
    }

    for (const step of result.plan || []) {
      const action = actionLabelFromStep(step);
      byAction.set(action, (byAction.get(action) || 0) + 1);
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
}

function StatItem({
  label,
  value,
  labelClassName,
  valueClassName,
  compact = false,
}: {
  label: string;
  value: React.ReactNode;
  labelClassName?: string;
  valueClassName?: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "font-medium text-muted-foreground",
          compact ? "text-[12px]" : "text-[13px]",
          labelClassName,
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "font-semibold leading-none tracking-tight text-foreground",
          compact ? "text-[28px]" : "text-[30px]",
          valueClassName,
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function ResultStatsSidebar(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  catNameById: Map<number, string>;
  compact?: boolean;
}) {
  const { result, catNameById, compact = false } = props;
  const stats = useResultStatsModel({ result, catNameById });
  const resourceUsage = useMemo<ResourceUsageItem[]>(() => {
    const singleFood = stats.byAction.get("罐頭") || 0;
    const tenFood = stats.byAction.get("10連抽") || 0;
    const totalFood = singleFood * 150 + tenFood * 1500;

    return ACTIONS.reduce<ResourceUsageItem[]>((items, action) => {
      if (action === "10連抽") return items;

      if (action === "罐頭") {
        if (totalFood > 0) {
          items.push({ key: action, label: action, value: totalFood });
        }
        return items;
      }

      const count = stats.byAction.get(action) || 0;
      if (count > 0) {
        items.push({ key: action, label: action, value: count });
      }
      return items;
    }, []);
  }, [stats.byAction]);
  return (
    <div className="space-y-4">
      <div className="rounded-xl">
        <div className={cn("grid grid-cols-2", compact ? "gap-x-4 gap-y-6" : "gap-x-6 gap-y-5")}>
          <StatItem
            label="命中目標"
            value={`${result.targets_hit}/${result.targets_total}`}
            compact={compact}
          />
          <StatItem label="終點位置" value={result.final_cursor_id} compact={compact} />
          <StatItem label="抽卡步驟" value={result.plan?.length ?? 0} compact={compact} />
          <StatItem label="獲得貓咪" value={result.all_draws?.length ?? 0} compact={compact} />
        </div>
      </div>

      <section className="space-y-3 border-t border-border/45 pt-3.5">
        <div className="text-sm font-semibold text-foreground">資源消耗</div>
        <div className="flex flex-wrap gap-2">
          {resourceUsage.map((item) => (
              <div
                key={item.key}
                className="inline-flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
              >
                <ResourceImg label={item.label} height={18} showCount={false} />
                <span>× {item.value}</span>
              </div>
            ))}
          {resourceUsage.length === 0 ? (
            <Badge variant="muted">沒有消耗任何資源</Badge>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 border-t border-border/45 pt-3.5">
        <div className="text-sm font-semibold text-foreground">命中</div>
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
        </div>
      </section>

      {stats.missingTargets.length > 0 && (
        <section className="space-y-3 border-t border-border/45 pt-3.5">
          <div className="text-sm font-semibold text-foreground">未命中</div>
          <div className="flex flex-wrap gap-2">
            {stats.missingTargets.map((target) => (
              <Badge key={target.id} variant="outline" className="border-transparent text-red-500 shadow-none dark:text-red-400">
                {target.name}
              </Badge>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
