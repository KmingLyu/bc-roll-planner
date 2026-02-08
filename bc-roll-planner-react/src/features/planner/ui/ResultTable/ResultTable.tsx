import React, { useMemo, useState } from "react";
import type { PlanResult } from "@/domain/planner";
import type { TrackGraph } from "@/shared/models";

import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from "@mui/material";

import {
  buildDrawRows,
  makeEventColorPicker,
  type DrawRow,
} from "../planViewModel";

import { StickyHeaderBar } from "./ui/StickyHeaderBar";
import { useResponsiveColW } from "./hooks/useResponsiveColW";
import { groupByStep } from "./utils/groupByStep";

import type { DrawTableColumn } from "./types";
import { makeDefaultColumns } from "./table/columns";
import { StepBlock } from "./table/StepBlock";

export function ResultTable(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  targetCatIds: number[];

  /**
   * ✅ 擴充點 1：可插拔欄位
   * - 不傳就用預設 6 欄
   */
  columns?: DrawTableColumn[];

  /**
   * ✅ 擴充點 2：右鍵選單 / Row actions 的入口（先把事件管線接好）
   * - 你之後要開 MUI Menu / ContextMenu 都很方便
   */
  onRowContextMenu?: (row: DrawRow, e: React.MouseEvent) => void;

  /**
   * 可選：標題
   */
  title?: string;
}) {
  const {
    result,
    graphsByEvent,
    targetCatIds,
    columns,
    onRowContextMenu,
    title = "規劃結果",
  } = props;

  const targetSet = useMemo(() => new Set(targetCatIds), [targetCatIds]);

  const allRows = useMemo(() => {
    return buildDrawRows({
      result,
      graphsByEvent,
      targetIdSet: targetSet,
    });
  }, [result, graphsByEvent, targetSet]);

  // UI states
  const [openTen, setOpenTen] = useState<Record<number, boolean>>({});
  const [showTargetsOnly, setShowTargetsOnly] = useState(false);
  const [showTargetDrawsOnly, setShowTargetDrawsOnly] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  // filter: 只看目標步驟
  const filteredRows = useMemo(() => {
    if (!showTargetsOnly) return allRows;

    const okStep = new Set<number>();
    for (const r of allRows) {
      if (r.isTarget) okStep.add(r.stepIndex);
    }
    return allRows.filter((r) => okStep.has(r.stepIndex));
  }, [allRows, showTargetsOnly]);

  // event 出現順序 -> picker
  const eventOrder = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of filteredRows) {
      const k = String(r.eventName || r.eventValue || "");
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }, [filteredRows]);

  const eventPicker = useMemo(
    () => makeEventColorPicker(eventOrder),
    [eventOrder],
  );

  const colW = useResponsiveColW();

  const bodyCellSx = useMemo(
    () => ({
      bgcolor: "background.paper",
      borderBottom: "1px solid",
      borderColor: "divider",
      py: 1.2,
      verticalAlign: "middle",
    }),
    [],
  );

  const steps = useMemo(() => groupByStep(filteredRows), [filteredRows]);

  // ✅ columns：預設 6 欄，但可以外部覆蓋/新增
  const effectiveColumns = useMemo(() => {
    return columns && columns.length ? columns : makeDefaultColumns();
  }, [columns]);

  // StepBlock 需要的「不含 per-row 資訊」ctx
  const baseCtx = useMemo(
    () => ({
      colW,
      bodyCellSx,
      eventColorOf: eventPicker.colorOf,
      eventTintOf: eventPicker.tintOf,
      onRowContextMenu,
    }),
    [colW, bodyCellSx, eventPicker, onRowContextMenu],
  );

  return (
    <Stack
      spacing={2}
      sx={{ width: "100%", minWidth: 0, backgroundColor: "background.paper" }}
    >
      <StickyHeaderBar
        title={title}
        showLegend={showLegend}
        onToggleLegend={setShowLegend}
        showTargetsOnly={showTargetsOnly}
        onToggleTargetsOnly={setShowTargetsOnly}
        showTargetDrawsOnly={showTargetDrawsOnly}
        onToggleTargetDrawsOnly={setShowTargetDrawsOnly}
      />

      <TableContainer
        component={Box}
        sx={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          overflowX: "auto",
          overflowY: "hidden",
          p: 1,
        }}
      >
        <Table
          size="medium"
          sx={{
            minWidth: 980,
            tableLayout: "fixed",
            borderCollapse: "separate",
          }}
        >
          <TableBody>
            {steps.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={effectiveColumns.length}
                  sx={{ py: 6, textAlign: "center" }}
                >
                  沒有資料
                </TableCell>
              </TableRow>
            ) : (
              steps.map(([stepIndex, rows]) => {
                const isOpen = !!openTen[stepIndex];
                return (
                  <React.Fragment key={`step-${stepIndex}`}>
                    <StepBlock
                      stepIndex={stepIndex}
                      rows={rows}
                      open={isOpen}
                      onToggleOpen={() =>
                        setOpenTen((p) => ({
                          ...p,
                          [stepIndex]: !p[stepIndex],
                        }))
                      }
                      showTargetDrawsOnly={showTargetDrawsOnly}
                      columns={effectiveColumns}
                      baseCtx={baseCtx}
                    />
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 說明 */}
      {/* <Typography variant="caption" color="text.secondary">
        說明：A/B 欄位不是「這一步抽到哪邊」，而是「此位置在該 event 的 A/B 兩條
        lane 的內容」； 抽到/目標/保底會標在「實際使用的 lane」上。
      </Typography> */}

      {/* 你目前 showLegend 只影響 Header 顯示；未來你要加 TableHead 也很容易，
          因為 columns 已經定義好了（可直接用 columns map 出 header）。 */}
      {showLegend ? null : null}
    </Stack>
  );
}
