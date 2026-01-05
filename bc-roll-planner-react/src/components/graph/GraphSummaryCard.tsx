// src/components/graph/GraphSummaryCard.tsx
import { useMemo, useState } from "react";
import type { TrackGraph } from "../../../shared/models";
import {
  Alert,
  Box,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
  LinearProgress,
} from "@mui/material";

type LoadState = "idle" | "loading" | "ok" | "error";

function safeJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function getNormalCatName(g: TrackGraph | null, posId: string): string {
  const node = g?.nodes?.[posId];
  const cat = node?.edges?.normal?.cat;
  return cat?.name || "-";
}

export function GraphSummaryCard(props: {
  seedApplied: string;
  countApplied: number | null;
  selectedEventValue: string;

  graphState: LoadState;
  graphErr: string;
  graph: TrackGraph | null;
}) {
  const {
    seedApplied,
    countApplied,
    selectedEventValue,
    graphState,
    graphErr,
    graph,
  } = props;

  const [showRaw, setShowRaw] = useState(false);

  const nodesCount = useMemo(
    () => (graph ? Object.keys(graph.nodes || {}).length : 0),
    [graph]
  );
  const cat1A = useMemo(() => getNormalCatName(graph, "1A"), [graph]);
  const cat1B = useMemo(() => getNormalCatName(graph, "1B"), [graph]);

  const seedText = seedApplied.trim() ? seedApplied : "-";
  const countText =
    typeof countApplied === "number" &&
    Number.isFinite(countApplied) &&
    countApplied > 0
      ? String(countApplied)
      : "-";

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        目前參數：seed=<b>{seedText}</b>，count=<b>{countText}</b>，event=
        <b>{selectedEventValue || "-"}</b>
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          狀態：<b>{graphState}</b>
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={showRaw}
              onChange={(e) => setShowRaw(e.target.checked)}
            />
          }
          label="顯示 raw JSON"
        />
      </Stack>

      {graphState === "loading" && <LinearProgress />}

      {graphState === "error" && (
        <Alert severity="error">trackGraph 錯誤：{graphErr}</Alert>
      )}

      {graphState === "idle" && (
        <Alert severity="info">
          尚未抓取 TrackGraph（按 Planner 時會自動抓最新）
        </Alert>
      )}

      {graphState === "ok" && graph && (
        <Box>
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            <Typography>
              <b>nodes count</b>：{nodesCount}
            </Typography>
            <Typography>
              <b>1A normal</b>：{cat1A}
            </Typography>
            <Typography>
              <b>1B normal</b>：{cat1B}
            </Typography>
          </Stack>

          {showRaw && (
            <Paper
              variant="outlined"
              sx={{ p: 1.5, overflow: "auto", maxHeight: 420 }}
            >
              <Typography
                component="pre"
                sx={{
                  m: 0,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 12,
                  whiteSpace: "pre",
                }}
              >
                {safeJson(graph)}
              </Typography>
            </Paper>
          )}
        </Box>
      )}
    </Stack>
  );
}
