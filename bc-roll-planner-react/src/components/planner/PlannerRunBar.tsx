// src/components/planner/PlannerRunBar.tsx
import {
  Alert,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";

type LoadState = "idle" | "loading" | "ok" | "error";

export function PlannerRunBar(props: {
  state: LoadState;
  onRun: () => void;
  disabled: boolean;
  hint?: string;
  error?: string;
}) {
  const { state, onRun, disabled, hint, error } = props;

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Button
          variant="contained"
          onClick={onRun}
          disabled={disabled}
          startIcon={
            state === "loading" ? <CircularProgress size={16} /> : undefined
          }
        >
          開始執行
        </Button>

        <Typography variant="body2" color="text.secondary">
          狀態：<b>{state}</b>
        </Typography>

        {hint && (
          <Typography variant="body2" color="warning.main">
            {hint}
          </Typography>
        )}
      </Stack>

      {state === "error" && error && (
        <Alert severity="error">planner 錯誤：{error}</Alert>
      )}
      {state === "loading" && (
        <Alert severity="info">規劃中…（worker 計算中）</Alert>
      )}
    </Stack>
  );
}
