import { useMemo } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanResult } from "@/features/planner/logic/core";
import type { TrackGraph } from "@/types/models";
import type { ActionLabel } from "../logic/view-model";
import { ResourceImg } from "./ResourceImg";

type ResultSummaryModel = {
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
  key: string;
  label: ActionLabel;
  value: number;
  subtitle?: string | null;
};

function getHitStatValueClass(params: {
  success: boolean;
  targetsHit: number;
  targetsTotal: number;
}) {
  const { success, targetsHit, targetsTotal } = params;
  if (success) return "text-success";
  if (targetsTotal > 0 && targetsHit === 0) return "text-destructive";
  return "text-warning";
}

function getResultStatusMeta(params: {
  success: boolean;
  targetsHit: number;
  targetsTotal: number;
}) {
  const { success, targetsHit, targetsTotal } = params;
  if (success) {
    return {
      text: "已命中全部目標",
      icon: CheckCircle2,
      className: "text-success",
    };
  }
  if (targetsTotal > 0 && targetsHit === 0) {
    return {
      text: "未命中任何目標",
      icon: AlertCircle,
      className: "text-destructive",
    };
  }
  return {
    text: "尚未完全命中",
    icon: AlertCircle,
    className: "text-warning",
  };
}

function useResultSummaryModel(params: {
  result: PlanResult;
  catNameById: Map<number, string>;
}): ResultSummaryModel {
  const { result, catNameById } = params;

  return useMemo(() => {
    const hitSet = new Set(result.targets_hit_ids || []);
    const drawCountById = new Map<number, number>();
    for (const draw of result.all_draws || []) {
      if (draw.cat_id != null && hitSet.has(draw.cat_id)) {
        drawCountById.set(draw.cat_id, (drawCountById.get(draw.cat_id) || 0) + 1);
      }
    }

    return {
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

export function ResultSummary(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  catNameById: Map<number, string>;
  compact?: boolean;
}) {
  const { result, catNameById, compact = false } = props;
  const stats = useResultSummaryModel({ result, catNameById });
  const hitStatValueClass = getHitStatValueClass({
    success: result.success,
    targetsHit: result.targets_hit,
    targetsTotal: result.targets_total,
  });
  const resultStatusMeta = getResultStatusMeta({
    success: result.success,
    targetsHit: result.targets_hit,
    targetsTotal: result.targets_total,
  });
  const ResultStatusIcon = resultStatusMeta.icon;
  const resourceUsage = useMemo<ResourceUsageItem[]>(() => {
    const counts = new Map<string, number>();

    for (const step of result.plan || []) {
      const key =
        step.method === "step_up_3" ||
        step.method === "step_up_5" ||
        step.method === "step_up_7"
          ? step.method
          : `${step.resource}:${step.method}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const items: ResourceUsageItem[] = [];
    const ticketCount = counts.get("ticket:single") || 0;
    if (ticketCount > 0) {
      items.push({ key: "ticket", label: "稀有券", value: ticketCount });
    }

    const platinumCount = counts.get("platinum_ticket:single") || 0;
    if (platinumCount > 0) {
      items.push({ key: "platinum", label: "白金券", value: platinumCount });
    }

    const legendCount = counts.get("legend_ticket:single") || 0;
    if (legendCount > 0) {
      items.push({ key: "legend", label: "傳說券", value: legendCount });
    }

    const singleFoodCount = counts.get("food:single") || 0;
    if (singleFoodCount > 0) {
      items.push({ key: "food-single", label: "罐頭", value: singleFoodCount * 150 });
    }

    const tenFoodCount = counts.get("food:ten") || 0;
    if (tenFoodCount > 0) {
      items.push({ key: "food-ten", label: "10連抽", value: tenFoodCount * 1500 });
    }

    const stepUpConfigs = [
      { key: "step_up_3", value: 300 },
      { key: "step_up_5", value: 750 },
      { key: "step_up_7", value: 1050 },
    ] as const;

    for (const config of stepUpConfigs) {
      const count = counts.get(config.key) || 0;
      if (count <= 0) continue;
      items.push({
        key: config.key,
        label: "罐頭",
        value: config.value * count,
        subtitle: "好康轉蛋",
      });
    }

    return items;
  }, [result.plan]);
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "inline-flex items-center gap-2",
          compact ? "text-[13px]" : "text-sm",
          "font-semibold",
          resultStatusMeta.className,
        )}
      >
        <ResultStatusIcon className="size-4 shrink-0" strokeWidth={2.2} />
        <span>{resultStatusMeta.text}</span>
      </div>

      <div className="rounded-xl">
        <div className={cn("grid grid-cols-2", compact ? "gap-x-4 gap-y-6" : "gap-x-6 gap-y-5")}>
          <StatItem
            label="命中目標"
            value={`${result.targets_hit}/${result.targets_total}`}
            valueClassName={hitStatValueClass}
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
                <ResourceImg
                  label={item.label}
                  height={18}
                  showCount={false}
                  subtitle={item.subtitle}
                />
                <span>× {item.value}</span>
              </div>
            ))}
          {resourceUsage.length === 0 ? (
            <Badge variant="muted">沒有消耗任何資源</Badge>
          ) : null}
        </div>
      </section>

      {stats.hitTargets.length > 0 ? (
        <section className="space-y-3 border-t border-border/45 pt-3.5">
          <div className="text-sm font-semibold text-foreground">命中</div>
          <div className="flex flex-wrap gap-2">
            {stats.hitTargets.map((target) => (
              <Badge key={target.id} variant="success" className="gap-1.5">
                {target.name}
                {target.count > 1 ? ` × ${target.count}` : ""}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

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
