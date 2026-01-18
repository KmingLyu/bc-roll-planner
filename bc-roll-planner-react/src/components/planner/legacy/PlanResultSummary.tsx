/**
 * （舊版）
 * src/components/planner/PlanResultSummary.tsx
 *
 * 用途
 * - 較精簡的結果摘要（命中數、終點、花費、步驟/抽數、缺少目標）。
 *
 * 現況
 * - 你在 PlannerPage 內有 import，但目前 render 被註解掉（疑似被 StatsCard 取代）。
 */
import type { PlanResult } from "../../../core/planner";
import { Alert, Chip, Stack, Typography } from "@mui/material";

function fmtCost(cost: any): string {
  if (!cost || !Array.isArray(cost)) return "-";
  const [equiv, foodUsed, tUsed, pUsed, lUsed] = cost as any;
  return `equiv=${equiv}, food=${foodUsed}, ticket=${tUsed}, platinum=${pUsed}, legend=${lUsed}`;
}

export function PlanResultSummary(props: {
  result: PlanResult;
  missingText: string;
}) {
  const { result, missingText } = props;

  return (
    <Stack spacing={1}>
      <Alert severity={result.success ? "success" : "warning"}>
        {result.success
          ? "成功：命中全部目標"
          : "未完全命中：顯示目前最佳部分解"}
      </Alert>

      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip
          label={`命中 ${result.targets_hit}/${result.targets_total}`}
          color={result.success ? "success" : "warning"}
          variant="outlined"
        />
        <Chip label={`最終位置 ${result.final_cursor_id}`} variant="outlined" />
        <Chip
          label={`花費 ${fmtCost(result.total_cost as any)}`}
          variant="outlined"
        />
        <Chip
          label={`steps ${result.plan?.length ?? 0} / draws ${
            result.all_draws?.length ?? 0
          }`}
          variant="outlined"
        />
      </Stack>

      {missingText && (
        <Typography variant="body2" color="text.secondary">
          缺少：{missingText}
        </Typography>
      )}
    </Stack>
  );
}
