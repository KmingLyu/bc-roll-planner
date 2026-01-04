// src/components/planner/PlanStepsTable.tsx
import type { PlanResult } from "../../core/planner";

function fmtCost(cost: any): string {
  if (!cost || !Array.isArray(cost)) return "-";
  const [equiv, foodUsed, tUsed, pUsed, lUsed] = cost as any;
  return `equiv=${equiv}, food=${foodUsed}, ticket=${tUsed}, platinum=${pUsed}, legend=${lUsed}`;
}

export function PlanStepsTable(props: { result: PlanResult }) {
  const { result } = props;

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 800, marginBottom: 8 }}>Plan Steps</div>

      {!result.plan?.length ? (
        <div style={{ opacity: 0.7 }}>
          沒有 step（可能資源不足或 graph 無法走位）
        </div>
      ) : (
        <div style={{ overflow: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                {[
                  "#",
                  "event",
                  "resource",
                  "method",
                  "from→to",
                  "cost_inc",
                  "draws",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      borderBottom: "1px solid #ddd",
                      padding: "6px 6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {result.plan.map((st: any, i: number) => {
                const draws = st.draws || [];
                const drawsText =
                  draws
                    .map((d: any) =>
                      d.cat_id != null ? `${d.cat_name}#${d.cat_id}` : "-"
                    )
                    .slice(0, 8)
                    .join(", ") + (draws.length > 8 ? " ..." : "");

                return (
                  <tr key={`${i}-${st.event_value}-${st.start_cursor_id}`}>
                    <td
                      style={{
                        padding: "6px 6px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {i + 1}
                    </td>
                    <td
                      style={{
                        padding: "6px 6px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {st.event_value}
                    </td>
                    <td
                      style={{
                        padding: "6px 6px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {st.resource}
                    </td>
                    <td
                      style={{
                        padding: "6px 6px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {st.method}
                    </td>
                    <td
                      style={{
                        padding: "6px 6px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {st.start_cursor_id} → {st.end_cursor_id}
                    </td>
                    <td
                      style={{
                        padding: "6px 6px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {fmtCost(st.cost_inc as any)}
                    </td>
                    <td
                      style={{
                        padding: "6px 6px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      {drawsText || "-"}
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ cursor: "pointer" }}>
                          展開（{draws.length} draws）
                        </summary>

                        <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                          {draws.map((d: any, idx: number) => (
                            <div
                              key={`${i}-${idx}-${d.from_pos_id}-${
                                d.cat_id ?? "x"
                              }`}
                              style={{
                                fontFamily:
                                  "ui-monospace, SFMono-Regular, Menlo, monospace",
                              }}
                            >
                              {String(idx + 1).padStart(2, "0")}.{" "}
                              {String(d.used).padEnd(12)} {d.from_pos_id}→
                              {d.to_pos_id} {d.cat_id ?? "-"} {d.cat_name}{" "}
                              <span style={{ opacity: 0.65 }}>
                                (src={d.source_pick_id ?? "-"})
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
            ✅
            未來你要更清楚標示：「此步在哪個位置執行、使用哪個卡池、資源消耗、命中目標位置」，
            建議新增欄位後不要改 planner 核心資料，只擴充
            view-model（下一步我可以幫你做）。
          </div>
        </div>
      )}
    </div>
  );
}
