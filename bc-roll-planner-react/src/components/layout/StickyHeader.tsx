// src/components/layout/StickyHeader.tsx
import type { ReactNode } from "react";
import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";

/**
 * StickyHeader
 *
 * 把一段 UI 包成「黏在視窗頂部」的 header 區塊。
 * - 仍在正常排版流中（不會遮住內容），但捲動時會固定在頂部。
 * - 加了半透明背景 + blur + 底線，讓它像工具列。
 */
export function StickyHeader(props: {
  children: ReactNode;
  top?: number; // 需要避開全站 AppBar 的話可調整，例如 top={64}
  zIndexOffset?: number; // 需要更浮在上面可加
}) {
  const { children, top = 0, zIndexOffset = 0 } = props;

  return (
    <Box
      sx={(theme) => ({
        position: "sticky",
        top,
        zIndex: theme.zIndex.appBar + 1 + zIndexOffset,

        // 讓 sticky header 看起來像一層工具列
        bgcolor: alpha(theme.palette.background.paper, 0.92),
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",

        borderBottom: `1px solid ${theme.palette.divider}`,
        // borderRadius: 2,

        // 讓它跟內容有一點內距，不要貼太緊
        p: 2,

        // 視覺上稍微浮起來（可自行拿掉）
        boxShadow: theme.shadows[1],
      })}
    >
      {children}
    </Box>
  );
}
