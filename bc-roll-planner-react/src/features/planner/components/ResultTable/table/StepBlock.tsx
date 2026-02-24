import React from "react";
import type { DrawRow } from "../../../logic/view-model";
import type { DrawTableColumn, RowRenderCtx } from "../types";
import { DrawTableRow } from "./DrawTableRow";
import { TenCollapseRow } from "./TenCollapseRow";

export function StepBlock(props: {
  stepIndex: number;
  rows: DrawRow[];

  open: boolean;
  onToggleOpen: () => void;

  showTargetDrawsOnly: boolean;

  columns: DrawTableColumn[];
  baseCtx: Omit<RowRenderCtx, "hasNextInBlock" | "countCell">;
}) {
  const {
    stepIndex,
    rows,
    open,
    onToggleOpen,
    showTargetDrawsOnly,
    columns,
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
    };

    out.push(
      <DrawTableRow
        key={tenSummary.key}
        row={tenSummary}
        columns={columns}
        ctx={headerCtx}
      />,
    );

    out.push(
      <TenCollapseRow
        key={`collapse-${stepIndex}`}
        open={open}
        colSpan={columns.length}
        shownTenDraws={shownTenDraws}
        tenDrawsTotal={tenDraws.length}
        showTargetDrawsOnly={showTargetDrawsOnly}
        columns={columns}
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
      };
      out.push(
        <DrawTableRow key={r.key} row={r} columns={columns} ctx={ctx} />,
      );
    });
  }

  return <>{out}</>;
}
