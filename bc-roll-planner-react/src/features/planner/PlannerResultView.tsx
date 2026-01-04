import { Box, Typography } from "@mui/material";
import type { PlanResult } from "../../core/planner";
import { fmtCost } from "./format";
import { PlanStepsTable } from "./PlanStepsTable";
import { JsonPreview } from "../../ui/JsonPreview";

type Props = {
  result: PlanResult;
  catNameById: Map<number, string>;
  showRaw: boolean;
  onToggleRaw: (v: boolean) => void;
};

export function PlannerResultView({
  result,
  catNameById,
  showRaw,
  onToggleRaw,
}: Props) {
  return (
    <Box sx={{ mt: 2, display: "grid", gap: 1.5 }}>
      <Box
        sx={{
          border: "1px solid #eee",
          borderRadius: 2,
          p: 1.5,
          display: "grid",
          gap: 0.8,
        }}
      >
        <Typography variant="body2">
          結果：
          <b
            style={{
              marginLeft: 8,
              color: result.success ? "green" : "crimson",
            }}
          >
            {result.success
              ? "成功（命中全部目標）"
              : "未完全命中（顯示目前最佳部分解）"}
          </b>
        </Typography>

        <Typography variant="body2">
          命中：<b>{result.targets_hit}</b> / {result.targets_total}
          {result.targets_missing_ids?.length ? (
            <span style={{ marginLeft: 10, opacity: 0.9 }}>
              缺少：
              {result.targets_missing_ids
                .slice(0, 12)
                .map((id) => `${catNameById.get(id) ?? "?"}#${id}`)
                .join(", ")}
              {result.targets_missing_ids.length > 12 ? " ..." : ""}
            </span>
          ) : null}
        </Typography>

        <Typography variant="body2">
          最終位置：<b>{result.final_cursor_id}</b>{" "}
          <span style={{ opacity: 0.8 }}>
            (prevCatId={result.final_prev_cat_id ?? "-"})
          </span>
        </Typography>

        <Typography variant="body2">
          花費：<b>{fmtCost(result.total_cost)}</b>
        </Typography>

        <Typography variant="body2" sx={{ opacity: 0.85 }}>
          steps={result.plan?.length ?? 0}, draws=
          {result.all_draws?.length ?? 0}
        </Typography>
      </Box>

      <Box sx={{ border: "1px solid #eee", borderRadius: 2, p: 1.5 }}>
        <Box sx={{ fontWeight: 700, mb: 1 }}>Plan Steps</Box>
        <PlanStepsTable result={result} />
      </Box>

      <JsonPreview show={showRaw} onToggle={onToggleRaw} value={result} />
    </Box>
  );
}
