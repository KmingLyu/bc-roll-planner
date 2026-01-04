// src/components/simulator/SimulatorPanel.tsx
import { useMemo, useState } from "react";
import type { TrackGraph } from "../../../shared/models";
import { simulateOnGraph, type DrawRecord } from "../../core/simulator";
import {
  Alert,
  Button,
  ButtonGroup,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

export function SimulatorPanel(props: {
  graph: TrackGraph | null;
  graphReady: boolean;
}) {
  const { graph, graphReady } = props;

  const [cursorId, setCursorId] = useState<string>("1A");
  const [prevCatId, setPrevCatId] = useState<number | null>(null);
  const [records, setRecords] = useState<DrawRecord[]>([]);
  const [text, setText] = useState<string>("");

  const eventValue = useMemo(() => graph?.event?.value ?? "", [graph]);

  function reset() {
    setCursorId("1A");
    setPrevCatId(null);
    setRecords([]);
    setText("");
  }

  function append(method: "single" | "ten") {
    if (!graphReady || !graph) {
      setText("");
      return;
    }

    try {
      const { records: newRecs, final_cursor } = simulateOnGraph({
        graph,
        actions: [{ event_value: eventValue, method }],
        start_pos_id: cursorId,
      });

      const last = newRecs.length ? newRecs[newRecs.length - 1] : null;
      const nextPrev = last?.cat_id ?? null;

      const baseStep = records.length;
      const rebased = newRecs.map((r) => ({ ...r, step: r.step + baseStep }));
      const nextAll = [...records, ...rebased];

      setRecords(nextAll);
      setCursorId(final_cursor.id);
      setPrevCatId(nextPrev);

      const lines = nextAll.map(
        (r) =>
          `${String(r.step).padStart(3, " ")} | ${r.method.padEnd(
            6
          )} | ${String(r.within_action_index).padStart(2, " ")} | ${
            r.from_pos_id
          } -> ${r.to_pos_id} | ${r.used} | ${r.cat_id ?? "-"} ${
            r.cat_name
          } | src=${r.source_pick_id ?? "-"}`
      );

      setText(
        [
          `cursor=${final_cursor.id}  prevCatId=${nextPrev ?? "-"}`,
          `total_records=${nextAll.length}`,
          "",
          ...lines,
        ].join("\n")
      );
    } catch (e: any) {
      setText(`simulate failed: ${String(e?.message || e)}`);
    }
  }

  return (
    <Stack spacing={1.5}>
      {!graphReady && (
        <Alert severity="info">
          需要 TrackGraph 才能使用（按 Planner 會自動抓最新）
        </Alert>
      )}

      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <ButtonGroup variant="outlined" size="small" disabled={!graphReady}>
          <Button onClick={() => append("single")}>單抽一次</Button>
          <Button onClick={() => append("ten")}>十連一次</Button>
        </ButtonGroup>

        <Button variant="text" onClick={reset}>
          重設（回到 1A）
        </Button>

        <Typography variant="body2" color="text.secondary">
          cursor：<b>{cursorId}</b>，prevCatId：<b>{prevCatId ?? "-"}</b>
          ，records：<b>{records.length}</b>
        </Typography>
      </Stack>

      {text && (
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
            {text}
          </Typography>
        </Paper>
      )}
    </Stack>
  );
}
