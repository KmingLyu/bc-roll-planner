import { Box, Typography } from "@mui/material";
import {
  STATUS_STYLE,
  TARGET_BORDER_STYLE,
  TARGET_NODE_STYLE,
} from "../../planViewModel";

export function StepLane(props: {
  lane: "A" | "B";
  text: string;
  status: "normal" | "hit" | "guaranteed";
  isTarget?: boolean;
  hasNext: boolean;
  isEllipsis?: boolean;
}) {
  const { lane, text, status, isTarget = false, hasNext, isEllipsis } = props;
  const laneW = 26;
  const nodeSize = isEllipsis ? 10 : 18;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
      <Box
        sx={{
          position: "relative",
          width: laneW,
          flex: `0 0 ${laneW}px`,
          height: 34,
          display: "grid",
          placeItems: "center",
        }}
      >
        {hasNext && (
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              top: isEllipsis ? 18 : 20,
              bottom: -16,
              width: 2,
              transform: "translateX(-50%)",
              bgcolor: "divider",
              borderRadius: 999,
              ...(isEllipsis
                ? {
                    bgcolor: "transparent",
                    borderLeft: "2px dashed",
                    borderColor: "divider",
                    width: 0,
                  }
                : null),
            }}
          />
        )}

        <Box
          sx={{
            width: nodeSize,
            height: nodeSize,
            borderRadius: 999,
            bgcolor: isEllipsis
              ? "background.paper"
              : isTarget
                ? TARGET_NODE_STYLE.bg
                : STATUS_STYLE[status].node,
            border: "2px solid",
            borderColor: isTarget ? TARGET_NODE_STYLE.borderColor : "divider",
            boxShadow: isTarget ? TARGET_NODE_STYLE.ringShadow : "none",
            display: "grid",
            placeItems: "center",
            zIndex: 1,
          }}
        >
          {!isEllipsis && (
            <Typography
              variant="caption"
              fontWeight={900}
              sx={{
                lineHeight: 1,
                color: isTarget ? TARGET_NODE_STYLE.textColor : "text.primary",
              }}
            >
              {lane}
            </Typography>
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1,
          py: 0.65,
          borderRadius: 999,
          bgcolor:
            status === "normal" ? "action.hover" : STATUS_STYLE[status].bg,
          border: "1px solid",
          borderColor: status === "normal" ? "divider" : "transparent",
          minWidth: 0,
          flex: "1 1 auto",
          ...(isTarget ? TARGET_BORDER_STYLE : null),
        }}
        title={text}
      >
        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
          {text}
        </Typography>
      </Box>
    </Box>
  );
}
