import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResourceImg } from "@/features/planner/components/ResourceImg";
import type { PlanResult } from "@/features/planner/logic/core";
import {
  buildDrawRows,
  makeEventColorPicker,
  type DrawRow,
} from "@/features/planner/logic/view-model";
import {
  buildGodfatCatHref,
  buildGodfatCatImageUrl,
} from "@/features/cats/urls";
import { BC_ENV } from "@/config/env";
import type { TrackGraph } from "@/types/models";
import { getEventDisplayLines } from "@/features/events/eventDisplay";
import { cn } from "@/lib/utils";

type ResultRowBlock =
  | { key: string; kind: "single"; row: DrawRow }
  | { key: string; kind: "ten"; summary: DrawRow; children: DrawRow[] };

type ResultFilterMode = "all" | "targets";
export type { ResultFilterMode };

type ResultEventGroup = {
  key: string;
  eventValue: string;
  anchorRow: DrawRow;
  blocks: ResultRowBlock[];
};

const RESULT_FILTER_OPTIONS: Array<{
  value: ResultFilterMode;
  label: string;
}> = [
  { value: "all", label: "全部步驟" },
  { value: "targets", label: "目標步驟" },
];
const RESULT_GRID_TRACKS = ["A", "B"] as const;

function eventLabel(row: DrawRow) {
  return getEventDisplayLines({
    name: row.eventName,
    raw_name: row.eventRawName,
    start_date: row.eventStartDate,
    end_date: row.eventEndDate,
  });
}

function groupRowsByEvent(rows: DrawRow[]) {
  const groups: Array<{ eventValue: string; rows: DrawRow[] }> = [];
  for (const row of rows) {
    const lastGroup = groups.at(-1);
    if (lastGroup?.eventValue === row.eventValue) {
      lastGroup.rows.push(row);
      continue;
    }
    groups.push({ eventValue: row.eventValue, rows: [row] });
  }
  return groups;
}

function groupRowsByStep(rows: DrawRow[]): ResultRowBlock[] {
  const blocks: ResultRowBlock[] = [];

  for (let index = 0; index < rows.length; ) {
    const row = rows[index];

    if (row.isTen && row.isHeader) {
      const children: DrawRow[] = [];
      index += 1;

      while (
        index < rows.length &&
        rows[index].isTen &&
        rows[index].stepIndex === row.stepIndex &&
        !rows[index].isHeader
      ) {
        children.push(rows[index]);
        index += 1;
      }

      blocks.push({
        key: row.key,
        kind: "ten",
        summary: row,
        children,
      });
      continue;
    }

    blocks.push({
      key: row.key,
      kind: "single",
      row,
    });
    index += 1;
  }

  return blocks;
}

function blockHasTarget(block: ResultRowBlock) {
  if (block.kind === "single") return block.row.isTarget;
  return block.summary.isTarget || block.children.some((row) => row.isTarget);
}

function getVisibleBlock(block: ResultRowBlock, filterMode: ResultFilterMode) {
  if (filterMode === "all") return block;

  if (block.kind === "single") {
    return block.row.isTarget ? block : null;
  }

  if (!blockHasTarget(block)) return null;

  return {
    ...block,
    children: block.children.filter((row) => row.isTarget),
  };
}

function filterResultBlocks(
  blocks: ResultRowBlock[],
  filterMode: ResultFilterMode,
) {
  return blocks.reduce<ResultRowBlock[]>((visibleBlocks, block) => {
    const visibleBlock = getVisibleBlock(block, filterMode);
    if (visibleBlock) visibleBlocks.push(visibleBlock);
    return visibleBlocks;
  }, []);
}

function buildVisibleEventGroups(params: {
  rows: DrawRow[];
  filterMode: ResultFilterMode;
}) {
  const { rows, filterMode } = params;

  return groupRowsByEvent(rows).reduce<ResultEventGroup[]>(
    (groups, group, gi) => {
      const blocks = filterResultBlocks(
        groupRowsByStep(group.rows),
        filterMode,
      );
      if (!blocks.length) return groups;

      groups.push({
        key: `${group.eventValue}__${gi}`,
        eventValue: group.eventValue,
        anchorRow: group.rows[0],
        blocks,
      });
      return groups;
    },
    [],
  );
}

function buildHitStepStats(params: {
  result: PlanResult;
  targetCatIds: number[];
}) {
  const { result, targetCatIds } = params;
  const targetIdSet = new Set(targetCatIds);
  const plan = result.plan || [];
  let hitSteps = 0;

  for (const step of plan) {
    const hasHit = (step.draws || []).some(
      (draw) => draw.cat_id != null && targetIdSet.has(draw.cat_id),
    );

    if (hasHit) hitSteps += 1;
  }

  return {
    hitSteps,
    totalSteps: plan.length,
  };
}

function trackPositionLabel(row: DrawRow, track: "A" | "B") {
  if (row.isTen && row.isHeader) return `${track}摘要`;
  if (row.isGuaranteedRow) {
    return row.track === track ? "保底" : "-";
  }
  return row.pos != null ? `${row.pos}${track}` : track;
}

function trackDotClass(row: DrawRow, track: "A" | "B") {
  const isTarget = track === "A" ? row.isTargetA : row.isTargetB;
  const status = track === "A" ? row.statusA : row.statusB;

  if (isTarget) return "bg-success";
  if (status === "guaranteed") return "bg-[hsl(281,82%,70%)]";
  if (status === "hit") return "bg-[hsl(52,100%,54%)]";
  return "bg-border";
}

function trackLabelClass(row: DrawRow, track: "A" | "B") {
  const isTarget = track === "A" ? row.isTargetA : row.isTargetB;
  const status = track === "A" ? row.statusA : row.statusB;

  if (isTarget) return "text-success";
  if (status === "guaranteed") return "text-[hsl(281,62%,48%)]";
  if (status === "hit") return "text-[hsl(44,95%,38%)]";
  return "text-muted-foreground";
}

function trackFrameClass(row: DrawRow, track: "A" | "B", compact: boolean) {
  const isTarget = track === "A" ? row.isTargetA : row.isTargetB;

  if (isTarget) {
    return cn(
      "rounded-[8px] border border-success/30 bg-success/5",
      compact ? "px-3 py-2" : "px-3.5 py-2.5",
    );
  }

  return compact ? "px-3 py-2" : "px-3.5 py-2.5";
}

function shouldShowTrackDot(row: DrawRow, track: "A" | "B") {
  return !(row.isGuaranteedRow && row.track !== track);
}

function buildTenRollSummary(value: string) {
  if (!value || value === "-") {
    return {
      hitCount: 0,
      summaryText: "未命中",
      namesText: "",
    };
  }

  const names = value.split("、").filter(Boolean);
  return {
    hitCount: names.length,
    summaryText: `命中 ${names.length} 隻`,
    namesText: value,
  };
}

function getTenRollEndSnapshot(row: DrawRow, children: DrawRow[]) {
  if (row.pos == null) {
    return {
      endPos: null,
      endTrack: row.track === "A" || row.track === "B" ? row.track : "A",
    };
  }

  const lastChildWithIndex = [...children]
    .reverse()
    .find(
      (child) =>
        !child.isGuaranteedRow &&
        child.pos != null &&
        (child.track === "A" || child.track === "B"),
    );

  if (!lastChildWithIndex) {
    if (row.endPos != null && (row.endTrack === "A" || row.endTrack === "B")) {
      return {
        endPos: row.endPos,
        endTrack: row.endTrack,
      };
    }

    return {
      endPos: null,
      endTrack: row.track === "A" || row.track === "B" ? row.track : "A",
    };
  }

  return {
    endPos: lastChildWithIndex.pos,
    endTrack: lastChildWithIndex.track,
  };
}

function buildTenRollRangeLabel(
  row: DrawRow,
  track: "A" | "B",
  children: DrawRow[],
) {
  if (row.pos == null) return track;
  const { endPos } = getTenRollEndSnapshot(row, children);
  if (endPos == null) return track;
  return `${row.pos}${track}~${endPos}${track}`;
}

function resolveActiveTrack(row: DrawRow): "A" | "B" {
  if (row.track === "A" || row.track === "B") return row.track;
  return row.statusA !== "normal" ? "A" : "B";
}

function buildMobileTenRollCombinedRangeLabel(
  row: DrawRow,
  children: DrawRow[],
) {
  const startTrack = row.track === "A" || row.track === "B" ? row.track : "A";
  const startPos = row.pos;
  const startLabel = startPos != null ? `${startPos}${startTrack}` : startTrack;

  if (startPos == null) return startLabel;
  const { endPos, endTrack } = getTenRollEndSnapshot(row, children);
  if (endPos == null) return startLabel;
  return `${startLabel}~${endPos}${endTrack}`;
}

function ActionVisual({
  label,
  compact = false,
}: {
  label: DrawRow["actionText"];
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center",
        compact ? "w-[94px]" : "w-[102px] xl:w-[118px]",
      )}
    >
      <ResourceImg
        label={label}
        height={compact ? 28 : 36}
        className={cn(
          "justify-start",
          compact
            ? "[&_span]:text-[13px] [&_span]:font-bold"
            : "[&_span]:text-[15px] xl:[&_span]:text-[16px] [&_span]:font-bold",
        )}
      />
    </div>
  );
}

function ResultCatPreview({
  catId,
  compact = false,
}: {
  catId: number | null;
  compact?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!catId) return null;

  const href = buildGodfatCatHref(catId, {
    lang: BC_ENV.lang,
    ui: BC_ENV.ui,
  });
  const imageUrl = buildGodfatCatImageUrl(catId, { lang: BC_ENV.lang });

  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "relative inline-flex shrink-0 items-start justify-center overflow-hidden transition-opacity hover:opacity-85",
        compact ? "size-[60px]" : "size-[60px] xl:size-[72px]",
      )}
      aria-label={`查看貓咪 #${catId}`}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          width={compact ? 66 : 80}
          height={compact ? 66 : 80}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className={cn(
            "pointer-events-none select-none object-contain object-top",
            compact
              ? "mt-[-2px] size-[66px]"
              : "mt-[-3px] size-[68px] xl:mt-[-4px] xl:size-[80px]",
          )}
        />
      ) : (
        <span
          className={cn(
            "inline-flex size-full items-center justify-center font-medium text-muted-foreground",
            compact ? "text-xs" : "text-[13px]",
          )}
        >
          #{catId}
        </span>
      )}
    </a>
  );
}

function TenRollSummaryCell(props: {
  row: DrawRow;
  track: "A" | "B";
  children: DrawRow[];
  compact?: boolean;
  hideWhenNotTarget?: boolean;
}) {
  const { row, track, children, compact = false, hideWhenNotTarget = false } =
    props;
  const value = track === "A" ? row.A : row.B;
  const isHit = track === "A" ? row.isTargetA : row.isTargetB;
  const summary = buildTenRollSummary(value);
  const rangeLabel = buildTenRollRangeLabel(row, track, children);

  const otherIsHit = track === "A" ? row.isTargetB : row.isTargetA;

  if (hideWhenNotTarget && !isHit) {
    return (
      <div
        className={cn(
          "px-4 py-3",
          compact ? "space-y-1.5 px-3 py-2.5" : "space-y-2",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
            compact ? "text-[12px]" : "text-[15px]",
          )}
        >
          <span
            className={cn(
              compact ? "size-3" : "size-3.5",
              "rounded-full",
              trackDotClass(row, track),
            )}
          />
          <span>{rangeLabel}</span>
        </div>
        <div
          className={cn(
            "font-semibold text-muted-foreground",
            compact ? "text-[16px] leading-5" : "text-[20px] leading-6",
          )}
        >
          -
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "px-4 py-3",
        compact ? "space-y-1.5 px-3 py-2.5" : "space-y-2",
        isHit ? "rounded-[8px] border border-success/30 bg-success/5" : "",
        !isHit && otherIsHit ? "opacity-40" : "",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.12em]",
          compact ? "text-[12px]" : "text-[15px]",
          isHit ? "text-success" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            compact ? "size-3" : "size-3.5",
            "rounded-full",
            trackDotClass(row, track),
          )}
        />
        <span>{rangeLabel}</span>
      </div>
      {isHit ? (
        <>
          <div
            className={cn(
              "font-semibold text-success",
              compact ? "text-[16px] leading-5" : "text-[20px] leading-6",
            )}
          >
            {summary.summaryText}
          </div>
          {summary.namesText ? (
            <div
              className={cn(
                "font-medium text-foreground",
                compact ? "text-[14px] leading-5" : "text-[17px] leading-6",
              )}
            >
              {summary.namesText}
            </div>
          ) : null}
        </>
      ) : (
        <div
          className={cn(
            "font-semibold text-muted-foreground",
            compact ? "text-[16px] leading-5" : "text-[20px] leading-6",
          )}
        >
          -
        </div>
      )}
    </div>
  );
}

function MobileTenRollCombinedSummary(props: {
  row: DrawRow;
  children: DrawRow[];
}) {
  const { row, children } = props;
  const summaryA = buildTenRollSummary(row.A);
  const summaryB = buildTenRollSummary(row.B);
  const isHit = row.isTargetA || row.isTargetB;
  const namesText = [summaryA.namesText, summaryB.namesText]
    .filter(Boolean)
    .join("、");
  const hitCount = summaryA.hitCount + summaryB.hitCount;
  const rangeLabel = buildMobileTenRollCombinedRangeLabel(row, children);

  return (
    <div
      className={cn(
        "space-y-1.5 rounded-[8px] border px-3 py-2.5",
        isHit
          ? "border-success/30 bg-success/5"
          : "border-border/35 bg-muted/10",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em]",
          isHit ? "text-success" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "size-3 rounded-full",
            isHit ? "bg-success" : "bg-border",
          )}
        />
        <span>{rangeLabel}</span>
      </div>
      <div
        className={cn(
          "pl-5 text-[15px] leading-5",
          isHit
            ? "font-medium text-foreground"
            : "font-semibold text-muted-foreground",
        )}
      >
        {isHit ? `命中 ${hitCount} 隻｜${namesText}` : "-"}
      </div>
    </div>
  );
}

function ResultTrackCell(props: {
  row: DrawRow;
  track: "A" | "B";
  compact?: boolean;
  hideWhenNotTarget?: boolean;
}) {
  const { row, track, compact = false, hideWhenNotTarget = false } = props;
  const value = track === "A" ? row.A : row.B;
  const catId = track === "A" ? row.catIdA : row.catIdB;
  const thisStatus = track === "A" ? row.statusA : row.statusB;
  const otherStatus = track === "A" ? row.statusB : row.statusA;
  const isTrackTarget = track === "A" ? row.isTargetA : row.isTargetB;
  const shouldDim =
    row.isVirtual || (thisStatus === "normal" && otherStatus !== "normal");
  const isGuaranteedOtherTrack =
    row.isGuaranteedRow && row.track != null && row.track !== track;

  if (hideWhenNotTarget && !isTrackTarget) {
    return (
      <div
        className={cn(
          "flex h-full items-start px-3.5 py-2.5 text-xl font-semibold text-muted-foreground",
          compact ? "px-3 py-2 text-lg" : "",
        )}
      >
        <span>-</span>
      </div>
    );
  }

  if (isGuaranteedOtherTrack) {
    return (
      <div
        className={cn(
          "flex h-full items-start px-3.5 py-2.5 text-xl font-semibold text-muted-foreground",
          compact ? "px-3 py-2 text-lg" : "",
        )}
      >
        <span>-</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        compact ? "space-y-1.5" : "space-y-2",
        trackFrameClass(row, track, compact),
        shouldDim ? "opacity-40" : "",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 font-semibold uppercase tracking-[0.1em]",
          compact ? "text-[13px]" : "text-[15px]",
          trackLabelClass(row, track),
        )}
      >
        {shouldShowTrackDot(row, track) ? (
          <span
            className={cn(
              compact ? "size-3" : "size-3.5",
              "rounded-full",
              trackDotClass(row, track),
            )}
          />
        ) : null}
        <span>{trackPositionLabel(row, track)}</span>
      </div>

      <div
        className={cn(
          "flex items-start",
          compact ? "gap-3" : "gap-2.5 xl:gap-3.5",
        )}
      >
        <ResultCatPreview catId={catId} compact={compact} />
        <div className="min-w-0">
          <div
            className={cn(
              "font-semibold text-foreground",
              compact
                ? "text-[18px] leading-5"
                : "whitespace-nowrap text-[18px] leading-[1.15] xl:text-[22px] xl:leading-7",
            )}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultActionCell(props: { row: DrawRow; compact?: boolean }) {
  const { row, compact = false } = props;

  if (row.isVirtual) {
    return <div className={compact ? "h-0" : "h-0"} />;
  }

  if (row.isTen && !row.isHeader) {
    return <div className="h-5" />;
  }

  return (
    <div
      className={cn(
        "flex w-full items-center",
        compact ? "gap-2.5" : "gap-2.5 xl:gap-3",
      )}
    >
      {row.stepText !== "-" ? (
        <Badge
          variant={row.isTarget ? "success" : "muted"}
          className={cn(
            compact
              ? "px-2.5 py-0.5 text-[13px] font-semibold"
              : "whitespace-nowrap px-2.5 py-1 text-[14px] font-semibold xl:px-3 xl:text-[15px]",
          )}
        >
          {row.stepText}
        </Badge>
      ) : null}
      <ActionVisual label={row.actionText} compact={compact} />
    </div>
  );
}

function ResultTenRollToggle(props: {
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const { expanded, onToggle, compact = false } = props;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center justify-end gap-1.5 rounded-[6px] px-2 py-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
        compact ? "text-[13px]" : "text-[15px] font-medium",
      )}
      aria-expanded={expanded}
      aria-label={expanded ? "收合 10 連抽明細" : "展開 10 連抽明細"}
    >
      <span className="whitespace-nowrap">{expanded ? "收合" : "展開"}</span>
      {expanded ? (
        <ChevronUp className="size-4" />
      ) : (
        <ChevronDown className="size-4" />
      )}
    </button>
  );
}

function ResultFilterToolbar(props: {
  filterMode: ResultFilterMode;
  onFilterModeChange: (next: ResultFilterMode) => void;
}) {
  const { filterMode, onFilterModeChange } = props;

  return (
    <div className="workspace-toolbar flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm font-semibold text-foreground">規劃結果</div>

      <div
        className="flex w-full items-stretch gap-1 rounded-[10px] bg-muted/50 p-1 sm:w-auto"
        role="group"
        aria-label="結果篩選"
      >
        {RESULT_FILTER_OPTIONS.map((option) => {
          const active = option.value === filterMode;

          return (
            <Button
              key={option.value}
              variant="ghost"
              size="sm"
              aria-pressed={active}
              onClick={() => onFilterModeChange(option.value)}
              className={cn(
                "h-9 flex-1 rounded-[7px] px-4 text-[13px] font-semibold shadow-none transition-all sm:h-8 sm:flex-none",
                active && option.value === "all"
                  ? "!bg-background !text-foreground shadow-sm ring-1 ring-border/50"
                  : active && option.value === "targets"
                    ? "!bg-emerald-50 !text-emerald-700 shadow-sm ring-1 ring-emerald-200/60"
                    : option.value === "targets"
                      ? "text-muted-foreground hover:!bg-emerald-50/50 hover:!text-emerald-600"
                      : "text-muted-foreground hover:bg-background/60",
              )}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function ResultsEmptyState() {
  return (
    <div className="border-t border-border/35 bg-muted/[0.12] px-4 py-8 text-center sm:px-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <div className="text-sm font-medium text-muted-foreground">
          沒有結果
        </div>
      </div>
    </div>
  );
}

function ResultsDesktopTable(props: {
  groups: ResultEventGroup[];
  filterMode: ResultFilterMode;
}) {
  const { groups, filterMode } = props;
  const hideNonTargetTracks = filterMode === "targets";
  const [expandedTenRows, setExpandedTenRows] = useState<
    Record<string, boolean>
  >({});
  const colorPicker = useMemo(
    () => makeEventColorPicker(groups.map((group) => group.eventValue)),
    [groups],
  );

  const toggleTenRow = (key: string) =>
    setExpandedTenRows((current) => ({
      ...current,
      [key]: !current[key],
    }));

  return (
    <div className="hidden lg:block">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[33%]" />
          <col className="w-[33%]" />
          <col className="w-[92px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-border/50 bg-muted/20">
            <th className="px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Action
            </th>
            <th className="px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              A
            </th>
            <th className="px-3 py-2.5 text-left text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              B
            </th>
            <th className="w-[92px] px-3 py-2.5 text-right text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="sr-only">Toggle</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const label = eventLabel(group.anchorRow);
            const accentColor = colorPicker.colorOf(group.eventValue);
            const accentTint = colorPicker.tintOf(group.eventValue);

            return (
              <Fragment key={group.key}>
                <tr className="border-b border-border/35">
                  <th
                    colSpan={4}
                    className="sticky top-0 z-20 px-3 py-1.5 text-left"
                    style={{
                      backgroundColor: "hsl(var(--card))",
                      backgroundImage: `linear-gradient(0deg, ${accentTint}, ${accentTint})`,
                      boxShadow: `inset 3px 0 0 ${accentColor}`,
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline">{label.dateText}</Badge>
                      <div className="text-sm font-semibold text-foreground">
                        {label.nameText}
                      </div>
                    </div>
                  </th>
                </tr>

                {group.blocks.map((rawBlock) => {
                  const block = getVisibleBlock(rawBlock, filterMode);
                  if (!block) return null;

                  if (block.kind === "single") {
                    const row = block.row;
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-border/35 align-top last:border-b-0"
                      >
                        <td
                          className="px-3 py-1.5"
                          style={{ boxShadow: `inset 3px 0 0 ${accentColor}` }}
                        >
                          <ResultActionCell row={row} />
                        </td>
                        <td className="px-3 py-1.5">
                          <ResultTrackCell
                            row={row}
                            track="A"
                            hideWhenNotTarget={hideNonTargetTracks}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <ResultTrackCell
                            row={row}
                            track="B"
                            hideWhenNotTarget={hideNonTargetTracks}
                          />
                        </td>
                        <td className="px-3 py-1.5" />
                      </tr>
                    );
                  }

                  const isExpanded = !!expandedTenRows[block.summary.key];

                  return (
                    <Fragment key={block.key}>
                      <tr className="border-b border-border/35 align-top">
                        <td
                          className="px-3 py-1.5"
                          style={{ boxShadow: `inset 3px 0 0 ${accentColor}` }}
                        >
                          <ResultActionCell row={block.summary} />
                        </td>
                        <td className="px-3 py-1.5">
                          <TenRollSummaryCell
                            row={block.summary}
                            track="A"
                            children={block.children}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <TenRollSummaryCell
                            row={block.summary}
                            track="B"
                            children={block.children}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <ResultTenRollToggle
                            expanded={isExpanded}
                            onToggle={() => toggleTenRow(block.summary.key)}
                          />
                        </td>
                      </tr>

                      {isExpanded
                        ? block.children.map((row) => (
                            <tr
                              key={row.key}
                              className="border-b border-border/35 align-top last:border-b-0"
                            >
                              <td
                                className="px-3 py-1.5"
                                style={{
                                  boxShadow: `inset 3px 0 0 ${accentColor}`,
                                }}
                              >
                                <ResultActionCell row={row} />
                              </td>
                              <td className="px-3 py-1.5">
                                <ResultTrackCell
                                  row={row}
                                  track="A"
                                  hideWhenNotTarget={hideNonTargetTracks}
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <ResultTrackCell
                                  row={row}
                                  track="B"
                                  hideWhenNotTarget={hideNonTargetTracks}
                                />
                              </td>
                              <td className="px-3 py-1.5" />
                            </tr>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ResultsMobileCards(props: {
  groups: ResultEventGroup[];
  filterMode: ResultFilterMode;
}) {
  const { groups, filterMode } = props;
  const hideNonTargetTracks = filterMode === "targets";
  const [expandedTenRows, setExpandedTenRows] = useState<
    Record<string, boolean>
  >({});
  const colorPicker = useMemo(
    () => makeEventColorPicker(groups.map((group) => group.eventValue)),
    [groups],
  );

  const toggleTenRow = (key: string) =>
    setExpandedTenRows((current) => ({
      ...current,
      [key]: !current[key],
    }));

  return (
    <div className="space-y-4 lg:hidden">
      {groups.map((group) => {
        const accentColor = colorPicker.colorOf(group.eventValue);
        const accentTint = colorPicker.tintOf(group.eventValue);
        const label = eventLabel(group.anchorRow);

        return (
          <div
            key={group.key}
            className="workspace-pane"
            style={{ boxShadow: `inset 3px 0 0 ${accentColor}` }}
          >
            <div
              className="sticky top-0 z-20 border-b border-border/35 px-3.5 py-3"
              style={{
                backgroundColor: "hsl(var(--card))",
                backgroundImage: `linear-gradient(0deg, ${accentTint}, ${accentTint})`,
                boxShadow: `inset 3px 0 0 ${accentColor}`,
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{label.dateText}</Badge>
                <div className="text-sm font-semibold text-foreground">
                  {label.nameText}
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/35">
              {group.blocks.map((rawBlock) => {
                const block = getVisibleBlock(rawBlock, filterMode);
                if (!block) return null;

                if (block.kind === "single") {
                  const row = block.row;
                  const activeTrack = resolveActiveTrack(row);
                  return (
                    <div key={row.key} className="space-y-3 p-3.5">
                      <ResultActionCell row={row} compact />
                      <div className="pt-1 sm:hidden">
                        <ResultTrackCell
                          row={row}
                          track={activeTrack}
                          compact
                        />
                      </div>
                      <div className="hidden gap-4 pt-1 sm:grid sm:grid-cols-2">
                        {RESULT_GRID_TRACKS.map((track) => (
                          <ResultTrackCell
                            key={`${row.key}-${track}`}
                            row={row}
                            track={track}
                            compact
                            hideWhenNotTarget={hideNonTargetTracks}
                          />
                        ))}
                      </div>
                    </div>
                  );
                }

                const isExpanded = !!expandedTenRows[block.summary.key];

                return (
                  <div key={block.key} className="space-y-3 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <ResultActionCell row={block.summary} compact />
                      <ResultTenRollToggle
                        expanded={isExpanded}
                        onToggle={() => toggleTenRow(block.summary.key)}
                        compact
                      />
                    </div>
                    <div className="pt-1 sm:hidden">
                      <MobileTenRollCombinedSummary
                        row={block.summary}
                        children={block.children}
                      />
                    </div>
                    <div className="hidden gap-4 pt-1 sm:grid sm:grid-cols-2">
                      {RESULT_GRID_TRACKS.map((track) => (
                        <TenRollSummaryCell
                          key={`${block.summary.key}-${track}`}
                          row={block.summary}
                          track={track}
                          children={block.children}
                          compact
                          hideWhenNotTarget={hideNonTargetTracks}
                        />
                      ))}
                    </div>

                    {isExpanded ? (
                      <div className="space-y-3 border-t border-border/35 pt-3">
                        {block.children.map((row) => {
                          const activeTrack = resolveActiveTrack(row);
                          return (
                            <div key={row.key} className="space-y-3">
                              <ResultActionCell row={row} compact />
                              <div className="sm:hidden">
                                <ResultTrackCell
                                  row={row}
                                  track={activeTrack}
                                  compact
                                />
                              </div>
                              <div className="hidden gap-4 sm:grid sm:grid-cols-2">
                                {RESULT_GRID_TRACKS.map((track) => (
                                  <ResultTrackCell
                                    key={`${row.key}-${track}`}
                                    row={row}
                                    track={track}
                                    compact
                                    hideWhenNotTarget={hideNonTargetTracks}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ResultTable(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  targetCatIds: number[];
  catNameById: Map<number, string>;
  filterMode: ResultFilterMode;
  onFilterModeChange: (next: ResultFilterMode) => void;
}) {
  const {
    result,
    graphsByEvent,
    targetCatIds,
    catNameById,
    filterMode,
    onFilterModeChange,
  } = props;

  const rows = useMemo(
    () =>
      buildDrawRows({
        result,
        graphsByEvent,
        targetIdSet: new Set(targetCatIds),
        catNameById,
      }),
    [catNameById, graphsByEvent, result, targetCatIds],
  );
  const { hitSteps } = useMemo(
    () => buildHitStepStats({ result, targetCatIds }),
    [result, targetCatIds],
  );
  const desktopGroups = useMemo(
    () => buildVisibleEventGroups({ rows, filterMode }),
    [filterMode, rows],
  );
  const mobileRows = useMemo(
    () => rows.filter((row) => !row.isVirtual),
    [rows],
  );
  const mobileGroups = useMemo(
    () => buildVisibleEventGroups({ rows: mobileRows, filterMode }),
    [filterMode, mobileRows],
  );
  const hasVisibleContent = desktopGroups.length > 0 || mobileGroups.length > 0;
  const showEmptyState =
    (filterMode === "targets" && hitSteps === 0) || !hasVisibleContent;

  return (
    <div className="space-y-0">
      <ResultFilterToolbar
        filterMode={filterMode}
        onFilterModeChange={onFilterModeChange}
      />
      {showEmptyState ? (
        <ResultsEmptyState />
      ) : (
        <>
          <ResultsDesktopTable groups={desktopGroups} filterMode={filterMode} />
          <ResultsMobileCards groups={mobileGroups} filterMode={filterMode} />
        </>
      )}
    </div>
  );
}
