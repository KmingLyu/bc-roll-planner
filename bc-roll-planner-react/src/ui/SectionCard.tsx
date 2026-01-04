import { Card, CardContent, CardHeader } from "@mui/material";
import type { ReactNode } from "react";

type Props = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  sx?: any;
};

export function SectionCard({ title, action, children, sx }: Props) {
  return (
    <Card variant="outlined" sx={{ mb: 2, ...sx }}>
      <CardHeader title={title} action={action} sx={{ pb: 0.5 }} />
      <CardContent>{children}</CardContent>
    </Card>
  );
}
