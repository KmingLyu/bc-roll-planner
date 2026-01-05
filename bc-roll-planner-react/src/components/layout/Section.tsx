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
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export function Section(props: {
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide?: () => void;
  children: ReactNode;
}) {
  const { title, collapsed, onToggleCollapsed, onHide, children } = props;

  return (
    <Card variant="outlined">
      <CardHeader
        title={title}
        slotProps={{
          title: {
            variant: "h6", // h4/h5/h6/subtitle1/subtitle2/body1...
            component: "div", // 渲染成什麼 tag
            align: "left", // left/center/right/justify
            gutterBottom: true, // 下面留一點距離
            noWrap: true, // 單行省略
            sx: {
              fontWeight: 600,
              color: "text.third", // 或 "text.secondary"
              lineHeight: 1.2,
              letterSpacing: 0.2,
              mb: 0, // margin bottom
            },
          },
        }}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            {/* {onHide && (
              <Tooltip title="隱藏此區塊">
                <IconButton onClick={onHide} size="small">
                  <VisibilityOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )} */}
            <Tooltip title={collapsed ? "展開" : "收合"}>
              <IconButton
                onClick={onToggleCollapsed}
                size="small"
                sx={{
                  transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
                  transition: "transform 180ms ease",
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />
      <Collapse in={!collapsed} timeout="auto" unmountOnExit>
        <CardContent sx={{ pt: 0 }}>{children}</CardContent>
      </Collapse>
    </Card>
  );
}
