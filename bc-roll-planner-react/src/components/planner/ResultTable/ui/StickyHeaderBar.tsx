import {
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { STATUS_STYLE, TARGET_BORDER_STYLE } from "../../planViewModel";

export function StickyHeaderBar(props: {
  title: string;

  showLegend: boolean;
  onToggleLegend: (v: boolean) => void;

  showTargetsOnly: boolean;
  onToggleTargetsOnly: (v: boolean) => void;

  showTargetDrawsOnly: boolean;
  onToggleTargetDrawsOnly: (v: boolean) => void;
}) {
  const {
    title,
    showLegend,
    onToggleLegend,
    showTargetsOnly,
    onToggleTargetsOnly,
    showTargetDrawsOnly,
    onToggleTargetDrawsOnly,
  } = props;

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      alignItems={{ xs: "flex-start", sm: "center" }}
      justifyContent="space-between"
      sx={(theme) => ({
        position: "sticky",
        top: 0,
        zIndex: theme.zIndex.appBar + 1,
        bgcolor: theme.palette.background.paper,
        backdropFilter: "blur(10px)",
        py: 1,
        px: 2,
        borderTopLeftRadius: theme.shape.borderRadius,
        borderTopRightRadius: theme.shape.borderRadius,
        boxShadow: theme.shadows[1],
      })}
    >
      <Typography fontWeight={900}>{title}</Typography>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        {showLegend && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label="抽中"
              sx={{ bgcolor: STATUS_STYLE.hit.bg }}
            />
            <Chip
              size="small"
              label="目標"
              sx={{ bgcolor: "action.hover", ...TARGET_BORDER_STYLE }}
            />
            <Chip
              size="small"
              label="保底"
              sx={{ bgcolor: STATUS_STYLE.guaranteed.bg }}
            />
          </Stack>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={showLegend}
              onChange={(e) => onToggleLegend(e.target.checked)}
            />
          }
          label={<Typography variant="body2">圖例</Typography>}
        />

        <FormControlLabel
          control={
            <Switch
              checked={showTargetsOnly}
              onChange={(e) => onToggleTargetsOnly(e.target.checked)}
            />
          }
          label={<Typography variant="body2">只看目標步驟</Typography>}
        />

        <FormControlLabel
          control={
            <Switch
              checked={showTargetDrawsOnly}
              onChange={(e) => onToggleTargetDrawsOnly(e.target.checked)}
            />
          }
          label={<Typography variant="body2">10連展開只看目標</Typography>}
        />
      </Stack>
    </Stack>
  );
}
