// src/components/planner/PlanResultSummary.tsx
import type { PlanResult } from "../../core/planner";

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
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 10,
        display: "grid",
        gap: 6,
      }}
    >
      <div>
        結果：
        <b
          style={{ marginLeft: 8, color: result.success ? "green" : "crimson" }}
        >
          {result.success
            ? "成功（命中全部目標）"
            : "未完全命中（顯示目前最佳部分解）"}
        </b>
      </div>

      <div>
        命中：<b>{result.targets_hit}</b> / {result.targets_total}
        {missingText ? (
          <span style={{ marginLeft: 10, opacity: 0.9 }}>
            缺少：{missingText}
          </span>
        ) : null}
      </div>

      <div>
        最終位置：<b>{result.final_cursor_id}</b>{" "}
        <span style={{ opacity: 0.8 }}>
          (prevCatId={result.final_prev_cat_id ?? "-"})
        </span>
      </div>

      <div>
        花費：<b>{fmtCost(result.total_cost as any)}</b>
      </div>

      <div style={{ opacity: 0.85 }}>
        steps={result.plan?.length ?? 0}, draws={result.all_draws?.length ?? 0}
      </div>
    </div>
  );
}
