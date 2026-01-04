import { Box, Button, TextField, Typography } from "@mui/material";
import type { LoadState } from "../../ui/types";
import { SectionCard } from "../../ui/SectionCard";
import { LoadStateView } from "../../ui/LoadStateView";
import type { PlanResult } from "../../core/planner";
import { PlannerResultView } from "./PlannerResultView";

export type PlannerResources = {
  tickets: number;
  platinum: number;
  legend: number;
  food: number;
  startPosId: string;
  maxExpansions: number;
};

export type PlannerSectionProps = {
  disabled: boolean;
  loadState: LoadState;
  error: string;

  resources: PlannerResources;
  onChangeResources: (next: Partial<PlannerResources>) => void;

  onRun: () => void;

  result: PlanResult | null;
  catNameById: Map<number, string>;

  showRaw: boolean;
  onToggleRaw: (v: boolean) => void;
};

export function PlannerSection({
  disabled,
  loadState,
  error,
  resources,
  onChangeResources,
  onRun,
  result,
  catNameById,
  showRaw,
  onToggleRaw,
}: PlannerSectionProps) {
  return (
    <SectionCard
      title="2.5) Planner Result"
      action={
        <Button
          variant="contained"
          size="small"
          onClick={onRun}
          disabled={disabled || loadState === "loading"}
        >
          規劃（planner）
        </Button>
      }
    >
      <Typography variant="body2">
        狀態：<b>{loadState}</b>
      </Typography>

      <Box
        sx={{
          mt: 2,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "140px 1fr" },
          gap: 1.2,
          maxWidth: 560,
        }}
      >
        <div>tickets</div>
        <TextField
          size="small"
          type="number"
          inputProps={{ min: 0 }}
          value={resources.tickets}
          onChange={(e) =>
            onChangeResources({ tickets: Number(e.target.value) })
          }
        />

        <div>platinum</div>
        <TextField
          size="small"
          type="number"
          inputProps={{ min: 0 }}
          value={resources.platinum}
          onChange={(e) =>
            onChangeResources({ platinum: Number(e.target.value) })
          }
        />

        <div>legend</div>
        <TextField
          size="small"
          type="number"
          inputProps={{ min: 0 }}
          value={resources.legend}
          onChange={(e) =>
            onChangeResources({ legend: Number(e.target.value) })
          }
        />

        <div>food</div>
        <TextField
          size="small"
          type="number"
          inputProps={{ min: 0, step: 100 }}
          value={resources.food}
          onChange={(e) => onChangeResources({ food: Number(e.target.value) })}
        />

        <div>start_pos_id</div>
        <TextField
          size="small"
          value={resources.startPosId}
          onChange={(e) => onChangeResources({ startPosId: e.target.value })}
          placeholder="例如 1A"
        />

        <div>max_expansions</div>
        <TextField
          size="small"
          type="number"
          inputProps={{ min: 1000, step: 1000 }}
          value={resources.maxExpansions}
          onChange={(e) =>
            onChangeResources({ maxExpansions: Number(e.target.value) })
          }
        />
      </Box>

      <LoadStateView
        state={loadState}
        error={error}
        errorTitle="planner 錯誤"
        loadingText="規劃中..."
      />

      {loadState === "ok" && result ? (
        <PlannerResultView
          result={result}
          catNameById={catNameById}
          showRaw={showRaw}
          onToggleRaw={onToggleRaw}
        />
      ) : null}
    </SectionCard>
  );
}
