import { Box, Button, Typography } from "@mui/material";
import { SectionCard } from "../../ui/SectionCard";

export type SimulatorSectionProps = {
  disabled: boolean;

  cursorId: string;
  prevCatId: number | null;
  recordsCount: number;
  text: string;

  onSingle: () => void;
  onTen: () => void;
  onReset: () => void;
};

export function SimulatorSection({
  disabled,
  cursorId,
  prevCatId,
  recordsCount,
  text,
  onSingle,
  onTen,
  onReset,
}: SimulatorSectionProps) {
  return (
    <SectionCard title="3) Simulator">
      <Box
        sx={{
          display: "flex",
          gap: 1.2,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Button variant="contained" onClick={onSingle} disabled={disabled}>
          單抽一次
        </Button>
        <Button variant="contained" onClick={onTen} disabled={disabled}>
          十連一次
        </Button>
        <Button variant="outlined" onClick={onReset}>
          重設（回到 1A）
        </Button>

        <Typography variant="body2">
          cursor：<b>{cursorId}</b>
        </Typography>
        <Typography variant="body2">
          prevCatId：<b>{prevCatId ?? "-"}</b>
        </Typography>
        <Typography variant="body2">
          records：<b>{recordsCount}</b>
        </Typography>
      </Box>

      {text ? (
        <pre
          style={{
            marginTop: 12,
            padding: 10,
            background: "#f7f7f7",
            overflow: "auto",
            borderRadius: 8,
          }}
        >
          {text}
        </pre>
      ) : null}
    </SectionCard>
  );
}
