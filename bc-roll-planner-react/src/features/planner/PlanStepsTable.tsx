import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import type { PlanResult } from "../../core/planner";
import { fmtCost } from "./format";

type Props = {
  result: PlanResult;
};

export function PlanStepsTable({ result }: Props) {
  const steps = result.plan || [];

  if (!steps.length) {
    return (
      <Box sx={{ opacity: 0.75 }}>
        沒有 step（可能資源不足或 graph 無法走位）
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: "auto" }}>
      <Table size="small" sx={{ minWidth: 900 }}>
        <TableHead>
          <TableRow>
            {[
              "#",
              "event",
              "resource",
              "method",
              "from→to",
              "cost_inc",
              "draws",
            ].map((h) => (
              <TableCell key={h} sx={{ whiteSpace: "nowrap", fontWeight: 700 }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          {steps.map((st: any, i: number) => {
            const draws = st.draws || [];
            const drawsText =
              draws
                .map((d: any) =>
                  d.cat_id != null ? `${d.cat_name}#${d.cat_id}` : "-"
                )
                .slice(0, 8)
                .join(", ") + (draws.length > 8 ? " ..." : "");

            return (
              <TableRow key={`${i}-${st.event_value}-${st.start_cursor_id}`}>
                <TableCell>{i + 1}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {st.event_value}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {st.resource}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{st.method}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {st.start_cursor_id} → {st.end_cursor_id}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {fmtCost(st.cost_inc)}
                </TableCell>
                <TableCell>
                  <div>{drawsText || "-"}</div>

                  {/* 未來要標示：「在哪個位置抽」、「哪一抽命中目標」就在這個區塊強化 */}
                  {draws.length ? (
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
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
