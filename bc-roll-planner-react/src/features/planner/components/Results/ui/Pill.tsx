import { Box, Typography } from "@mui/material";
import type { ActionLabel } from "../../../logic/view-model";
import { ResourceImg } from "../../ResourceImg";

export function Pill(props: {
  text: string;
  tone?: "normal" | "strong";
  actionLabel?: ActionLabel;
}) {
  const { text, tone = "normal", actionLabel } = props;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        py: 0.4,
        borderRadius: 999,
        bgcolor: tone === "strong" ? "action.selected" : "action.hover",
        border: "1px solid",
        borderColor: "divider",
        maxWidth: "100%",
      }}
      title={text}
      aria-label={text}
    >
      {actionLabel ? (
        <ResourceImg label={actionLabel} height={18} />
      ) : (
        <Typography
          variant="caption"
          fontWeight={900}
          noWrap
          sx={{ minWidth: 0 }}
        >
          {text}
        </Typography>
      )}
    </Box>
  );
}
