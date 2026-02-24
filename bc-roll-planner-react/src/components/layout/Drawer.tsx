import type { ReactNode } from "react";
import type { DrawerProps as MuiDrawerProps } from "@mui/material/Drawer";
import type { SxProps, Theme } from "@mui/material/styles";
import { Box, Drawer as MuiDrawer } from "@mui/material";
import { PanelShellHeader } from "./PanelShellHeader";

export type DrawerProps = {
  title: ReactNode;
  children: ReactNode;
  open: boolean;
  onRequestClose: () => void;
  headerRight?: ReactNode;
  onClose?: () => void;
  closeAriaLabel?: string;
  anchor?: MuiDrawerProps["anchor"];
  width?: number | string;
  keepMounted?: boolean;
  paperSx?: SxProps<Theme>;
  sx?: SxProps<Theme>;
  headerSx?: SxProps<Theme>;
  bodySx?: SxProps<Theme>;
};

export function Drawer(props: DrawerProps) {
  const {
    title,
    children,
    open,
    onRequestClose,
    headerRight,
    onClose,
    closeAriaLabel,
    anchor = "right",
    width = "min(92vw, 380px)",
    keepMounted = true,
    paperSx,
    sx,
    headerSx,
    bodySx,
  } = props;

  const handleClose = onClose ?? onRequestClose;

  return (
    <MuiDrawer
      anchor={anchor}
      open={open}
      onClose={onRequestClose}
      ModalProps={{ keepMounted }}
      PaperProps={{
        sx: {
          width,
          p: 1,
          ...paperSx,
        },
      }}
    >
      <Box
        sx={{
          height: "100%",
          minHeight: 0,
          overflowY: "auto",
          ...sx,
        }}
      >
        <PanelShellHeader
          title={title}
          headerRight={headerRight}
          onClose={handleClose}
          closeAriaLabel={closeAriaLabel}
          sx={{
            py: 0.4,
            ...headerSx,
          }}
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
    </MuiDrawer>
  );
}
