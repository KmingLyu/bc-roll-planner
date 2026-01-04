import { Box, Button, TextField, Typography } from "@mui/material";
import type { TrackGraph } from "../../../shared/models";
import type { LoadState } from "../../ui/types";
import { SectionCard } from "../../ui/SectionCard";
import { LoadStateView } from "../../ui/LoadStateView";
import { JsonPreview } from "../../ui/JsonPreview";

function getNormalCatName(g: TrackGraph | null, posId: string): string {
  const node = g?.nodes?.[posId];
  const cat = node?.edges?.normal?.cat;
  return cat?.name || "-";
}

export type TrackGraphSectionProps = {
  seed: string;
  count: number;
  activeEventValue: string;

  onChangeSeed: (v: string) => void;
  onChangeCount: (v: number) => void;
  onChangeEventValue: (v: string) => void;

  loadState: LoadState;
  graph: TrackGraph | null;
  error: string;
  onFetch: () => void;

  showRaw: boolean;
  onToggleRaw: (v: boolean) => void;
};

export function TrackGraphSection({
  seed,
  count,
  activeEventValue,
  onChangeSeed,
  onChangeCount,
  onChangeEventValue,
  loadState,
  graph,
  error,
  onFetch,
  showRaw,
  onToggleRaw,
}: TrackGraphSectionProps) {
  const nodesCount = graph ? Object.keys(graph.nodes || {}).length : 0;
  const cat1A = getNormalCatName(graph, "1A");
  const cat1B = getNormalCatName(graph, "1B");

  return (
    <SectionCard
      title="2) TrackGraph"
      action={
        <Button
          size="small"
          onClick={onFetch}
          disabled={loadState === "loading"}
          variant="contained"
        >
          呼叫 trackGraph
        </Button>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "140px 1fr" },
          gap: 1.2,
          maxWidth: 720,
        }}
      >
        <div>seed</div>
        <TextField
          size="small"
          value={seed}
          onChange={(e) => onChangeSeed(e.target.value)}
        />

        <div>count</div>
        <TextField
          size="small"
          type="number"
          inputProps={{ min: 1 }}
          value={count}
          onChange={(e) => onChangeCount(Number(e.target.value))}
        />

        <div>event</div>
        <TextField
          size="small"
          value={activeEventValue}
          onChange={(e) => onChangeEventValue(e.target.value)}
          placeholder="可用 events 下拉選，或手動貼上 event value"
        />
      </Box>

      <Box sx={{ mt: 1 }}>
        <Typography variant="body2">
          狀態：<b>{loadState}</b>
        </Typography>
      </Box>

      <LoadStateView
        state={loadState}
        error={error}
        errorTitle="trackGraph 錯誤"
      />

      {loadState === "ok" && graph ? (
        <Box sx={{ mt: 2, display: "grid", gap: 0.6 }}>
          <div>
            <b>nodes count</b>：{nodesCount}
          </div>
          <div>
            <b>1A normal</b>：{cat1A}
          </div>
          <div>
            <b>1B normal</b>：{cat1B}
          </div>

          <JsonPreview
            show={showRaw}
            onToggle={onToggleRaw}
            value={graph}
            maxHeight={420}
          />
        </Box>
      ) : null}
    </SectionCard>
  );
}
