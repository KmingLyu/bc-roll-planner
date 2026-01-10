// src/components/planner/PlanDrawsTimelineTable.tsx
import React, { useMemo, useState } from "react";
import type { PlanResult } from "../../core/planner";
import type { TrackGraph } from "../../../shared/models";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import {
  buildDrawRows,
  STATUS_STYLE,
  TARGET_BORDER_STYLE,
  TARGET_NODE_STYLE, // ✅ 新增：target node 配色集中管理
  type DrawRow,
  // eventColor,
  // eventTint,
  makeEventColorPicker,
} from "./planViewModel";

function StepLane(props: {
  lane: "A" | "B";
  text: string;
  status: "normal" | "hit" | "guaranteed";
  isTarget?: boolean;
  hasNext: boolean;
  isEllipsis?: boolean;
}) {
  const { lane, text, status, isTarget = false, hasNext, isEllipsis } = props;
  const laneW = 26;
  const nodeSize = isEllipsis ? 10 : 18; // ✅ target 也用同一個 nodeSize，不改大小

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Box
        sx={{
          position: "relative",
          width: laneW,
          flex: `0 0 ${laneW}px`,
          height: 34,
          display: "grid",
          placeItems: "center",
          overflow: "visible",
        }}
      >
        {hasNext && (
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: isEllipsis ? 18 : 20,
              bottom: -16,
              width: 2,
              transform: "translateX(-50%)",
              bgcolor: "divider",
              borderRadius: 999,
              ...(isEllipsis
                ? {
                    bgcolor: "transparent",
                    borderLeft: "2px dashed",
                    borderColor: "divider",
                    width: 0,
                  }
                : null),
            }}
          />
        )}

        <Box
          sx={{
            width: nodeSize,
            height: nodeSize,
            borderRadius: 999,

            // ✅ target node：集中管理的配色（不影響尺寸）
            bgcolor: isEllipsis
              ? "background.paper"
              : isTarget
              ? TARGET_NODE_STYLE.bg
              : STATUS_STYLE[status].node,

            border: "2px solid",
            borderColor: isTarget ? TARGET_NODE_STYLE.borderColor : "divider",

            boxShadow: isTarget ? TARGET_NODE_STYLE.ringShadow : "none",

            display: "grid",
            placeItems: "center",
            zIndex: 1,
          }}
        >
          {!isEllipsis && (
            <Typography
              variant="caption"
              fontWeight={900}
              sx={{
                lineHeight: 1,
                color: isTarget ? TARGET_NODE_STYLE.textColor : "text.primary",
              }}
            >
              {lane}
            </Typography>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1,
          py: 0.65,
          borderRadius: 999,
          bgcolor:
            status === "normal" ? "action.hover" : STATUS_STYLE[status].bg,
          border: "1px solid",
          borderColor: status === "normal" ? "divider" : "transparent",
          minWidth: 0,
          flex: "1 1 auto",
          ...(isTarget ? TARGET_BORDER_STYLE : null),
        }}
        title={text}
      >
        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
          {text}
        </Typography>
      </Box>
    </Box>
  );
}

function Pill(props: { text: string; tone?: "normal" | "strong" }) {
  const { text, tone = "normal" } = props;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        py: 0.4,
        borderRadius: 999,
        bgcolor: tone === "strong" ? "action.selected" : "action.hover",
        border: "1px solid",
        borderColor: "divider",
        maxWidth: "100%",
      }}
      title={text}
      aria-label={text}
    >
      <Typography
        variant="caption"
        fontWeight={900}
        noWrap
        sx={{ minWidth: 0 }}
      >
        {text}
      </Typography>
    </Box>
  );
}

export function PlanDrawsTimelineTable(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  targetCatIds: number[];
}) {
  const { result, graphsByEvent, targetCatIds } = props;

  const targetSet = useMemo(() => new Set(targetCatIds), [targetCatIds]);

  const allRows = useMemo(() => {
    return buildDrawRows({
      result,
      graphsByEvent,
      targetIdSet: targetSet,
    });
  }, [result, graphsByEvent, targetSet]);

  const [openTen, setOpenTen] = useState<Record<number, boolean>>({});
  const [showTargetsOnly, setShowTargetsOnly] = useState(false);
  const [showTargetDrawsOnly, setShowTargetDrawsOnly] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  const filtered = useMemo(() => {
    if (!showTargetsOnly) return allRows;

    const okStep = new Set<number>();
    for (const r of allRows) {
      if (r.isTarget) okStep.add(r.stepIndex);
    }
    return allRows.filter((r) => okStep.has(r.stepIndex));
  }, [allRows, showTargetsOnly]);

  // 用「目前顯示的 rows」出現順序，依序分配色彩（不重複）
  const eventOrder = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of filtered) {
      const k = String(r.eventName || r.eventValue || "");
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }, [filtered]);

  const eventPicker = useMemo(
    () => makeEventColorPicker(eventOrder),
    [eventOrder]
  );

  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const isSm = useMediaQuery(theme.breakpoints.between("sm", "md"));

  // 欄寬（%）
  const colW = useMemo(() => {
    if (isXs)
      return {
        count: 8,
        step: 8,
        action: 10,
        event: 42,
        A: 16,
        B: 16,
      };
    if (isSm)
      return {
        count: 8,
        step: 8,
        action: 10,
        event: 42,
        A: 16,
        B: 16,
      };
    return {
      count: 8,
      step: 8,
      action: 10,
      event: 42,
      A: 16,
      B: 16,
    };
  }, [isXs, isSm]);

  const bodyCellBase = {
    bgcolor: "background.paper",
    borderTop: "1px solid",
    borderBottom: "1px solid",
    borderColor: "divider",
    py: 1,
    verticalAlign: "middle",
  } as const;

  const steps = useMemo(() => {
    const byStep = new Map<number, DrawRow[]>();
    for (const r of filtered) {
      const arr = byStep.get(r.stepIndex) ?? [];
      arr.push(r);
      byStep.set(r.stepIndex, arr);
    }
    return Array.from(byStep.entries()).sort((a, b) => a[0] - b[0]);
  }, [filtered]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Typography fontWeight={900}>規劃結果：步驟表（A/B Lane）</Typography>

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <FormControlLabel
              control={
                <Switch
                  checked={showLegend}
                  onChange={(e) => setShowLegend(e.target.checked)}
                />
              }
              label={<Typography variant="body2">圖例</Typography>}
            />

            <Button
              size="small"
              variant={showTargetsOnly ? "contained" : "outlined"}
              onClick={() => setShowTargetsOnly((v) => !v)}
              sx={{ borderRadius: 999 }}
            >
              {showTargetsOnly ? "顯示全部步驟" : "只看目標步驟"}
            </Button>

            <FormControlLabel
              control={
                <Switch
                  checked={showTargetDrawsOnly}
                  onChange={(e) => setShowTargetDrawsOnly(e.target.checked)}
                />
              }
              label={<Typography variant="body2">10連展開只看目標</Typography>}
            />
          </Stack>
        </Stack>

        {showLegend && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label="抽中"
              sx={{ bgcolor: STATUS_STYLE.hit.bg }}
            />
            <Chip
              size="small"
              label="目標"
              sx={{
                bgcolor: "action.hover",
                ...TARGET_BORDER_STYLE,
              }}
            />
            <Chip
              size="small"
              label="保底"
              sx={{ bgcolor: STATUS_STYLE.guaranteed.bg }}
            />
            {/* <Chip size="small" label="圓點+連線：A/B Lane" variant="outlined" /> */}
            {/* <Chip
              size="small"
              label="Event 色點：自動 hash"
              variant="outlined"
            /> */}
            {/* <Chip size="small" label="10連：可展開/收合" variant="outlined" /> */}
          </Stack>
        )}

        <Divider />

        <TableContainer
          component={Box}
          sx={{
            maxHeight: 520,
            borderRadius: 3,
            border: 1,
            borderColor: "divider",
            overflow: "auto",
            bgcolor: "background.default",
            p: 1,
          }}
        >
          <Table
            stickyHeader
            size="small"
            sx={{
              minWidth: 980,
              tableLayout: "fixed",
              borderCollapse: "separate",
              borderSpacing: "0 10px",
            }}
          >
            <TableHead>
              <TableRow>
                {[
                  { key: "count", label: "count", w: colW.count },
                  { key: "step", label: "抽卡步驟", w: colW.step },
                  { key: "action", label: "資源", w: colW.action },
                  { key: "event", label: "Event", w: colW.event },
                  { key: "A", label: "A", w: colW.A },
                  { key: "B", label: "B", w: colW.B },
                ].map((c) => (
                  <TableCell
                    key={c.key}
                    sx={{
                      width: `${c.w}%`,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                      bgcolor: "background.paper",
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {c.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {steps.length === 0 ? (
                <TableRow>
                  {/* ✅ FIX：欄位數是 6，不是 7 */}
                  <TableCell colSpan={6} sx={{ py: 6, textAlign: "center" }}>
                    沒有資料
                  </TableCell>
                </TableRow>
              ) : (
                steps.map(([stepIndex, rows]) => {
                  const tenSummary =
                    rows.find((r) => r.isTen && r.isHeader) || null;
                  const tenDraws = rows.filter((r) => r.isTen && !r.isHeader);
                  const singles = rows.filter((r) => !r.isTen);

                  const isTen = !!tenSummary;
                  const open = !!openTen[stepIndex];

                  const stepHasTarget = rows.some((r) => r.isTarget);

                  const shownTenDraws = showTargetDrawsOnly
                    ? tenDraws.filter((r) => r.isTarget || r.isGuaranteedRow)
                    : tenDraws;

                  const renderRow = (
                    r: DrawRow,
                    hasNextInBlock: boolean,
                    isFirst: boolean,
                    isLast: boolean,
                    stepHeader?: boolean
                  ) => {
                    const isEllipsis = r.countText === "⋯";
                    const evKey = r.eventName || r.eventValue;

                    return (
                      <TableRow
                        key={r.key}
                        hover
                        sx={{ opacity: isEllipsis ? 0.9 : 1 }}
                      >
                        <TableCell
                          sx={{
                            ...bodyCellBase,
                            width: `${colW.count}%`,
                            whiteSpace: "nowrap",
                            borderLeft: "1px solid",
                            borderColor: "divider",
                            borderTopLeftRadius: isFirst ? 16 : 16,
                            borderBottomLeftRadius: isLast ? 16 : 16,
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                          >
                            {stepHeader && isTen ? (
                              <IconButton
                                size="small"
                                onClick={() =>
                                  setOpenTen((p) => ({
                                    ...p,
                                    [stepIndex]: !p[stepIndex],
                                  }))
                                }
                              >
                                {open ? (
                                  <KeyboardArrowUpIcon />
                                ) : (
                                  <KeyboardArrowDownIcon />
                                )}
                              </IconButton>
                            ) : (
                              <Box sx={{ width: 34 }} />
                            )}

                            <Typography variant="body2" fontWeight={900}>
                              {r.countText}
                            </Typography>
                          </Stack>
                        </TableCell>

                        <TableCell
                          sx={{ ...bodyCellBase, width: `${colW.step}%` }}
                        >
                          <Pill
                            text={r.stepText}
                            tone={r.stepText !== "-" ? "strong" : "normal"}
                          />
                        </TableCell>

                        <TableCell
                          sx={{ ...bodyCellBase, width: `${colW.action}%` }}
                        >
                          <Pill
                            text={r.actionText}
                            tone={r.isTen && r.isHeader ? "strong" : "normal"}
                          />
                        </TableCell>

                        <TableCell
                          sx={{ ...bodyCellBase, width: `${colW.event}%` }}
                        >
                          <Box
                            title={evKey}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              px: 1,
                              py: 0.6,
                              borderRadius: 999,
                              border: "1px solid",
                              // borderColor: eventColor(evKey),
                              // bgcolor: eventTint(evKey),
                              borderColor: eventPicker.colorOf(evKey),
                              bgcolor: eventPicker.tintOf(evKey),
                              minWidth: 0,
                            }}
                          >
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                // bgcolor: eventColor(evKey),
                                bgcolor: eventPicker.colorOf(evKey),
                                flex: "0 0 auto",
                              }}
                            />
                            <Typography
                              variant="caption"
                              fontWeight={900}
                              noWrap
                              sx={{
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: "1 1 auto",
                              }}
                            >
                              {evKey}
                            </Typography>
                          </Box>
                        </TableCell>

                        <TableCell
                          sx={{ ...bodyCellBase, width: `${colW.A}%` }}
                        >
                          <StepLane
                            lane="A"
                            text={r.A}
                            status={r.statusA}
                            isTarget={!isEllipsis && r.isTargetA} // ✅ FIX
                            hasNext={hasNextInBlock}
                            isEllipsis={isEllipsis}
                          />
                        </TableCell>

                        <TableCell
                          sx={{ ...bodyCellBase, width: `${colW.B}%` }}
                        >
                          <StepLane
                            lane="B"
                            text={r.B}
                            status={r.statusB}
                            isTarget={!isEllipsis && r.isTargetB} // ✅ FIX
                            hasNext={hasNextInBlock}
                            isEllipsis={isEllipsis}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  };

                  const blockRows: React.ReactNode[] = [];

                  if (isTen && tenSummary) {
                    blockRows.push(
                      renderRow(
                        tenSummary,
                        false,
                        true,
                        !open || shownTenDraws.length === 0,
                        true
                      )
                    );

                    blockRows.push(
                      <TableRow key={`s${stepIndex}-collapse`}>
                        {/* ✅ FIX：欄位數是 6，不是 7 */}
                        <TableCell colSpan={6} sx={{ py: 0, borderBottom: 0 }}>
                          <Collapse in={open} timeout="auto" unmountOnExit>
                            <Box sx={{ pt: 1, pb: 0.5 }}>
                              <Typography
                                variant="body2"
                                fontWeight={800}
                                sx={{ mb: 1 }}
                              >
                                10連展開（{shownTenDraws.length}/
                                {tenDraws.length}）
                                {showTargetDrawsOnly ? "：只顯示目標/保底" : ""}
                              </Typography>

                              <Table size="small" sx={{ tableLayout: "fixed" }}>
                                <TableBody>
                                  {shownTenDraws.map((r, idx) =>
                                    renderRow(
                                      r,
                                      idx < shownTenDraws.length - 1,
                                      idx === 0,
                                      idx === shownTenDraws.length - 1,
                                      false
                                    )
                                  )}
                                </TableBody>
                              </Table>

                              {!shownTenDraws.length && (
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  sx={{ py: 2 }}
                                >
                                  （展開內容為空：可能你開了「只看目標」，但此
                                  10 連沒有命中目標）
                                </Typography>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  if (singles.length) {
                    for (let i = 0; i < singles.length; i++) {
                      const r = singles[i];
                      blockRows.push(
                        renderRow(
                          r,
                          i < singles.length - 1,
                          i === 0 && !isTen,
                          i === singles.length - 1,
                          false
                        )
                      );
                    }
                  }

                  if (showTargetsOnly && !stepHasTarget) return null;

                  return (
                    <React.Fragment key={`step-${stepIndex}`}>
                      {blockRows}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="caption" color="text.secondary">
          說明：A/B 欄位不是「這一步抽到哪邊」，而是「此位置在該 event 的 A/B
          兩條 lane 的內容」； 抽到/目標/保底會標在「實際使用的 lane」上。
        </Typography>
      </Stack>
    </Paper>
  );
}
