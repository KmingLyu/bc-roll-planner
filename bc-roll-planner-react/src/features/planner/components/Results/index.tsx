import { Fragment, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PlanResult } from "@/features/planner/logic/core";
import { buildDrawRows, type DrawRow } from "@/features/planner/logic/view-model";
import type { TrackGraph } from "@/types/models";
import { getEventDisplayLines } from "@/utils/event-display";
import { cn } from "@/lib/utils";

function cellTone(row: DrawRow, track: "A" | "B") {
  if (track === "A") {
    if (row.isTargetA) return "border-success/30 bg-success/10";
    if (row.statusA === "guaranteed") return "border-secondary/30 bg-secondary/20";
    if (row.statusA === "hit") return "border-warning/30 bg-warning/10";
    return "border-border/60 bg-muted/20";
  }
  if (row.isTargetB) return "border-success/30 bg-success/10";
  if (row.statusB === "guaranteed") return "border-secondary/30 bg-secondary/20";
  if (row.statusB === "hit") return "border-warning/30 bg-warning/10";
  return "border-border/60 bg-muted/20";
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

function ResultsDesktopTable({ rows }: { rows: DrawRow[] }) {
  const groups = useMemo(() => groupRowsByEvent(rows), [rows]);

  return (
    <div className="hidden lg:block">
      <div className="overflow-hidden rounded-[28px] border border-border/80 bg-background">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-muted/30">
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
                  <tr key={`${group.eventValue}-header`} className="border-b border-border/60 bg-card/70">
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
                    <tr key={row.key} className="border-b border-border/60 align-top last:border-b-0">
                      <td className="px-4 py-4">
                        <div className="space-y-2">
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
                          <div className="text-sm leading-6 text-muted-foreground">
                            {row.note}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className={cn("rounded-3xl border px-4 py-4 text-sm", cellTone(row, "A"))}>
                          <div className="font-medium text-foreground">{row.A}</div>
                          {row.isDuplicateA ? (
                            <div className="mt-2 text-xs text-muted-foreground">重複命中</div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className={cn("rounded-3xl border px-4 py-4 text-sm", cellTone(row, "B"))}>
                          <div className="font-medium text-foreground">{row.B}</div>
                          {row.isDuplicateB ? (
                            <div className="mt-2 text-xs text-muted-foreground">重複命中</div>
                          ) : null}
                        </div>
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
          <div key={row.key} className="rounded-[28px] border border-border/80 bg-background p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{label.dateText}</Badge>
              <Badge variant={row.isTarget ? "warning" : "muted"}>
                {row.stepText !== "-" ? row.stepText : row.actionText}
              </Badge>
              {row.countText !== "-" ? <Badge variant="outline">#{row.countText}</Badge> : null}
            </div>

            <div className="mt-3">
              <div className="text-sm font-semibold text-foreground">{label.nameText}</div>
              <div className="mt-1 text-sm text-muted-foreground">{row.note}</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className={cn("rounded-3xl border px-4 py-3", cellTone(row, "A"))}>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  A
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">{row.A}</div>
              </div>
              <div className={cn("rounded-3xl border px-4 py-3", cellTone(row, "B"))}>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  B
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">{row.B}</div>
              </div>
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
  const { result, graphsByEvent, targetCatIds, catNameById, showTitle = true } =
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
    <Card className="rounded-[32px] border-border/80 shadow-none">
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
