// src/components/layout/Section.tsx
import type { ReactNode } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  Collapse,
  IconButton,
  Stack,
  Tooltip,
  Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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
    onHide,
    children,
    sx,
  } = props;

  const canToggle = collapsible && !!onToggleCollapsed;

  return (
    <Box sx={{ width: "100%", ...sx }}>
      <Card variant="outlined">
        <CardHeader
          title={title}
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
            cursor: headerClickable ? "pointer" : "default",
          }}
          slotProps={{
            title: {
              variant: "h6",
              component: "div",
              align: "left",
              gutterBottom: true,
              noWrap: true,
              sx: {
                fontWeight: 500,
                color: "text.third",
                lineHeight: 1.2,
                letterSpacing: 0.2,
              },
            },
          }}
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              {/* 之後如果要 onHide，這裡再加回去 */}
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
                      transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
                      transition: "transform 180ms ease",
                    }}
                  >
                    <ExpandMoreIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          }
        />

        {collapsible ? (
          <Collapse in={!collapsed} timeout={10} unmountOnExit>
            <CardContent sx={{ pt: 1 }}>{children}</CardContent>
          </Collapse>
        ) : (
          <CardContent sx={{ pt: 1 }}>{children}</CardContent>
        )}
      </Card>
    </Box>
  );
}
