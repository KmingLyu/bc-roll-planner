import React from "react";
import { TableCell, TableRow } from "@mui/material";
import type { DrawRow } from "../../../logic/view-model";
import type { DrawTableColumn, RowRenderCtx, ColW } from "../types";

function widthOfColumn(c: DrawTableColumn, colW: ColW): string | undefined {
  if (typeof c.widthPct === "number") return `${c.widthPct}%`;
  if (c.widthKey) return `${colW[c.widthKey]}%`;
  return undefined;
}

export function Row(props: {
  row: DrawRow;
  columns: DrawTableColumn[];
  ctx: RowRenderCtx;
}) {
  const { row, columns, ctx } = props;

  return (
    <TableRow
      hover
      sx={{ opacity: row.countText === "⋯" ? 0.9 : 1 }}
      onContextMenu={
        ctx.onRowContextMenu
          ? (e) => {
              e.preventDefault();
              ctx.onRowContextMenu?.(row, e);
            }
          : undefined
      }
    >
      {columns.map((c) => (
        <TableCell
          key={c.id}
          sx={{
            ...ctx.bodyCellSx,
            width: widthOfColumn(c, ctx.colW),
            whiteSpace: c.id === "count" ? "nowrap" : undefined,
            textAlign: c.align,
          }}
        >
          {c.render(row, ctx)}
        </TableCell>
      ))}
    </TableRow>
  );
}
