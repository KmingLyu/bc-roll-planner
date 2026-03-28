import { Fragment, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanResult } from "@/features/planner/logic/core";
import { buildDrawRows, type DrawRow } from "@/features/planner/logic/view-model";
import type { TrackGraph } from "@/types/models";
import { getEventDisplayLines } from "@/utils/event-display";
import { cn } from "@/lib/utils";

function cellTone(row: DrawRow, track: "A" | "B") {
  if (track === "A") {
    if (row.isTargetA) return "border-success text-success";
    if (row.statusA === "guaranteed") return "border-secondary text-foreground";
    if (row.statusA === "hit") return "border-warning text-warning";
    return "border-border text-foreground";
  }

  if (row.isTargetB) return "border-success text-success";
  if (row.statusB === "guaranteed") return "border-secondary text-foreground";
  if (row.statusB === "hit") return "border-warning text-warning";
  return "border-border text-foreground";
}

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

function ResultTrackCell(props: {
  row: DrawRow;
  track: "A" | "B";
  compact?: boolean;
}) {
  const { row, track, compact = false } = props;
  const value = track === "A" ? row.A : row.B;
  const isDuplicate = track === "A" ? row.isDuplicateA : row.isDuplicateB;

  return (
    <div
      className={cn(
        "border-l-2 pl-3",
        compact ? "space-y-1" : "space-y-2",
        cellTone(row, track),
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {track}
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
      {isDuplicate ? (
        <div className="text-xs text-muted-foreground">重複命中</div>
      ) : null}
    </div>
  );
}

function ResultsDesktopTable({ rows }: { rows: DrawRow[] }) {
  const groups = useMemo(() => groupRowsByEvent(rows), [rows]);

  return (
    <div className="hidden lg:block">
      <div className="overflow-hidden rounded-[24px] border border-border/45 bg-background/85">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/45 bg-muted/25">
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
              return (
                <Fragment key={group.eventValue}>
                  <tr className="border-b border-border/40 bg-muted/15">
                    <td colSpan={3} className="px-4 py-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline">{label.dateText}</Badge>
                        <div className="text-sm font-semibold text-foreground">
                          {label.nameText}
                        </div>
                      </div>
                    </td>
                  </tr>
                  {group.rows.map((row) => (
                    <tr
                      key={row.key}
                      className="border-b border-border/40 align-top last:border-b-0"
                    >
                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.stepText !== "-" ? (
                              <Badge variant={row.isTarget ? "warning" : "muted"}>
                                {row.stepText}
                              </Badge>
                            ) : null}
                            {row.countText !== "-" ? (
                              <Badge variant="outline">#{row.countText}</Badge>
                            ) : null}
                            <span className="text-sm font-semibold text-foreground">
                              {row.actionText}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <ResultTrackCell row={row} track="A" />
                      </td>
                      <td className="px-4 py-4">
                        <ResultTrackCell row={row} track="B" />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ResultsMobileCards({ rows }: { rows: DrawRow[] }) {
  return (
    <div className="space-y-3 lg:hidden">
      {rows.map((row) => {
        const label = eventLabel(row);
        return (
          <div
            key={row.key}
            className="rounded-[24px] border border-border/45 bg-background/90 p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{label.dateText}</Badge>
              <Badge variant={row.isTarget ? "warning" : "muted"}>
                {row.stepText !== "-" ? row.stepText : row.actionText}
              </Badge>
              {row.countText !== "-" ? (
                <Badge variant="outline">#{row.countText}</Badge>
              ) : null}
            </div>

            <div className="mt-3">
              <div className="text-sm font-semibold text-foreground">{label.nameText}</div>
            </div>

            <div className="mt-4 grid gap-4 border-t border-border/40 pt-4 sm:grid-cols-2">
              <ResultTrackCell row={row} track="A" compact />
              <ResultTrackCell row={row} track="B" compact />
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
    <Card className="rounded-[32px] border-border/45 shadow-none">
      {showTitle ? (
        <CardHeader>
          <CardTitle className="text-lg">規劃結果</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className="space-y-4">
        <ResultsDesktopTable rows={rows} />
        <ResultsMobileCards rows={rows} />
      </CardContent>
    </Card>
  );
}
