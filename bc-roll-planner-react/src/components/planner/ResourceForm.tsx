// src/components/planner/ResourceForm.tsx
import { Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

export type PlannerResources = {
  tickets: number;
  platinum_tickets: number;
  legend_tickets: number;
  food: number;
};

export type PlannerConfig = {
  start_pos_id: string;
  max_expansions: number;
};

export function ResourceForm(props: {
  value: PlannerResources;
  cfg: PlannerConfig;
  onChange: (next: PlannerResources) => void;
  onCfgChange: (next: PlannerConfig) => void;
  showAdvanced?: boolean;
}) {
  const { value, cfg, onChange, onCfgChange, showAdvanced = false } = props;

  return (
    <Stack spacing={1.5}>
      <Typography fontWeight={800}>Planner 資源與設定</Typography>

      <Grid container spacing={2} sx={{ maxWidth: 720, width: "100%" }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            fullWidth
            size="small"
            label="金券"
            type="number"
            inputProps={{ min: 0 }}
            value={value.tickets}
            onChange={(e) =>
              onChange({ ...value, tickets: Number(e.target.value) })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            fullWidth
            size="small"
            label="白金券"
            type="number"
            inputProps={{ min: 0 }}
            value={value.platinum_tickets}
            onChange={(e) =>
              onChange({ ...value, platinum_tickets: Number(e.target.value) })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            fullWidth
            size="small"
            label="傳說券"
            type="number"
            inputProps={{ min: 0 }}
            value={value.legend_tickets}
            onChange={(e) =>
              onChange({ ...value, legend_tickets: Number(e.target.value) })
            }
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            fullWidth
            size="small"
            label="貓罐頭"
            type="number"
            inputProps={{ min: 0, step: 100 }}
            value={value.food}
            onChange={(e) =>
              onChange({ ...value, food: Number(e.target.value) })
            }
          />
        </Grid>

        {showAdvanced && (
          <>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="start_pos_id"
                value={cfg.start_pos_id}
                onChange={(e) =>
                  onCfgChange({ ...cfg, start_pos_id: e.target.value })
                }
                placeholder="例如 1A"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                size="small"
                label="max_expansions"
                type="number"
                inputProps={{ min: 1000, step: 1000 }}
                value={cfg.max_expansions}
                onChange={(e) =>
                  onCfgChange({
                    ...cfg,
                    max_expansions: Number(e.target.value),
                  })
                }
              />
            </Grid>
          </>
        )}
      </Grid>
    </Stack>
  );
}
