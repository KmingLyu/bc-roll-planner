import {
  Box,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import type { DrawRow } from "../../planViewModel";
import type { DrawTableColumn, RowRenderCtx } from "../types";
import { DrawTableRow } from "./DrawTableRow";

export function TenCollapseRow(props: {
  open: boolean;
  colSpan: number;

  shownTenDraws: DrawRow[];
  tenDrawsTotal: number;
  showTargetDrawsOnly: boolean;

  columns: DrawTableColumn[];
  baseCtx: Omit<RowRenderCtx, "hasNextInBlock" | "countCell">;
}) {
  const {
    open,
    colSpan,
    shownTenDraws,
    tenDrawsTotal,
    showTargetDrawsOnly,
    columns,
    baseCtx,
  } = props;

  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ py: 0, borderBottom: 0 }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ pt: 1, pb: 0.5 }}>
            <Typography variant="body2" fontWeight={800} sx={{ mb: 1 }}>
              10連展開（{shownTenDraws.length}/{tenDrawsTotal}）
              {showTargetDrawsOnly ? "：只顯示目標/保底" : ""}
            </Typography>

            <Table size="small" sx={{ tableLayout: "fixed" }}>
              <TableBody>
                {shownTenDraws.map((r, idx) => {
                  const ctx: RowRenderCtx = {
                    ...baseCtx,
                    hasNextInBlock: idx < shownTenDraws.length - 1,
                    countCell: { kind: "spacer" },
                  };
                  return (
                    <DrawTableRow
                      key={r.key}
                      row={r}
                      columns={columns}
                      ctx={ctx}
                    />
                  );
                })}
              </TableBody>
            </Table>

            {!shownTenDraws.length && (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                （展開內容為空：可能你開了「只看目標」，但此 10 連沒有命中目標）
              </Typography>
            )}
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  );
}
