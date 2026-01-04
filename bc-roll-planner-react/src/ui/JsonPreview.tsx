import { Box, FormControlLabel, Switch } from "@mui/material";

function safeJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

type Props = {
  label?: string;
  show: boolean;
  onToggle: (v: boolean) => void;
  value: unknown;
  maxHeight?: number;
};

export function JsonPreview({
  label = "顯示 raw JSON",
  show,
  onToggle,
  value,
  maxHeight = 360,
}: Props) {
  return (
    <Box sx={{ mt: 1 }}>
      <FormControlLabel
        control={
          <Switch checked={show} onChange={(e) => onToggle(e.target.checked)} />
        }
        label={label}
      />
      {show ? (
        <pre
          style={{
            marginTop: 8,
            padding: 10,
            background: "#f7f7f7",
            overflow: "auto",
            borderRadius: 8,
            maxHeight,
          }}
        >
          {safeJson(value)}
        </pre>
      ) : null}
    </Box>
  );
}
