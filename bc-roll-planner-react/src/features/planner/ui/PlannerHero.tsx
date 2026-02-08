import PetsIcon from "@mui/icons-material/Pets";
import {
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DataSourceDisclaimerNote } from "@/shared/ui/DataSourceDisclaimerNote";

type LoadState = "idle" | "loading" | "ok" | "error";

function statusColor(ok: boolean): "success" | "default" {
  return ok ? "success" : "default";
}

export function PlannerHero(props: {
  hasSeedCount: boolean;
  selectedEventCount: number;
  targetCatCount: number;
  planState: LoadState;
  showTargetCatsButton: boolean;
  onOpenTargetCats: () => void;
}) {
  const {
    hasSeedCount,
    selectedEventCount,
    targetCatCount,
    planState,
    showTargetCatsButton,
    onOpenTargetCats,
  } = props;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 1.5, md: 2 },
        mb: 2,
        borderRadius: 2,
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>
            抽卡規劃器
          </Typography>
          <Typography variant="body2" color="text.secondary">
            先輸入 seed/count 與活動，再選目標貓，最後執行規劃。
          </Typography>
        </Box>

        {showTargetCatsButton && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<PetsIcon />}
            onClick={onOpenTargetCats}
          >
            目標貓 {targetCatCount}
          </Button>
        )}
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5, gap: 1 }}>
        <Chip
          size="small"
          label={hasSeedCount ? "Seed/Count 已設定" : "Seed/Count 未完成"}
          color={statusColor(hasSeedCount)}
          variant={hasSeedCount ? "filled" : "outlined"}
        />
        <Chip
          size="small"
          label={`活動 ${selectedEventCount} 個`}
          color={statusColor(selectedEventCount > 0)}
          variant={selectedEventCount > 0 ? "filled" : "outlined"}
        />
        <Chip
          size="small"
          label={`目標貓 ${targetCatCount} 隻`}
          color={statusColor(targetCatCount > 0)}
          variant={targetCatCount > 0 ? "filled" : "outlined"}
        />
        <Chip size="small" label={`規劃狀態 ${planState}`} variant="outlined" />
      </Stack>

      <Box sx={{ mt: 1.5 }}>
        <DataSourceDisclaimerNote compact />
      </Box>
    </Paper>
  );
}
