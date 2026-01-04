// src/components/cats/TargetCatsPicker.tsx
import type { TierGroup } from "../../hooks/useEventCats";
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

  // ✅ 多欄 layout 控制（可調）
  minColWidth?: number; // 每個 item 最小寬度，越大欄越少
  dense?: boolean; // 更緊湊

  // ✅ 預留：未來顯示圖片/連結
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            目前為「選到的所有 events 的貓咪聯集」。未來多選 events
            時，不用改這個元件。
          </Typography>

          <Stack spacing={1}>
            {groups.map((g) => (
              <Accordion
                key={g.tier}
                defaultExpanded={g.tier === "legendary" || g.tier === "uber"}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={800}>
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
                      const href = getCatHref?.(c.id);
                      const img = getCatImageUrl?.(c.id);

                      return (
                        <Box
                          key={c.id}
                          role="checkbox"
                          aria-checked={checked}
                          tabIndex={0}
                          onClick={() => toggle(c.id, !checked)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggle(c.id, !checked);
                            }
                          }}
                          sx={{
                            // border: "0.1px dashed",
                            // borderColor: checked ? "primary.main" : "divider",
                            borderRadius: 2,

                            // 選到就整格變藍（按鈕按下去的感覺）
                            bgcolor: checked ? "primary.main" : "transparent",
                            color: checked
                              ? "primary.contrastText"
                              : "text.primary",

                            cursor: "pointer",
                            userSelect: "none",
                            px: dense ? 1 : 1.25,
                            py: dense ? 0.25 : 0.75,
                            minHeight: dense ? 44 : 56,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            transition:
                              "background-color .2s ease, border-color .2s ease, transform .16s ease",
                            "&:hover": {
                              bgcolor: checked
                                ? "primary.dark"
                                : "action.hover",
                              borderColor: checked
                                ? "primary.dark"
                                : "text.secondary",
                            },
                            "&:active": {
                              transform: "translateY(2px)",
                            },
                            "&:focus-visible": {
                              outline: "2px solid",
                              outlineColor: checked
                                ? "primary.contrastText"
                                : "primary.main",
                              outlineOffset: 2,
                            },
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={3}
                            alignItems="center"
                            sx={{ width: "100%", minWidth: 0 }}
                          >
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                // 沒圖時也跟著反白好看
                                bgcolor: checked
                                  ? "rgba(255,255,255,0.2)"
                                  : "action.selected",
                                color: checked
                                  ? "primary.contrastText"
                                  : "text.primary",
                              }}
                              src={img}
                              variant="rounded"
                            >
                              {c.name?.[0] ?? "?"}
                            </Avatar>

                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography
                                variant="body2"
                                noWrap
                                title={c.name}
                                sx={{ fontWeight: 600 }}
                              >
                                {href ? (
                                  <Link
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                    underline="hover"
                                    color="inherit"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {c.name}
                                  </Link>
                                ) : (
                                  c.name
                                )}
                              </Typography>

                              <Typography
                                variant="caption"
                                sx={{
                                  color: checked
                                    ? "rgba(255,255,255,0.85)"
                                    : "text.secondary",
                                }}
                              >
                                #{c.id}
                              </Typography>
                            </Box>

                            {/* ✅ 移除打勾提示：不要 icon / 不要預留空位 */}

                            {renderCatSecondary ? (
                              <Box
                                sx={{ flexShrink: 0 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {renderCatSecondary(c.id)}
                              </Box>
                            ) : null}
                          </Stack>
                        </Box>
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
