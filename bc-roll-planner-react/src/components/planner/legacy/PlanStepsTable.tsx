/**
 * （舊版）
 * src/components/planner/PlanStepsTable.tsx
 *
 * 用途
 * - 舊版的 planner step 表格（偏 debug 取向）：每個 step 一列，可展開看 draws。
 * - 內容包含：event/resource/method/from→to/cost_inc 以及 draws 列表。
 *
 * 現況
 * - 依你貼的 PlannerPage，目前沒有 import / render（疑似已被 PlanDrawsTimelineTable 取代）。
 *
 * 註
 * - 原本 React import 放在檔案底部雖然模組層級仍可運作，但可讀性與工具鏈相容性較差，
 *   這裡改為放到頂部，避免型別/編譯器或 lint 在某些設定下出現誤判。
 */

import type { PlanResult } from "../../../core/planner";
import {
  Avatar,
  Box,
  Collapse,
  IconButton,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

function fmtCost(cost: any): string {
  if (!cost || !Array.isArray(cost)) return "-";
  const [equiv, foodUsed, tUsed, pUsed, lUsed] = cost as any;
  return `equiv=${equiv}, food=${foodUsed}, ticket=${tUsed}, platinum=${pUsed}, legend=${lUsed}`;
}

export function PlanStepsTable(props: {
  result: PlanResult;

  // ✅ 預留：未來 planner 結果或 draws 要加圖片/連結
  getCatHref?: (catId: number) => string | undefined;
  getCatImageUrl?: (catId: number) => string | undefined;
}) {
  const { result, getCatHref, getCatImageUrl } = props;
  const plan = (result.plan || []) as any[];

  const [openRow, setOpenRow] = React.useState<Record<number, boolean>>({});

  if (!plan.length) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography fontWeight={800} sx={{ mb: 0.5 }}>
          Plan Steps
        </Typography>
        <Typography color="text.secondary">
          沒有 step（可能資源不足或 graph 無法走位）
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={800} sx={{ mb: 1 }}>
        Plan Steps
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell width={42} />
              <TableCell width={56}>#</TableCell>
              <TableCell>event</TableCell>
              <TableCell>resource</TableCell>
              <TableCell>method</TableCell>
              <TableCell>from→to</TableCell>
              <TableCell>cost_inc</TableCell>
              <TableCell>draws</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {plan.map((st, i) => {
              const draws = st.draws || [];
              const short =
                draws
                  .slice(0, 6)
                  .map((d: any) =>
                    d.cat_id != null ? `${d.cat_name}#${d.cat_id}` : "-"
                  )
                  .join(", ") + (draws.length > 6 ? " ..." : "");

              const isOpen = Boolean(openRow[i]);

              return (
                <React.Fragment
                  key={`${i}-${st.event_value}-${st.start_cursor_id}`}
                >
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setOpenRow((p) => ({ ...p, [i]: !p[i] }))
                        }
                      >
                        {isOpen ? (
                          <KeyboardArrowUpIcon />
                        ) : (
                          <KeyboardArrowDownIcon />
                        )}
                      </IconButton>
                    </TableCell>

                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{st.event_value}</TableCell>
                    <TableCell>{st.resource}</TableCell>
                    <TableCell>{st.method}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily:
                            "ui-monospace, SFMono-Regular, Menlo, monospace",
                        }}
                      >
                        {st.start_cursor_id} → {st.end_cursor_id}
                      </Typography>
                    </TableCell>
                    <TableCell>{fmtCost(st.cost_inc as any)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {short || "-"}
                      </Typography>
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0 }}>
                      <Collapse in={isOpen} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 1.5 }}>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ mb: 1 }}
                          >
                            Draws（{draws.length}）
                          </Typography>

                          <Stack spacing={0.75}>
                            {draws.map((d: any, idx: number) => {
                              const href =
                                d.cat_id != null
                                  ? getCatHref?.(d.cat_id)
                                  : undefined;
                              const img =
                                d.cat_id != null
                                  ? getCatImageUrl?.(d.cat_id)
                                  : undefined;

                              return (
                                <Stack
                                  key={`${i}-${idx}-${d.from_pos_id}-${
                                    d.cat_id ?? "x"
                                  }`}
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                  sx={{
                                    p: 1,
                                    border: "1px solid",
                                    borderColor: "divider",
                                    borderRadius: 1,
                                  }}
                                >
                                  <Avatar
                                    variant="rounded"
                                    src={img}
                                    sx={{ width: 28, height: 28 }}
                                  >
                                    {d.cat_name?.[0] ?? "?"}
                                  </Avatar>

                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontFamily:
                                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                                    }}
                                  >
                                    {String(idx + 1).padStart(2, "0")}.{" "}
                                    {String(d.used).padEnd(12)} {d.from_pos_id}→
                                    {d.to_pos_id}{" "}
                                  </Typography>

                                  <Typography variant="body2">
                                    {d.cat_id != null ? (
                                      href ? (
                                        <Link
                                          href={href}
                                          target="_blank"
                                          rel="noreferrer"
                                          underline="hover"
                                        >
                                          {d.cat_name}#{d.cat_id}
                                        </Link>
                                      ) : (
                                        `${d.cat_name}#${d.cat_id}`
                                      )
                                    ) : (
                                      "-"
                                    )}
                                  </Typography>

                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ ml: "auto" }}
                                  >
                                    src={d.source_pick_id ?? "-"}
                                  </Typography>
                                </Stack>
                              );
                            })}
                          </Stack>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 1 }}
                          >
                            ✅
                            未來你要更清楚標示：「此步在哪個位置執行、使用哪個卡池、資源消耗、命中目標位置」，
                            建議新增 view-model（不改 planner 核心資料）。
                          </Typography>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

// 為了避免跟你專案 tsconfig 的 jsx runtime 設定衝突：顯式引入 React
import React from "react";
