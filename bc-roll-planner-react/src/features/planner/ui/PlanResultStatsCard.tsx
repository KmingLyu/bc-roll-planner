/**
 * src/features/planner/ui/PlanResultStatsCard.tsx
 *
 * 用途
 * - 顯示 planner 統計摘要（成功/未完成、命中數、終點位置、步驟數、draws 數等）。
 * - 依 ACTIONS 統計各資源使用次數；並以 event 為單位統計 draws 數量。
 * * 框架版本
 * - MUI v7 (使用 Grid2)
 */
import React, { useMemo } from "react";
import type { PlanResult } from "@/domain/planner";
import type { TrackGraph } from "@/shared/models";
import { Alert, Box, Chip, Stack, Typography, Divider } from "@mui/material";
// 【MUI v7 關鍵修正】從 Grid2 引入，這是新版標準 Grid
import Grid from "@mui/material/Grid";
import { actionLabelFromStep, ACTIONS } from "./planViewModel";

/**
 * 輔助元件：顯示單個統計數字
 */
function StatItem({
  label,
  value,
  color = "text.primary",
}: {
  label: string;
  value: React.ReactNode;
  color?: string;
}) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center">
      <Typography
        variant="h6"
        component="div"
        fontWeight="800"
        color={color}
        sx={{ lineHeight: 1.2 }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {label}
      </Typography>
    </Box>
  );
}

export function PlanResultStatsCard(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  catNameById: Map<number, string>;
}) {
  const { result, graphsByEvent, catNameById } = props;

  // 預計算統計數據
  const stats = useMemo(() => {
    const byAction = new Map<string, number>();
    const byEvent = new Map<string, number>();

    // 初始化 Action 計數
    for (const a of ACTIONS) byAction.set(a, 0);

    const plan = (result.plan || []) as any[];
    for (const st of plan) {
      const label = actionLabelFromStep(st);
      // 計算該步驟抽了幾張卡
      const drawsLen = Array.isArray(st.draws) ? st.draws.length : 0;

      // 統計動作次數 (單抽/十連都算 1 次動作)
      byAction.set(label, (byAction.get(label) || 0) + 1);

      // 統計各卡池(Event)抽到的總張數
      const ev = String(st.event_value || "");
      byEvent.set(ev, (byEvent.get(ev) || 0) + drawsLen);
    }

    const hitTargets = (result.targets_hit_ids || []).map((id) => ({
      id,
      name: catNameById.get(id) ?? "?",
    }));
    const missTargets = (result.targets_missing_ids || []).map((id) => ({
      id,
      name: catNameById.get(id) ?? "?",
    }));

    return { byAction, byEvent, hitTargets, missTargets };
  }, [result, catNameById]);

  // ✅ error 狀態：完全沒有命中任何目標
  const noHit = (result.targets_hit ?? 0) === 0;

  // Alert 狀態優先順序：success > error > warning
  const alertSeverity: "success" | "warning" | "error" = result.success
    ? "success"
    : noHit
    ? "error"
    : "warning";

  const alertText = result.success
    ? "規劃成功：命中全部目標"
    : noHit
    ? "規劃失敗：未命中任何目標"
    : "未完全命中：顯示目前最佳路徑";

  return (
    <Stack spacing={2}>
      {/* 1. 狀態提示 */}
      <Alert
        severity={alertSeverity}
        variant="standard"
        sx={{ py: 0, px: 2, alignItems: "center", fontWeight: "bold" }}
      >
        {alertText}
      </Alert>

      {/* 2. 核心指標 Dashboard (使用 Grid v2) */}
      <Box sx={{ px: 1 }}>
        <Grid container spacing={2}>
          {/* 使用 size={{ xs: 6, sm: 3 }} 在手機版一行兩個，桌面版一行四個 */}
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatItem
              label="命中目標"
              value={`${result.targets_hit}/${result.targets_total}`}
              color={
                result.success
                  ? "success.main"
                  : noHit
                  ? "error.main"
                  : "warning.main"
              }
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatItem label="結束位置" value={result.final_cursor_id} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatItem label="抽卡步驟" value={result.plan?.length ?? 0} />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatItem label="獲得貓咪" value={result.all_draws?.length ?? 0} />
          </Grid>
        </Grid>
      </Box>

      <Divider flexItem />

      {/* 3. 資源消耗與卡池分布 (使用 Stack 排列 Tag) */}
      <Stack spacing={1.5}>
        {/* 資源消耗 */}
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <Typography
            variant="caption"
            fontWeight="bold"
            color="text.secondary"
            sx={{ minWidth: 60 }}
          >
            資源消耗
          </Typography>
          {Array.from(stats.byAction.entries()).map(
            ([k, v]) =>
              v > 0 && (
                <Chip
                  key={k}
                  label={`${k} × ${v}`}
                  size="small"
                  variant="outlined"
                  sx={{ borderRadius: 1.5, borderColor: "divider" }}
                />
              )
          )}
          {Array.from(stats.byAction.values()).every((v) => v === 0) && (
            <Typography variant="caption" color="text.disabled">
              無消耗
            </Typography>
          )}
        </Box>

        {/* 卡池分布 */}
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <Typography
            variant="caption"
            fontWeight="bold"
            color="text.secondary"
            sx={{ minWidth: 60 }}
          >
            卡池分布
          </Typography>
          {Array.from(stats.byEvent.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([ev, cnt]) => {
              const name = graphsByEvent[ev]?.event?.name || ev;
              return (
                <Chip
                  key={ev}
                  label={`${name}：${cnt}`}
                  size="small"
                  color="default"
                  sx={{ borderRadius: 1.5, bgcolor: "action.hover" }}
                  title={name}
                />
              );
            })}
        </Box>
      </Stack>

      <Divider flexItem />

      {/* 4. 目標清單 */}
      <Stack spacing={1}>
        <Box>
          <Typography
            variant="caption"
            fontWeight="bold"
            color="text.secondary"
            display="block"
            gutterBottom
          >
            已命中目標
          </Typography>
          {stats.hitTargets.length ? (
            <Typography
              variant="body2"
              color={noHit ? "text.secondary" : "success.main"}
              sx={{ lineHeight: 1.6, fontWeight: 500 }}
            >
              {stats.hitTargets.map((t) => t.name).join("、")}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.disabled">
              （無）
            </Typography>
          )}
        </Box>

        {!!stats.missTargets.length && (
          <Box>
            <Typography
              variant="caption"
              fontWeight="bold"
              color="text.secondary"
              display="block"
              gutterBottom
            >
              未命中目標
            </Typography>
            <Typography
              variant="body2"
              color={noHit ? "error.main" : "text.secondary"}
              sx={{ lineHeight: 1.6 }}
            >
              {stats.missTargets
                .slice(0, 20)
                .map((t) => t.name)
                .join("、")}
              {stats.missTargets.length > 20 && (
                <Typography component="span" color="text.disabled">
                  {" "}
                  ...等
                </Typography>
              )}
            </Typography>
          </Box>
        )}
      </Stack>
    </Stack>
  );
}
