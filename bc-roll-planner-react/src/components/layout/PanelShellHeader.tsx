import type { ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";
import { Box, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export type PanelShellHeaderProps = {
  title: ReactNode;
  headerRight?: ReactNode;
  onClose?: () => void;
  closeAriaLabel?: string;
  sx?: SxProps<Theme>;
};

export function PanelShellHeader(props: PanelShellHeaderProps) {
  const { title, headerRight, onClose, closeAriaLabel = "Close panel", sx } = props;

  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1}
      sx={{ width: "100%", minWidth: 0, ...sx }}
    >
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
          flex: 1,
        }}
      >
        {title}
      </Typography>

      {(headerRight || onClose) && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          sx={{ flex: "0 0 auto" }}
        >
          {headerRight && (
            <Box onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {headerRight}
            </Box>
          )}

          {onClose && (
            <IconButton
              size="medium"
              aria-label={closeAriaLabel}
              onClick={onClose}
              sx={{ flex: "0 0 auto" }}
            >
              <CloseIcon fontSize="large" />
            </IconButton>
          )}
        </Stack>
      )}
    </Stack>
  );
}
