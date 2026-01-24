import { Box, Typography } from "@mui/material";
import {
  STATUS_STYLE,
  TARGET_BORDER_STYLE,
  TARGET_NODE_STYLE,
} from "../../planViewModel";

export function StepLane(props: {
  lane: "A" | "B";
  countText: string; // 用來組合成 1A / 1B（一般列用）
  text: string;
  status: "normal" | "hit" | "guaranteed";
  isTarget?: boolean;
  hasNext: boolean;
  isEllipsis?: boolean;

  /** ✅ 新增：保底列的另一條線用這個隱藏整格（不顯示圓圈與貓） */
  hideLane?: boolean;
}) {
  const {
    lane,
    countText,
    text,
    status,
    isTarget = false,
    hasNext,
    isEllipsis,
    hideLane = false,
  } = props;

  const laneW = 34;

  // ✅ 若被要求隱藏（保底列的另一條線），就整格變成占位「—」
  if (hideLane) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
        {/* 不顯示圓圈、不顯示連線，但保留同樣寬度避免對齊跑掉 */}
        <Box
        // sx={{
        //   width: laneW,
        //   flex: `0 0 ${laneW}px`,
        //   height: 34,
        // }}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            px: 1,
            py: 0.65,
            borderRadius: 999,
            bgcolor: "action.hover",
            border: "1px solid",
            borderColor: "divider",
            minWidth: 0,
            flex: "1 1 auto",
            opacity: 0.45,
          }}
        >
          <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
            —
          </Typography>
        </Box>
      </Box>
    );
  }

  // ✅ 保底那條 lane：圓圈改顯示「保A/保B」
  const nodeLabel = isEllipsis
    ? ""
    : status === "guaranteed"
      ? "保底"
      : `${countText}${lane}`;

  // ✅ 圓圈固定同尺寸、且大一點
  const nodeSize = isEllipsis ? 12 : 35;

  // ✅ 圓圈字體：依字數縮放，避免超出圓圈
  const labelLen = nodeLabel.length;
  const fontSize = isEllipsis
    ? 0
    : labelLen <= 2
      ? 13
      : labelLen === 3
        ? 11
        : 9;

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
                fontSize,
                maxWidth: nodeSize - 8,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {nodeLabel}
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
