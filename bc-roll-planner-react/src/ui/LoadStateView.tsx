import { Alert, Box, CircularProgress } from "@mui/material";
import type { LoadState } from "./types";

type Props = {
  state: LoadState;
  error?: string;
  loadingText?: string;
  errorTitle?: string;
};

export function LoadStateView({
  state,
  error,
  loadingText = "載入中...",
  errorTitle = "發生錯誤",
}: Props) {
  if (state === "loading") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
        <CircularProgress size={18} />
        <Box sx={{ opacity: 0.8 }}>{loadingText}</Box>
      </Box>
    );
  }

  if (state === "error") {
    return (
      <Alert severity="error" sx={{ mt: 1 }}>
        <b>{errorTitle}</b>
        <div style={{ marginTop: 6 }}>{error || "-"}</div>
      </Alert>
    );
  }

  return null;
}
