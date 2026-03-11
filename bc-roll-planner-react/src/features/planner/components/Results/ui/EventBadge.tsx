import { Box, Typography } from "@mui/material";
import { getEventDisplayLines } from "@/utils/event-display";

export function EventBadge(props: {
  eventName: string;
  eventRawName: string;
  eventStartDate: string | null;
  eventEndDate: string | null;
  eventValue: string;
  colorOf: (ev: string) => string;
  tintOf: (ev: string) => string;
}) {
  const {
    eventValue,
    eventName,
    eventRawName,
    eventStartDate,
    eventEndDate,
    colorOf,
    tintOf,
  } = props;
  const { dateText, nameText, titleText } = getEventDisplayLines({
    name: eventName,
    raw_name: eventRawName,
    start_date: eventStartDate,
    end_date: eventEndDate,
  });

  return (
    <Box
      title={titleText}
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        px: 1,
        py: 0.75,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: colorOf(eventValue),
        bgcolor: tintOf(eventValue),
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: 999,
          bgcolor: colorOf(eventValue),
          flex: "0 0 auto",
          mt: 0.45,
        }}
      />
      <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: "block",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {dateText}
        </Typography>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{
            mt: 0.25,
            minWidth: 0,
            lineHeight: 1.3,
            wordBreak: "break-word",
            display: "-webkit-box",
            overflow: "hidden",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
          }}
        >
          {nameText}
        </Typography>
      </Box>
    </Box>
  );
}
