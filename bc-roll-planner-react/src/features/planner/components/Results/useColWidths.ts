import { useMemo } from "react";
import { useMediaQuery, useTheme } from "@mui/material";
import type { ColW } from "./types";

export function useColWidths(): ColW {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const isSm = useMediaQuery(theme.breakpoints.between("sm", "md"));

  return useMemo(() => {
    // 你目前三段一樣；保留結構方便之後調
    if (isXs)
      return { count: 8, step: 10, action: 10, event: 40, A: 16, B: 16 };
    if (isSm)
      return { count: 8, step: 10, action: 10, event: 40, A: 16, B: 16 };
    return { count: 8, step: 10, action: 10, event: 40, A: 16, B: 16 };
  }, [isXs, isSm]);
}
