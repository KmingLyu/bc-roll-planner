// src/components/planner/PlanResultStatsCard.tsx
import React, { useMemo } from "react";
import type { PlanResult } from "../../core/planner";
import type { TrackGraph } from "../../../shared/models";
import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
  Divider,
} from "@mui/material";
import { actionLabelFromStep, ACTIONS } from "./planViewModel";

export function PlanResultStatsCard(props: {
  result: PlanResult;
  graphsByEvent: Record<string, TrackGraph>;
  catNameById: Map<number, string>;
}) {
  const { result, graphsByEvent, catNameById } = props;

  const stats = useMemo(() => {
    const byAction = new Map<string, number>();
    const byEvent = new Map<string, number>();

    for (const a of ACTIONS) byAction.set(a, 0);

    const plan = (result.plan || []) as any[];
    for (const st of plan) {
      const label = actionLabelFromStep(st);
      const drawsLen = Array.isArray(st.draws) ? st.draws.length : 0;

      byAction.set(
        label,
        (byAction.get(label) || 0) + (st.method === "ten" ? 1 : 1)
      );

      // 這裡 byEvent 統計「draws 數量」（更符合你要看的結果）
      const ev = String(st.event_value || "");
      byEvent.set(ev, (byEvent.get(ev) || 0) + drawsLen);
    }

    // const hitNames = (result.targets_hit_ids || []).map(
    //   (id) => `${catNameById.get(id) ?? "?"}#${id}`
    // );
    // const missNames = (result.targets_missing_ids || []).map(
    //   (id) => `${catNameById.get(id) ?? "?"}#${id}`
    // );

    const hitTargets = (result.targets_hit_ids || []).map((id) => ({
      id,
      name: catNameById.get(id) ?? "?",
    }));
    const missTargets = (result.targets_missing_ids || []).map((id) => ({
      id,
      name: catNameById.get(id) ?? "?",
    }));

    // return { byAction, byEvent, hitNames, missNames };
    return { byAction, byEvent, hitTargets, missTargets };
  }, [result, catNameById]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography fontWeight={900}>統計結果</Typography>

        <Alert severity={result.success ? "success" : "warning"}>
          {result.success
            ? "成功：命中全部目標"
            : "未完全命中：顯示目前最佳部分解"}
        </Alert>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label={`命中 ${result.targets_hit}/${result.targets_total}`}
            color={result.success ? "success" : "warning"}
            variant="outlined"
          />
          <Chip
            label={`結束位置 ${result.final_cursor_id}`}
            variant="outlined"
          />
          {/* <Chip label={`equiv ${result.equiv_cost}`} variant="outlined" /> */}
          {/* <Chip label={`金券 ${result.tickets_used}`} variant="outlined" /> */}
          {/* <Chip label={`白金券 ${result.platinum_used}`} variant="outlined" /> */}
          {/* <Chip label={`傳說券 ${result.legend_used}`} variant="outlined" /> */}
          {/* <Chip label={`罐頭 ${result.food_used}`} variant="outlined" /> */}
          <Chip
            label={`抽卡步驟 ${result.plan?.length ?? 0}`}
            variant="outlined"
          />
          <Chip
            label={`抽中貓咪總數 ${result.all_draws?.length ?? 0}`}
            variant="outlined"
          />
        </Stack>

        <Divider />

        <Box>
          <Typography variant="body2" fontWeight={800} sx={{ mb: 0.5 }}>
            花費資源
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Array.from(stats.byAction.entries()).map(([k, v]) => (
              <Chip key={k} label={`${k} × ${v}`} variant="outlined" />
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="body2" fontWeight={800} sx={{ mb: 0.5 }}>
            每個卡池抽中貓咪數量
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {Array.from(stats.byEvent.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([ev, cnt]) => {
                const name = graphsByEvent[ev]?.event?.name || ev;
                return (
                  <Chip
                    key={ev}
                    label={`${name}：${cnt}`}
                    variant="outlined"
                    title={name}
                  />
                );
              })}
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="body2" fontWeight={800} sx={{ mb: 0.5 }}>
            命中目標
          </Typography>
          {/* {stats.hitNames.length ? ( */}
          {stats.hitTargets.length ? (
            <Typography variant="body2" color="text.secondary">
              {/* {stats.hitNames.join(", ")} */}
              {stats.hitTargets.map((t) => t.name).join(", ")}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              （尚未命中）
            </Typography>
          )}
        </Box>

        {/* {!!stats.missNames.length && ( */}
        {!!stats.missTargets.length && (
          <Box>
            <Typography variant="body2" fontWeight={800} sx={{ mb: 0.5 }}>
              未命中目標
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {/* {stats.missNames.slice(0, 12).join(", ")} */}
              {stats.missTargets
                .slice(0, 12)
                .map((t) => t.name)
                .join(", ")}
              {/* {stats.missNames.length > 12 ? " ..." : ""} */}
              {stats.missTargets.length > 12 ? " ..." : ""}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
