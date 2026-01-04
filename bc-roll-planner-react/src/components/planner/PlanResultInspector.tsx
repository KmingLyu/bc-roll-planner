// src/components/planner/PlanResultInspector.tsx
import type { PlanResult } from "../../core/planner";
import { Alert, Paper, Typography } from "@mui/material";

export function PlanResultInspector(props: {
  result: PlanResult;
  catNameById: Map<number, string>;
}) {
  const { result } = props;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}>
        結果檢視（未來擴充用）
      </Typography>

      <Alert severity="info">
        這裡預計放：
        <ul style={{ margin: "8px 0 0 18px" }}>
          <li>目標貓命中清單：catId → 第一次命中的位置（cursor）→ 第幾步</li>
          <li>每一步的資源消耗增量（food/tickets/platinum/legend）</li>
          <li>
            每一步使用的卡池（pool_type）與動作（single/ten/guaranteed/switch）
          </li>
          <li>可點選 step 高亮對應 draws；必要時加圖片與連結</li>
        </ul>
      </Alert>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        （暫時資訊）steps={result.plan?.length ?? 0}，draws=
        {result.all_draws?.length ?? 0}
      </Typography>
    </Paper>
  );
}
