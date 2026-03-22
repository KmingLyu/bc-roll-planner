import { useMemo } from "react";
import { useMediaQuery, useTheme } from "@mui/material";
import type { ColW } from "./types";

export function useColWidths(): ColW {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const isSm = useMediaQuery(theme.breakpoints.between("sm", "md"));

  return useMemo(() => {
    if (isXs) return { action: 24, A: 38, B: 38 };
    if (isSm) return { action: 20, A: 40, B: 40 };
    return { action: 18, A: 41, B: 41 };
  }, [isXs, isSm]);
}
