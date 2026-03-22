import { Box, Typography } from "@mui/material";
import type { ActionLabel } from "../logic/view-model";

const ACTION_IMAGE: Record<ActionLabel, string> = {
  金券: "/稀有券.png",
  白金券: "/白金券.png",
  傳說券: "/傳說券.png",
  罐頭: "/貓罐頭.png",
  "10連抽": "/貓罐頭.png",
};

const ACTION_COUNT: Partial<Record<ActionLabel, number>> = {
  罐頭: 150,
  "10連抽": 1500,
};

export function ResourceImg({
  label,
  height = 20,
  showCount = true,
}: {
  label: ActionLabel;
  height?: number;
  showCount?: boolean;
}) {
  const src = ACTION_IMAGE[label];
  const count = showCount ? ACTION_COUNT[label] : undefined;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <img src={src} alt={label} height={height} style={{ display: "block" }} />
      {count != null && (
        <Typography
          component="span"
          sx={{ fontSize: "0.65rem", fontWeight: 900, lineHeight: 1 }}
        >
          × {count}
        </Typography>
      )}
    </Box>
  );
}
