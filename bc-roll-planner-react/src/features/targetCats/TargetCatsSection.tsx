import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Typography,
} from "@mui/material";
import type { LoadState } from "../../ui/types";
import { SectionCard } from "../../ui/SectionCard";
import { LoadStateView } from "../../ui/LoadStateView";
import type { TierGroup } from "../../uiTypes/homeTypes";
import { tierLabel } from "../../uiTypes/homeTypes";

export type TargetCatsSectionProps = {
  loadState: LoadState;
  groups: TierGroup[];
  error: string;

  selectedIds: number[];
  onChangeSelected: (ids: number[]) => void;
  onClear: () => void;
};

export function TargetCatsSection({
  loadState,
  groups,
  error,
  selectedIds,
  onChangeSelected,
  onClear,
}: TargetCatsSectionProps) {
  return (
    <SectionCard
      title="1.5) Target Cats (eventCats)"
      action={
        <Button size="small" onClick={onClear} disabled={!selectedIds.length}>
          清空已選（{selectedIds.length}）
        </Button>
      }
    >
      <Box
        sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}
      >
        <Typography variant="body2">
          狀態：<b>{loadState}</b>
        </Typography>
        <Typography variant="body2">
          已選：<b>{selectedIds.length}</b>
        </Typography>
      </Box>

      <LoadStateView
        state={loadState}
        error={error}
        errorTitle="eventCats 錯誤"
      />

      {loadState === "ok" ? (
        <Box sx={{ mt: 2, display: "grid", gap: 2 }}>
          {groups.map((g) => (
            <Box
              key={g.tier}
              sx={{
                border: "1px solid #eee",
                borderRadius: 2,
                p: 1.5,
              }}
            >
              <Box sx={{ fontWeight: 700, mb: 1 }}>
                {tierLabel(g.tier)}（{g.cats.length}）
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: 0.5,
                }}
              >
                {g.cats.map((c) => {
                  const checked = selectedIds.includes(c.id);
                  return (
                    <FormControlLabel
                      key={c.id}
                      control={
                        <Checkbox
                          checked={checked}
                          onChange={(e) => {
                            const on = e.target.checked;
                            onChangeSelected(
                              on
                                ? [...selectedIds, c.id]
                                : selectedIds.filter((x) => x !== c.id)
                            );
                          }}
                        />
                      }
                      label={
                        <Box
                          sx={{
                            display: "flex",
                            gap: 1,
                            alignItems: "baseline",
                          }}
                        >
                          <span>{c.name}</span>
                          <span style={{ opacity: 0.65 }}>#{c.id}</span>
                        </Box>
                      }
                    />
                  );
                })}
              </Box>
            </Box>
          ))}

          {!groups.length ? (
            <Box sx={{ opacity: 0.75 }}>
              這個 event 解析不到貓咪列表（請檢查 eventCats 回傳的 source 是否為
              none）
            </Box>
          ) : null}
        </Box>
      ) : null}
    </SectionCard>
  );
}
