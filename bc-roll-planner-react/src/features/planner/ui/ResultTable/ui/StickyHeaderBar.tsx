import { Box, FormControlLabel, Stack, Switch } from "@mui/material";
import { STATUS_STYLE } from "../../planViewModel";
import { APP_THEME_TOKENS } from "@/app/theme/tokens";

function ToggleSwitch(props: {
  label: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
}) {
  const { label, checked, onToggle } = props;
  return (
    <FormControlLabel
      sx={{
        m: 0,
        mr: 0.75,
        "& .MuiFormControlLabel-label": {
          fontSize: 13,
          fontWeight: 600,
          color: "text.secondary",
          whiteSpace: "nowrap",
        },
      }}
      control={
        <Switch
          size="small"
          checked={checked}
          onChange={(_, next) => onToggle(next)}
        />
      }
      label={label}
    />
  );
}

function LegendTag(props: { label: string; sx?: object }) {
  const { label, sx } = props;
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 0.9,
        py: 0.35,
        borderRadius: 999,
        border: "1px solid",
        borderColor: "divider",
        fontSize: 12,
        fontWeight: 700,
        color: "text.secondary",
        ...sx,
      }}
    >
      {label}
    </Box>
  );
}

export function StickyHeaderBar(props: {
  title?: string;
  rowsCount?: number;
  stepsCount?: number;

  showLegend: boolean;
  onToggleLegend: (v: boolean) => void;

  showTargetsOnly: boolean;
  onToggleTargetsOnly: (v: boolean) => void;

  showTargetDrawsOnly: boolean;
  onToggleTargetDrawsOnly: (v: boolean) => void;
}) {
  const {
    title,
    rowsCount = 0,
    stepsCount = 0,
    showLegend,
    onToggleLegend,
    showTargetsOnly,
    onToggleTargetsOnly,
    showTargetDrawsOnly,
    onToggleTargetDrawsOnly,
  } = props;

  return (
    <Box
      sx={{
        backgroundColor: "transparent",
        borderBottom: "1px solid",
        borderColor: "divider",
        py: 0.9,
        px: { xs: 0.5, sm: 0.75 },
      }}
    >
      <Stack spacing={0.75}>
        {/* <Stack
          direction="row"
          spacing={1}
          alignItems="baseline"
          justifyContent={title ? "space-between" : "flex-end"}
        >
          {title ? <Typography fontWeight={800}>{title}</Typography> : null}
          <Typography variant="caption" color="text.secondary" noWrap>
            {stepsCount} steps / {rowsCount} rows
          </Typography>
        </Stack> */}

        <Box
          sx={{
            display: "flex",
            gap: 0.75,
            overflowX: "auto",
            whiteSpace: "nowrap",
            pb: 0.25,
            "&::-webkit-scrollbar": { display: "none" },
            scrollbarWidth: "none",
          }}
        >
          {/* <ToggleChip
            label="圖例"
            checked={showLegend}
            onToggle={onToggleLegend}
          /> */}
          <ToggleSwitch
            label="只看目標步驟"
            checked={showTargetsOnly}
            onToggle={onToggleTargetsOnly}
          />
          <ToggleSwitch
            label="10連只看目標"
            checked={showTargetDrawsOnly}
            onToggle={onToggleTargetDrawsOnly}
          />
        </Box>

        {showLegend && (
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <LegendTag label="抽中" sx={{ bgcolor: STATUS_STYLE.hit.bg }} />
            <LegendTag
              label="目標"
              sx={{
                bgcolor: "action.hover",
                borderWidth: 2,
                borderColor: APP_THEME_TOKENS.planner.target.borderSoft,
              }}
            />
            <LegendTag
              label="保底"
              sx={{ bgcolor: STATUS_STYLE.guaranteed.bg }}
            />
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
