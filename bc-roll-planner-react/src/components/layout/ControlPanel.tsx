// src/components/layout/ControlPanel.tsx
import {
  Card,
  CardContent,
  CardHeader,
  FormControlLabel,
  FormGroup,
  Stack,
  Switch,
  Typography,
} from "@mui/material";

export type UiFlags = {
  showControlPanel: boolean;

  showSeedCount: boolean;
  seedCountCollapsed: boolean;

  showEvents: boolean;
  eventsCollapsed: boolean;

  showTargetCats: boolean;
  targetCatsCollapsed: boolean;

  showPlanner: boolean;
  plannerCollapsed: boolean;

  showPlannerResultSummary: boolean;
  plannerResultSummaryCollapsed: boolean;

  showPlannerResultTable: boolean;
  plannerResultTableCollapsed: boolean;

  showGraphDebug: boolean;
  graphDebugCollapsed: boolean;

  showSimulator: boolean;
  simulatorCollapsed: boolean;
};

export function ControlPanel(props: {
  value: UiFlags;
  onChange: (next: UiFlags) => void;
}) {
  const { value, onChange } = props;

  function set<K extends keyof UiFlags>(key: K, v: UiFlags[K]) {
    onChange({ ...value, [key]: v });
  }

  const rows: Array<{ key: keyof UiFlags; label: string }> = [
    { key: "showSeedCount", label: "顯示 Seed/Count" },
    { key: "showEvents", label: "顯示 Events" },
    { key: "showTargetCats", label: "顯示 Target Cats" },
    { key: "showPlanner", label: "顯示 Planner" },
    { key: "showPlannerResultSummary", label: "顯示 Planner 結果摘要" },
    { key: "showPlannerResultTable", label: "顯示 Planner 結果表格" },
    { key: "showGraphDebug", label: "顯示 Graph Debug" },
    { key: "showSimulator", label: "顯示 Simulator" },
  ];

  return (
    <Card variant="outlined">
      <CardHeader
        title="顯示設定（快速開關區塊）"
        slotProps={{
          title: {
            sx: { fontWeight: 800 },
          },
        }}
        action={
          <FormControlLabel
            control={
              <Switch
                checked={value.showControlPanel}
                onChange={(e) => set("showControlPanel", e.target.checked)}
              />
            }
            label="顯示面板"
          />
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={1}>
          <FormGroup row>
            {rows.map((r) => (
              <FormControlLabel
                key={String(r.key)}
                control={
                  <Switch
                    checked={Boolean(value[r.key])}
                    onChange={(e) => set(r.key, e.target.checked as any)}
                  />
                }
                label={r.label}
              />
            ))}
          </FormGroup>

          <Typography variant="body2" color="text.secondary">
            收合狀態也可在各區塊標題列直接切換；未來做 UI/UX
            調整時，這裡可以很快關掉某些區塊。
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
