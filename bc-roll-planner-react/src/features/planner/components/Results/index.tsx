import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  return row.pos != null ? `${row.pos}${track}` : track;
}

function trackDotClass(row: DrawRow, track: "A" | "B") {
  const isTarget = track === "A" ? row.isTargetA : row.isTargetB;
  const status = track === "A" ? row.statusA : row.statusB;

  if (isTarget) return "bg-success";
  if (status === "guaranteed") return "bg-[hsl(281,82%,70%)]";
  if (status === "hit") return "bg-warning";
  return "bg-border";
}

function ResultCatPreview({ catId }: { catId: number | null }) {
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
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[4px] border border-border/60 bg-background transition-colors hover:border-primary/50 hover:bg-accent/30"
      aria-label={`查看貓咪 #${catId}`}
    >
      {imageUrl && !imageFailed ? (
        <img
          src={imageUrl}
          alt=""
          width={28}
          height={28}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="size-7 object-cover"
        />
      ) : (
        <span className="text-[11px] font-medium text-muted-foreground">#{catId}</span>
      )}
    </a>
  );
}

function ResultTrackCell(props: {
  row: DrawRow;
  track: "A" | "B";
  compact?: boolean;
}) {
  const { row, track, compact = false } = props;
  const value = track === "A" ? row.A : row.B;
  const isDuplicate = track === "A" ? row.isDuplicateA : row.isDuplicateB;
  const catId = track === "A" ? row.catIdA : row.catIdB;

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <span className={cn("size-2.5 rounded-full", trackDotClass(row, track))} />
        <span>{trackPositionLabel(row, track)}</span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="text-sm font-medium text-foreground">{value}</div>
          {isDuplicate ? (
            <div className="text-xs text-muted-foreground">重複命中</div>
          ) : null}
        </div>
        <ResultCatPreview catId={catId} />
      </div>
    </div>
  );
}

function ResultActionCell(props: {
  row: DrawRow;
  tenExpanded?: boolean;
  onToggleTen?: () => void;
  compact?: boolean;
}) {
  const { row, tenExpanded = false, onToggleTen, compact = false } = props;

  if (row.isTen && row.isHeader) {
    return (
      <button
        type="button"
        onClick={onToggleTen}
        className="flex w-full items-center gap-2 text-left"
      >
        {row.stepText !== "-" ? (
          <Badge variant={row.isTarget ? "warning" : "muted"}>{row.stepText}</Badge>
        ) : null}
        <span className="inline-flex size-6 items-center justify-center rounded-[4px] border border-border/60 bg-background text-muted-foreground">
          {tenExpanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
        <span
          className={cn(
            "font-semibold text-foreground",
            compact ? "text-sm" : "text-base",
          )}
        >
          {row.actionText}
        </span>
      </button>
    );
  }

  if (row.isTen && !row.isHeader) {
    return <div className="h-5" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {row.stepText !== "-" ? (
        <Badge variant={row.isTarget ? "warning" : "muted"}>{row.stepText}</Badge>
      ) : null}
      <span
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-sm" : "text-base",
        )}
      >
        {row.actionText}
      </span>
    </div>
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
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border/50 bg-muted/20">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Action
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              A
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              B
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
                    colSpan={3}
                    className="px-4 py-3"
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
                          className="px-4 py-3"
                          style={{ boxShadow: `inset 2px 0 0 ${accentColor}` }}
                        >
                          <ResultActionCell row={row} />
                        </td>
                        <td className="px-4 py-3">
                          <ResultTrackCell row={row} track="A" />
                        </td>
                        <td className="px-4 py-3">
                          <ResultTrackCell row={row} track="B" />
                        </td>
                      </tr>
                    );
                  }

                  const isExpanded = !!expandedTenRows[block.summary.key];

                  return (
                    <Fragment key={block.key}>
                      <tr className="border-b border-border/35 align-top">
                        <td
                          className="px-4 py-3"
                          style={{ boxShadow: `inset 2px 0 0 ${accentColor}` }}
                        >
                          <ResultActionCell
                            row={block.summary}
                            tenExpanded={isExpanded}
                            onToggleTen={() => toggleTenRow(block.summary.key)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <ResultTrackCell row={block.summary} track="A" />
                        </td>
                        <td className="px-4 py-3">
                          <ResultTrackCell row={block.summary} track="B" />
                        </td>
                      </tr>

                      {isExpanded
                        ? block.children.map((row) => (
                            <tr
                              key={row.key}
                              className="border-b border-border/35 align-top last:border-b-0"
                            >
                              <td
                                className="px-4 py-3"
                                style={{ boxShadow: `inset 2px 0 0 ${accentColor}` }}
                              >
                                <ResultActionCell row={row} />
                              </td>
                              <td className="px-4 py-3">
                                <ResultTrackCell row={row} track="A" />
                              </td>
                              <td className="px-4 py-3">
                                <ResultTrackCell row={row} track="B" />
                              </td>
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
          <div key={group.eventValue} className="workspace-pane overflow-hidden">
            <div
              className="border-b border-border/35 px-3.5 py-3"
              style={{
                backgroundColor: accentTint,
                boxShadow: `inset 3px 0 0 ${accentColor}`,
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
                  return (
                    <div key={row.key} className="space-y-3 p-3.5">
                      <ResultActionCell row={row} compact />
                      <div className="grid gap-4 pt-1 sm:grid-cols-2">
                        <ResultTrackCell row={row} track="A" compact />
                        <ResultTrackCell row={row} track="B" compact />
                      </div>
                    </div>
                  );
                }

                const isExpanded = !!expandedTenRows[block.summary.key];

                return (
                  <div key={block.key} className="space-y-3 p-3.5">
                    <ResultActionCell
                      row={block.summary}
                      compact
                      tenExpanded={isExpanded}
                      onToggleTen={() => toggleTenRow(block.summary.key)}
                    />
                    <div className="grid gap-4 pt-1 sm:grid-cols-2">
                      <ResultTrackCell row={block.summary} track="A" compact />
                      <ResultTrackCell row={block.summary} track="B" compact />
                    </div>

                    {isExpanded ? (
                      <div className="space-y-3 border-t border-border/35 pt-3">
                        {block.children.map((row) => (
                          <div key={row.key} className="space-y-3">
                            <ResultActionCell row={row} compact />
                            <div className="grid gap-4 sm:grid-cols-2">
                              <ResultTrackCell row={row} track="A" compact />
                              <ResultTrackCell row={row} track="B" compact />
                            </div>
                          </div>
                        ))}
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
