import { Stack, TextField } from "@mui/material";
import InputAdornment from "@mui/material/InputAdornment";
import Grid from "@mui/material/Grid";
import NumberField from "@/components/inputs/NumberField";
import type {
  PlannerResources,
  PlannerUiConfig,
} from "@/features/planner/types";

function ResourceAdornment({ src }: { src: string }) {
  return (
    <InputAdornment position="start">
      <img src={src} alt="" height={40} style={{ display: "block" }} />
    </InputAdornment>
  );
}

export function ResourceForm(props: {
  value: PlannerResources;
  cfg: PlannerUiConfig;
  onChange: (next: PlannerResources) => void;
  onCfgChange: (next: PlannerUiConfig) => void;
  showAdvanced?: boolean;
}) {
  const { value, cfg, onChange, onCfgChange, showAdvanced = false } = props;

  return (
    <Stack spacing={1.25} sx={{ width: "100%" }}>
      <Grid
        container
        spacing={1.25}
        sx={{ width: "100%", justifyContent: "space-between" }}
      >
        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <NumberField
            label="金券"
            startAdornment={<ResourceAdornment src="/稀有券.png" />}
            min={0}
            size="small"
            value={value.tickets}
            onValueChange={(v) =>
              onChange({
                ...value,
                tickets: Math.max(0, v ?? 0),
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <NumberField
            label="白金券"
            startAdornment={<ResourceAdornment src="/白金券.png" />}
            min={0}
            size="small"
            value={value.platinum_tickets}
            onValueChange={(v) =>
              onChange({
                ...value,
                platinum_tickets: Math.max(0, v ?? 0),
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <NumberField
            label="傳說券"
            startAdornment={<ResourceAdornment src="/傳說券.png" />}
            min={0}
            size="small"
            value={value.legend_tickets}
            onValueChange={(v) =>
              onChange({
                ...value,
                legend_tickets: Math.max(0, v ?? 0),
              })
            }
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <NumberField
            label="罐頭"
            startAdornment={<ResourceAdornment src="/貓罐頭.png" />}
            min={0}
            size="small"
            value={value.food}
            onValueChange={(v) =>
              onChange({
                ...value,
                food: Math.max(0, v ?? 0),
              })
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
