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
  variant?: "default" | "planner";
  headerBorderBottom?: string;

  /** 是否收合（僅在 collapsible=true 時才有意義） */
  collapsed?: boolean;

  /** 是否允許收合功能（預設 true） */
  collapsible?: boolean;

  /** header 是否可點（預設等於 collapsible） */
  headerClickable?: boolean;
  headerRight?: ReactNode;

  onToggleCollapsed?: () => void;
  onHide?: () => void;

  children: ReactNode;
  sx?: object;
}) {
  const {
    title,
    variant = "default",
    headerBorderBottom,
    collapsed = false,
    collapsible = true,
    headerClickable = collapsible,
    headerRight,
    onToggleCollapsed,
    onHide, // 先保留介面，暫不使用
    children,
    sx,
  } = props;

  const canToggle = collapsible && !!onToggleCollapsed;
  const isPlannerVariant = variant === "planner";
  const resolvedHeaderBorderBottom =
    headerBorderBottom ?? (isPlannerVariant ? "1px solid" : "none");

  return (
    <Box
      sx={{
        width: "100%",
        minWidth: 0,
        px: isPlannerVariant ? 0 : { xs: 1, sm: 1.25 },
        py: isPlannerVariant ? 0 : { xs: 0.75, sm: 1 },
        borderRadius: isPlannerVariant ? 0 : 1.75,
        border: isPlannerVariant ? "none" : "1px solid",
        borderColor: "divider",
        backgroundColor: isPlannerVariant ? "transparent" : "background.paper",
        boxShadow: isPlannerVariant
          ? "none"
          : "0 1px 4px rgba(15, 23, 42, 0.04)",
        ...sx,
      }}
    >
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
        sx={{
          width: "100%",
          minWidth: 0,
          py: isPlannerVariant ? 0.9 : 0.4,
          px: isPlannerVariant ? { xs: 0.5, sm: 0.75 } : 0,
          cursor: headerClickable ? "pointer" : "default",
          userSelect: "none",
          borderBottom: resolvedHeaderBorderBottom,
          borderColor: "divider",
        }}
      >
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ minWidth: 0, flex: 1 }}
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
                  transform: collapsed ? "rotate(0deg)" : "rotate(90deg)",
                  transition: "transform 180ms ease",
                  ...(isPlannerVariant
                    ? {
                        "&:hover": { bgcolor: "transparent" },
                      }
                    : {}),
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
              fontWeight: isPlannerVariant ? 800 : 700,
              lineHeight: 1.2,
              letterSpacing: 0.2,
              color: "text.primary",
            }}
          >
            {title}
          </Typography>
        </Stack>

        {headerRight && (
          <Box
            sx={{ flex: "0 0 auto" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {headerRight}
          </Box>
        )}
      </Stack>

      {collapsible ? (
        <Collapse in={!collapsed} timeout={120} unmountOnExit>
          <Box
            sx={{
              pt: isPlannerVariant ? 1 : 0.9,
              pb: isPlannerVariant ? 0.5 : 0,
              px: isPlannerVariant ? { xs: 0.5, sm: 0.75 } : 0,
              width: "100%",
              minWidth: 0,
            }}
          >
            {children}
          </Box>
        </Collapse>
      ) : (
        <Box
          sx={{
            pt: isPlannerVariant ? 1 : 0.9,
            pb: isPlannerVariant ? 0.5 : 0,
            px: isPlannerVariant ? { xs: 0.5, sm: 0.75 } : 0,
            width: "100%",
            minWidth: 0,
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}
