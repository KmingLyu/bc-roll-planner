import type { PropsWithChildren } from "react";
import { Box } from "@mui/material";

export default function MainLayout({ children }: PropsWithChildren) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
      }}
    >
      {children}
    </Box>
  );
}
