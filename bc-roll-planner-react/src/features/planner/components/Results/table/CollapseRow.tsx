import {
  Box,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Typography,
} from "@mui/material";
import type { DrawRow } from "../../../logic/view-model";
import type {
  DrawTableColumn,
  EventGroupChrome,
  RowRenderCtx,
} from "../types";
import { Row } from "./Row";

export function CollapseRow(props: {
  open: boolean;
  colSpan: number;

  shownTenDraws: DrawRow[];
  tenDrawsTotal: number;
  showTargetDrawsOnly: boolean;

  detailColumns: DrawTableColumn[];
  eventGroupChrome: EventGroupChrome;
  baseCtx: Omit<RowRenderCtx, "hasNextInBlock" | "countCell" | "eventGroupChrome">;
}) {
  const {
    open,
    colSpan,
    shownTenDraws,
    tenDrawsTotal,
    showTargetDrawsOnly,
    detailColumns,
    eventGroupChrome,
    baseCtx,
  } = props;

  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ px: 0, py: 0, borderBottom: 0 }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box
            sx={{
              width: "100%",
              pl: 1,
              pr: 0.5,
              pt: 0.5,
              pb: 0.5,
              borderLeft: "2px solid",
              borderLeftColor: eventGroupChrome.color,
              bgcolor: "rgba(15, 23, 42, 0.08)",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
              sx={{ display: "block", mb: 0.5 }}
            >
              10連展開（{shownTenDraws.length}/{tenDrawsTotal}）
              {showTargetDrawsOnly ? "：只顯示目標/保底" : ""}
            </Typography>

            <Box
              sx={{
                width: `calc(${baseCtx.colW.A + baseCtx.colW.B}% - 20px)`,
                ml: "auto",
                mr: 0.5,
              }}
            >
              <Box sx={{ px: 1.25, py: 0.9 }}>
                <Table size="small" sx={{ tableLayout: "fixed" }}>
                  <TableBody>
                  {shownTenDraws.map((r, idx) => {
                    const ctx: RowRenderCtx = {
                      ...baseCtx,
                      bodyCellSx: {
                        ...baseCtx.bodyCellSx,
                        borderBottom: 0,
                      },
                      hasNextInBlock: idx < shownTenDraws.length - 1,
                      countCell: { kind: "spacer" },
                      eventGroupChrome: null,
                    };
                      return (
                        <Row
                          key={r.key}
                          row={r}
                          columns={detailColumns}
                          ctx={ctx}
                        />
                      );
                    })}
                  </TableBody>
                </Table>

                {!shownTenDraws.length && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ py: 1.25 }}
                  >
                    （展開內容為空：可能你開了「只看目標」，但此 10 連沒有命中目標）
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Collapse>
      </TableCell>
    </TableRow>
  );
}
