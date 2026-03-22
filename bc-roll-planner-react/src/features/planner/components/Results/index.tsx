import React, { useMemo, useState } from "react";
import type { PlanResult } from "@/features/planner/logic/core";
import type { TrackGraph } from "@/types/models";

import {
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import {
  buildDrawRows,
  makeEventColorPicker,
  type DrawRow,
} from "../../logic/view-model";

import { HeaderBar } from "./ui/HeaderBar";
import { useColWidths } from "./useColWidths";
import { groupByStep } from "./groupByStep";

import type { DrawTableColumn, EventRunMeta } from "./types";
import { makeDefaultColumns, makeDetailColumns } from "./table/columns";
import { StepBlock } from "./table/StepBlock";

export { type DrawTableColumn } from "./types";

export function ResultTable(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  targetCatIds: number[];
  catNameById: Map<number, string>;

  /**
   * ✅ 擴充點 1：可插拔欄位
   * - 不傳就用預設主表欄位
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

  /**
   * 是否顯示表格內標題（外層已提供標題時可關閉）
   */
  showTitle?: boolean;
}) {
  const {
    result,
    graphsByEvent,
    targetCatIds,
    catNameById,
    columns,
    onRowContextMenu,
    title = "規劃結果",
    showTitle = true,
  } = props;

  const targetSet = useMemo(() => new Set(targetCatIds), [targetCatIds]);
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));

  const allRows = useMemo(() => {
    return buildDrawRows({
      result,
      graphsByEvent,
      targetIdSet: targetSet,
      catNameById,
    });
  }, [result, graphsByEvent, targetSet, catNameById]);

  // UI states
  const [openTen, setOpenTen] = useState<Record<number, boolean>>({});
  const [showTargetsOnly, setShowTargetsOnly] = useState(false);
  const [showTargetDrawsOnly, setShowTargetDrawsOnly] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

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
      const k = String(r.eventValue || "");
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

  const colW = useColWidths();

  const bodyCellSx = useMemo(
    () => ({
      bgcolor: "transparent",
      borderBottom: "1px solid",
      borderColor: "divider",
      py: 1.2,
      verticalAlign: "middle",
    }),
    [],
  );

  const steps = useMemo(() => groupByStep(filteredRows), [filteredRows]);

  const detailColumns = useMemo(() => makeDetailColumns(), []);

  // ✅ columns：預設主表 3 欄，但可以外部覆蓋/新增
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

  const stepBlocks = useMemo(() => {
    return steps.map(([stepIndex, rows]) => {
      const eventAnchor = rows[0];
      return {
        stepIndex,
        rows,
        eventValue: String(eventAnchor?.eventValue || ""),
        eventName: eventAnchor?.eventName || "-",
        eventRawName: eventAnchor?.eventRawName || eventAnchor?.eventName || "-",
        eventStartDate: eventAnchor?.eventStartDate ?? null,
        eventEndDate: eventAnchor?.eventEndDate ?? null,
      };
    });
  }, [steps]);

  const eventRuns = useMemo<EventRunMeta[]>(() => {
    return stepBlocks.map((block, idx, arr) => {
      const prevEvent = idx > 0 ? arr[idx - 1]?.eventValue : null;
      const nextEvent = idx < arr.length - 1 ? arr[idx + 1]?.eventValue : null;
      return {
        eventValue: block.eventValue,
        eventName: block.eventName,
        eventRawName: block.eventRawName,
        eventStartDate: block.eventStartDate,
        eventEndDate: block.eventEndDate,
        color: eventPicker.colorOf(block.eventValue),
        tint: eventPicker.tintOf(block.eventValue),
        isStart: prevEvent !== block.eventValue,
        isEnd: nextEvent !== block.eventValue,
      };
    });
  }, [eventPicker, stepBlocks]);

  return (
    <Stack
      spacing={1}
      sx={{ width: "100%", minWidth: 0, backgroundColor: "transparent" }}
    >
      <HeaderBar
        title={showTitle ? title : undefined}
        rowsCount={filteredRows.length}
        stepsCount={steps.length}
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
          backgroundColor: "transparent",
          overflowX: "auto",
          overflowY: "hidden",
          px: { xs: 0, sm: 0.25 },
          pb: 0.5,
        }}
      >
        <Table
          size="medium"
          sx={{
            minWidth: isSmDown ? 560 : 640,
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
              stepBlocks.map(({ stepIndex, rows }, idx) => {
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
                      detailColumns={detailColumns}
                      eventRun={eventRuns[idx]}
                      baseCtx={baseCtx}
                    />
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 你目前 showLegend 只影響 Header 顯示；未來你要加 TableHead 也很容易，
          因為 columns 已經定義好了（可直接用 columns map 出 header）。 */}
      {showLegend ? null : null}
    </Stack>
  );
}
