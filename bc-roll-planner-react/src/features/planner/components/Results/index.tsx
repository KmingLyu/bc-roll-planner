import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
} from "@/features/cats/presentation/godfat";
import { BC_ENV } from "@/config/bcEnv";
import type { TrackGraph } from "@/types/models";
import { getEventDisplayLines } from "@/utils/event-display";
import { cn } from "@/lib/utils";

type ResultRowBlock =
  | { key: string; kind: "single"; row: DrawRow }
  | { key: string; kind: "ten"; summary: DrawRow; children: DrawRow[] };

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
        compact ? "w-[94px]" : "w-[118px]",
      )}
    >
      <ResourceImg
        label={label}
        height={compact ? 28 : 36}
        className={cn(
          "justify-start",
          compact
            ? "[&_span]:text-[13px] [&_span]:font-bold"
            : "[&_span]:text-[16px] [&_span]:font-bold",
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
        compact ? "size-[60px]" : "size-[72px]",
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
            compact ? "mt-[-2px] size-[66px]" : "mt-[-4px] size-[80px]",
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
}) {
  const { row, track, children, compact = false } = props;
  const value = track === "A" ? row.A : row.B;
  const isHit = track === "A" ? row.isTargetA : row.isTargetB;
  const summary = buildTenRollSummary(value);
  const rangeLabel = buildTenRollRangeLabel(row, track, children);

  const otherIsHit = track === "A" ? row.isTargetB : row.isTargetA;

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
        isHit ? "border-success/30 bg-success/5" : "border-border/35 bg-muted/10",
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
          isHit ? "font-medium text-foreground" : "font-semibold text-muted-foreground",
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
}) {
  const { row, track, compact = false } = props;
  const value = track === "A" ? row.A : row.B;
  const catId = track === "A" ? row.catIdA : row.catIdB;
  const thisStatus = track === "A" ? row.statusA : row.statusB;
  const otherStatus = track === "A" ? row.statusB : row.statusA;
  const shouldDim = thisStatus === "normal" && otherStatus !== "normal";
  const isGuaranteedOtherTrack =
    row.isGuaranteedRow && row.track != null && row.track !== track;

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
    <div className={cn(compact ? "space-y-1.5" : "space-y-2", trackFrameClass(row, track, compact), shouldDim ? "opacity-40" : "")}>
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

      <div className={cn("flex items-start", compact ? "gap-3" : "gap-3.5")}>
        <ResultCatPreview catId={catId} compact={compact} />
        <div className="min-w-0">
          <div
            className={cn(
              "font-semibold text-foreground",
              compact ? "text-[18px] leading-5" : "text-[22px] leading-7",
            )}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultActionCell(props: {
  row: DrawRow;
  compact?: boolean;
}) {
  const { row, compact = false } = props;

  if (row.isTen && !row.isHeader) {
    return <div className="h-5" />;
  }

  return (
    <div className={cn("flex w-full items-center", compact ? "gap-2.5" : "gap-3")}>
      {row.stepText !== "-" ? (
        <Badge
          variant={row.isTarget ? "success" : "muted"}
          className={cn(
            compact
              ? "px-2.5 py-0.5 text-[13px] font-semibold"
              : "px-3 py-1 text-[15px] font-semibold",
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

function ResultsDesktopTable({ rows }: { rows: DrawRow[] }) {
  const [expandedTenRows, setExpandedTenRows] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => groupRowsByEvent(rows), [rows]);
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
    <div className="hidden lg:block overflow-x-auto">
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
            const label = eventLabel(group.rows[0]);
            const accentColor = colorPicker.colorOf(group.eventValue);
            const accentTint = colorPicker.tintOf(group.eventValue);
            const blocks = groupRowsByStep(group.rows);

            return (
              <Fragment key={group.eventValue}>
                <tr
                  className="border-b border-border/35"
                  style={{ backgroundColor: accentTint }}
                >
                  <td
                    colSpan={4}
                    className="px-3 py-1.5"
                    style={{ boxShadow: `inset 3px 0 0 ${accentColor}` }}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline">{label.dateText}</Badge>
                      <div className="text-sm font-semibold text-foreground">
                        {label.nameText}
                      </div>
                    </div>
                  </td>
                </tr>

                {blocks.map((block) => {
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
                          <ResultTrackCell row={row} track="A" />
                        </td>
                        <td className="px-3 py-1.5">
                          <ResultTrackCell row={row} track="B" />
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
                                style={{ boxShadow: `inset 3px 0 0 ${accentColor}` }}
                              >
                                <ResultActionCell row={row} />
                              </td>
                              <td className="px-3 py-1.5">
                                <ResultTrackCell row={row} track="A" />
                              </td>
                              <td className="px-3 py-1.5">
                                <ResultTrackCell row={row} track="B" />
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

function ResultsMobileCards({ rows }: { rows: DrawRow[] }) {
  const [expandedTenRows, setExpandedTenRows] = useState<Record<string, boolean>>({});
  const groups = useMemo(() => groupRowsByEvent(rows), [rows]);
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
        const label = eventLabel(group.rows[0]);
        const blocks = groupRowsByStep(group.rows);

        return (
          <div
            key={group.eventValue}
            className="workspace-pane overflow-hidden"
            style={{ boxShadow: `inset 3px 0 0 ${accentColor}` }}
          >
            <div
              className="border-b border-border/35 px-3.5 py-3"
              style={{
                backgroundColor: accentTint,
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{label.dateText}</Badge>
                <div className="text-sm font-semibold text-foreground">{label.nameText}</div>
              </div>
            </div>

            <div className="divide-y divide-border/35">
              {blocks.map((block) => {
                if (block.kind === "single") {
                  const row = block.row;
                  const activeTrack = resolveActiveTrack(row);
                  return (
                    <div key={row.key} className="space-y-3 p-3.5">
                      <ResultActionCell row={row} compact />
                      <div className="pt-1 sm:hidden">
                        <ResultTrackCell row={row} track={activeTrack} compact />
                      </div>
                      <div className="hidden gap-4 pt-1 sm:grid sm:grid-cols-2">
                        <ResultTrackCell row={row} track="A" compact />
                        <ResultTrackCell row={row} track="B" compact />
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
                      <TenRollSummaryCell
                        row={block.summary}
                        track="A"
                        children={block.children}
                        compact
                      />
                      <TenRollSummaryCell
                        row={block.summary}
                        track="B"
                        children={block.children}
                        compact
                      />
                    </div>

                    {isExpanded ? (
                      <div className="space-y-3 border-t border-border/35 pt-3">
                        {block.children.map((row) => {
                          const activeTrack = resolveActiveTrack(row);
                          return (
                          <div key={row.key} className="space-y-3">
                            <ResultActionCell row={row} compact />
                            <div className="sm:hidden">
                              <ResultTrackCell row={row} track={activeTrack} compact />
                            </div>
                            <div className="hidden gap-4 sm:grid sm:grid-cols-2">
                              <ResultTrackCell row={row} track="A" compact />
                              <ResultTrackCell row={row} track="B" compact />
                            </div>
                          </div>
                        )})}
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
  showTitle?: boolean;
}) {
  const { result, graphsByEvent, targetCatIds, catNameById, showTitle = false } =
    props;

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

  return (
    <div className="space-y-0">
      {showTitle ? (
        <div className="workspace-toolbar text-sm font-semibold text-foreground">規劃結果</div>
      ) : null}
      <ResultsDesktopTable rows={rows} />
      <ResultsMobileCards rows={rows} />
    </div>
  );
}
