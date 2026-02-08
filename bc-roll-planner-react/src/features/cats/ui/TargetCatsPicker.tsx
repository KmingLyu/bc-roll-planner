// src/features/cats/ui/TargetCatsPicker.tsx
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  // Checkbox,
  // FormControlLabel,
  LinearProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import type { TierGroup } from "@/features/cats/model/useEventCats";
import { CatSelectableItem } from "./CatSelectableItem";

type LoadState = "idle" | "loading" | "ok" | "error";

function tierLabel(tier: TierGroup["tier"]) {
  if (tier === "rare") return "Rare";
  if (tier === "super") return "Super";
  if (tier === "uber") return "Uber";
  return "Legendary";
}

export function TargetCatsPicker(props: {
  loadState: LoadState;
  error: string;
  groups: TierGroup[];

  selectedIds: number[];
  onChange: (next: number[]) => void;
  onClear: () => void;

  // 多欄 layout 控制（可調）
  minColWidth?: number; // 每個 item 最小寬度，越大欄越少
  dense?: boolean; // 更緊湊

  // 顯示圖片/連結
  getCatHref?: (catId: number) => string | undefined;
  getCatImageUrl?: (catId: number) => string | undefined;
  renderCatSecondary?: (catId: number) => React.ReactNode;
}) {
  const {
    loadState,
    error,
    groups,
    selectedIds,
    onChange,
    onClear,
    minColWidth = 220,
    dense = true,
    getCatHref,
    getCatImageUrl,
    renderCatSecondary,
  } = props;

  const selectedSet = new Set(selectedIds);

  function toggle(id: number, on: boolean) {
    if (on)
      onChange(selectedIds.includes(id) ? selectedIds : [...selectedIds, id]);
    else onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          狀態：<b>{loadState}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          已選：<b>{selectedIds.length}</b>
        </Typography>
        <Button
          variant="outlined"
          size="small"
          onClick={onClear}
          disabled={!selectedIds.length}
        >
          清空已選
        </Button>
      </Stack>

      {loadState === "loading" && <LinearProgress />}
      {loadState === "error" && (
        <Alert severity="error">eventCats 錯誤：{error}</Alert>
      )}

      {loadState === "ok" && (
        <Box>
          {/* <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            目前為「選到的所有 events 的貓咪聯集」。未來多選 events
            時，不用改這個元件。
          </Typography> */}

          <Stack spacing={1}>
            {groups.map((g) => (
              <Accordion
                key={g.tier}
                defaultExpanded={g.tier === "legendary" || g.tier === "uber"}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={800} variant="subtitle2">
                    {tierLabel(g.tier)}（{g.cats.length}）
                  </Typography>
                </AccordionSummary>

                <AccordionDetails sx={{ pt: 0 }}>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: `repeat(auto-fit, minmax(${minColWidth}px, 1fr))`,
                      gap: dense ? 0.5 : 1,
                      alignItems: "start",
                    }}
                  >
                    {g.cats.map((c) => {
                      const checked = selectedSet.has(c.id);

                      return (
                        <CatSelectableItem
                          key={c.id}
                          catId={c.id}
                          name={c.name}
                          checked={checked}
                          onToggle={(next) => toggle(c.id, next)}
                          imageUrl={getCatImageUrl?.(c.id)}
                          href={getCatHref?.(c.id)}
                          dense={dense}
                          secondary={
                            renderCatSecondary
                              ? renderCatSecondary(c.id)
                              : undefined
                          }
                        />
                      );
                    })}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}

            {!groups.length && (
              <Alert severity="warning">
                解析不到貓咪列表（eventCats 回傳可能為空）
              </Alert>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
