// src/shared/ui/Section.tsx
import type { ReactNode } from "react";
import {
  Box,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export function Section(props: {
  title: string;

  /** 是否收合（僅在 collapsible=true 時才有意義） */
  collapsed?: boolean;

  /** 是否允許收合功能（預設 true） */
  collapsible?: boolean;

  /** header 是否可點（預設等於 collapsible） */
  headerClickable?: boolean;

  onToggleCollapsed?: () => void;
  onHide?: () => void;

  children: ReactNode;
  sx?: object;
}) {
  const {
    title,
    collapsed = false,
    collapsible = true,
    headerClickable = collapsible,
    onToggleCollapsed,
    onHide, // 先保留介面，暫不使用
    children,
    sx,
  } = props;

  const canToggle = collapsible && !!onToggleCollapsed;

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        ...sx,
      }}
    >
      {/* Header（箭頭在左側，右=收合、下=展開） */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        role={headerClickable ? "button" : undefined}
        tabIndex={headerClickable ? 0 : undefined}
        onClick={headerClickable ? onToggleCollapsed : undefined}
        onKeyDown={
          headerClickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onToggleCollapsed?.();
                }
              }
            : undefined
        }
        sx={(theme) => ({
          width: "100%",
          minWidth: 0,
          py: 1,
          cursor: headerClickable ? "pointer" : "default",
          userSelect: "none",
          // borderBottom: `1px solid ${theme.palette.divider}`,
        })}
      >
        {/* Left: chevron + title */}
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ minWidth: 0 }}
        >
          {collapsible && (
            <Tooltip title={collapsed ? "展開" : "收合"}>
              <IconButton
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapsed?.();
                }}
                size="small"
                disabled={!canToggle}
                sx={{
                  flex: "0 0 auto",
                  // collapsed: 右箭頭；展開: 旋轉 90 度變下箭頭
                  transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                  transition: "transform 180ms ease",
                }}
              >
                <ChevronRightIcon />
              </IconButton>
            </Tooltip>
          )}

          <Typography
            variant="subtitle1"
            component="div"
            noWrap
            sx={{
              minWidth: 0,
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: 0.2,
              color: "text.primary",
            }}
          >
            {title}
          </Typography>
        </Stack>

        {/* Right: 保留空間（如果未來要放 actions） */}
        <Box sx={{ flex: "0 0 auto" }} />
      </Stack>

      {/* Content */}
      {collapsible ? (
        <Collapse in={!collapsed} timeout={120} unmountOnExit>
          <Box sx={{ pt: 1, width: "100%", minWidth: 0 }}>{children}</Box>
        </Collapse>
      ) : (
        <Box sx={{ pt: 1, width: "100%", minWidth: 0 }}>{children}</Box>
      )}
    </Box>
  );
}
