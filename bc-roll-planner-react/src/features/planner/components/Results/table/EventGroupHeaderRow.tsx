import { Box, TableCell, TableRow, Typography } from "@mui/material";
import { getEventDisplayLines } from "@/utils/event-display";
import type { EventRunMeta } from "../types";

export function EventGroupHeaderRow(props: {
  colSpan: number;
  eventRun: EventRunMeta;
}) {
  const { colSpan, eventRun } = props;
  const { dateText, nameText, titleText } = getEventDisplayLines({
    name: eventRun.eventName,
    raw_name: eventRun.eventRawName,
    start_date: eventRun.eventStartDate,
    end_date: eventRun.eventEndDate,
  });

  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ p: 0, borderBottom: 0 }}>
        <Box
          title={titleText}
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 0.75,
            pl: 1.25,
            pr: 0.5,
            py: 0.45,
            borderLeft: "2px solid",
            borderLeftColor: eventRun.color,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: 999,
              bgcolor: eventRun.color,
              flex: "0 0 auto",
              mt: 0.3,
            }}
          />

          <Box sx={{ minWidth: 0, flex: "1 1 auto" }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                lineHeight: 1.1,
                fontSize: "0.68rem",
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
                mt: 0.15,
                lineHeight: 1.2,
                fontSize: "0.74rem",
                wordBreak: "break-word",
              }}
            >
              {nameText}
            </Typography>
          </Box>
        </Box>
      </TableCell>
    </TableRow>
  );
}
