// src/components/planner/PlanResultInspector.tsx
import type { PlanResult } from "../../core/planner";

export function PlanResultInspector(props: {
  result: PlanResult;
  catNameById: Map<number, string>;
}) {
  const { result } = props;

  // 先留骨架：未來你要把「目標貓在哪個位置拿到」「每步消耗」「使用哪些卡池」等做成清楚的視覺化
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        結果檢視（未來擴充用）
      </div>

      <div style={{ opacity: 0.8, fontSize: 13, lineHeight: 1.6 }}>
        這裡預計放：
        <ul style={{ marginTop: 6 }}>
          <li>目標貓命中清單：catId → 第一次命中的位置（cursor）→ 第幾步</li>
          <li>每一步的資源消耗增量（food/tickets/platinum/legend）</li>
          <li>
            每一步使用的卡池（pool_type）與動作（single/ten/guaranteed/switch）
          </li>
          <li>可點選 step 高亮對應 draws</li>
        </ul>
        目前先保留結構，等你確認想要的顯示方式再實作。
      </div>

      <div style={{ marginTop: 8, opacity: 0.75 }}>
        （暫時資訊）steps={result.plan?.length ?? 0}，draws=
        {result.all_draws?.length ?? 0}
      </div>
    </div>
  );
}
