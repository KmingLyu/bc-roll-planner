import { Box, Typography } from "@mui/material";

export function Pill(props: { text: string; tone?: "normal" | "strong" }) {
  const { text, tone = "normal" } = props;
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
      <Typography
        variant="caption"
        fontWeight={900}
        noWrap
        sx={{ minWidth: 0 }}
      >
        {text}
      </Typography>
    </Box>
  );
}
