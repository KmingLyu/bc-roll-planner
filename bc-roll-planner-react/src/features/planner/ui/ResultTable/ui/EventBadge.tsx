import { Box, Typography } from "@mui/material";

export function EventBadge(props: {
  evKey: string;
  colorOf: (ev: string) => string;
  tintOf: (ev: string) => string;
}) {
  const { evKey, colorOf, tintOf } = props;

  return (
    <Box
      title={evKey}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        py: 0.6,
        borderRadius: 999,
        border: "1px solid",
        borderColor: colorOf(evKey),
        bgcolor: tintOf(evKey),
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: 999,
          bgcolor: colorOf(evKey),
          flex: "0 0 auto",
        }}
      />
      <Typography
        variant="caption"
        fontWeight={900}
        noWrap
        sx={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: "1 1 auto",
        }}
      >
        {evKey}
      </Typography>
    </Box>
  );
}
