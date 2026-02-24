import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import { Box } from "@mui/material";
import { PanelShellHeader } from "./PanelShellHeader";

export type SidebarProps = {
  title: ReactNode;
  children: ReactNode;
  headerRight?: ReactNode;
  onClose?: () => void;
  closeAriaLabel?: string;
  stickyTop?: number;
  maxHeightOffset?: number;
  sx?: SxProps<Theme>;
  headerSx?: SxProps<Theme>;
  bodySx?: SxProps<Theme>;
};

export function Sidebar(props: SidebarProps) {
  const {
    title,
    children,
    headerRight,
    onClose,
    closeAriaLabel,
    stickyTop = 12,
    maxHeightOffset = 24,
    sx,
    headerSx,
    bodySx,
  } = props;

  return (
    <Box
      sx={{
        position: "sticky",
        top: stickyTop,
        maxHeight: `calc(100vh - ${maxHeightOffset}px)`,
        overflowY: "auto",
      }}
    >
      <Box
        sx={{
          width: "100%",
          minWidth: 0,
          px: { xs: 1.25, sm: 1.5 },
          py: { xs: 1, sm: 1.25 },
          borderRadius: 1.75,
          border: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)",
          ...sx,
        }}
      >
        <PanelShellHeader
          title={title}
          // headerRight={headerRight}
          // onClose={onClose}
          // closeAriaLabel={closeAriaLabel}
          // sx={{
          //   py: 0.4,
          //   ...headerSx,
          // }}
        />

        <Box
          sx={{
            pt: 0.9,
            width: "100%",
            minWidth: 0,
            ...bodySx,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
