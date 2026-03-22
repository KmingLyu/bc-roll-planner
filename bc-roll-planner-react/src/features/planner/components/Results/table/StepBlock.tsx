import React from "react";
import type { DrawRow } from "../../../logic/view-model";
import type { DrawTableColumn, EventRunMeta, RowRenderCtx } from "../types";
import { Row } from "./Row";
import { CollapseRow } from "./CollapseRow";
import { EventGroupHeaderRow } from "./EventGroupHeaderRow";

export function StepBlock(props: {
  stepIndex: number;
  rows: DrawRow[];

  open: boolean;
  onToggleOpen: () => void;

  showTargetDrawsOnly: boolean;

  columns: DrawTableColumn[];
  detailColumns: DrawTableColumn[];
  eventRun: EventRunMeta;
  baseCtx: Omit<RowRenderCtx, "hasNextInBlock" | "countCell" | "eventGroupChrome">;
}) {
  const {
    stepIndex,
    rows,
    open,
    onToggleOpen,
    showTargetDrawsOnly,
    columns,
    detailColumns,
    eventRun,
    baseCtx,
  } = props;

  const tenSummary = rows.find((r) => r.isTen && r.isHeader) || null;
  const tenDraws = rows.filter((r) => r.isTen && !r.isHeader);
  const singles = rows.filter((r) => !r.isTen);
  const isTen = !!tenSummary;

  const shownTenDraws = showTargetDrawsOnly
    ? tenDraws.filter((r) => r.isTarget || r.isGuaranteedRow)
    : tenDraws;

  const out: React.ReactNode[] = [];

  if (eventRun.isStart) {
    out.push(
      <EventGroupHeaderRow
        key={`event-${stepIndex}`}
        colSpan={columns.length}
        eventRun={eventRun}
      />,
    );
  }

  if (isTen && tenSummary) {
    const headerCtx: RowRenderCtx = {
      ...baseCtx,
      hasNextInBlock: false,
      countCell: {
        kind: "toggle",
        open,
        onToggle: onToggleOpen,
        ariaLabel: `toggle step ${stepIndex}`,
      },
      eventGroupChrome: {
        color: eventRun.color,
        tint: eventRun.tint,
        isEnd: eventRun.isEnd && !open,
      },
    };

    out.push(
      <Row
        key={tenSummary.key}
        row={tenSummary}
        columns={columns}
        ctx={headerCtx}
      />,
    );

    out.push(
      <CollapseRow
        key={`collapse-${stepIndex}`}
        open={open}
        colSpan={columns.length}
        shownTenDraws={shownTenDraws}
        tenDrawsTotal={tenDraws.length}
        showTargetDrawsOnly={showTargetDrawsOnly}
        detailColumns={detailColumns}
        eventGroupChrome={{
          color: eventRun.color,
          tint: eventRun.tint,
          isEnd: eventRun.isEnd,
        }}
        baseCtx={baseCtx}
      />,
    );
  }

  if (singles.length) {
    singles.forEach((r, idx) => {
      const ctx: RowRenderCtx = {
        ...baseCtx,
        hasNextInBlock: idx < singles.length - 1,
        countCell: { kind: "spacer" },
        eventGroupChrome: {
          color: eventRun.color,
          tint: eventRun.tint,
          isEnd: eventRun.isEnd && idx === singles.length - 1,
        },
      };
      out.push(
        <Row key={r.key} row={r} columns={columns} ctx={ctx} />
      );
    });
  }

  return <>{out}</>;
}
