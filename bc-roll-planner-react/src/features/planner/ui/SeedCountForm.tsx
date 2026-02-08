// src/features/planner/ui/SeedCountForm.tsx
import { useEffect, useMemo, useState } from "react";
import { Alert, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

export function SeedCountForm(props: {
  seedApplied: string;
  countApplied: number | null;
  onChange: (v: { seed: string; count: number | null }) => void;
}) {
  const { seedApplied, countApplied, onChange } = props;

  // Draft 用字串：可自然清空
  const [seedDraft, setSeedDraft] = useState<string>(seedApplied);
  const [countDraft, setCountDraft] = useState<string>(
    typeof countApplied === "number" ? String(countApplied) : ""
  );
  const [err, setErr] = useState<string>("");

  // 若父層值被外部改動（例如 reset），同步回 draft
  useEffect(() => {
    setSeedDraft(seedApplied);
  }, [seedApplied]);

  useEffect(() => {
    setCountDraft(typeof countApplied === "number" ? String(countApplied) : "");
  }, [countApplied]);

  // 解析/驗證：不合法也會產出「父層應該變成的值」（seed 可能為空、count 變 null）
  const parsed = useMemo(() => {
    const s = seedDraft.trim();
    const cRaw = countDraft.trim();

    // 要推回父層的值（不合法時也要推，才能 disable）
    const nextSeed = s;
    let nextCount: number | null = null;

    // 規則：只要 seed 或 count 任一為空 => 這裡不顯示錯誤
    // （但仍回傳 count=null，讓上層 hasSeedCount 變 false）
    if (!s || !cRaw) {
      return { seed: nextSeed, count: null, err: "" };
    }

    // 兩者都不空，才檢查數值合法性
    const n = Number(cRaw);
    if (!Number.isFinite(n) || n <= 0) {
      return { seed: nextSeed, count: null, err: "count 必須是正整數" };
    }

    nextCount = Math.floor(n);
    return { seed: nextSeed, count: nextCount, err: "" };
  }, [seedDraft, countDraft]);

  // 任何輸入變動都同步回父層（不合法就回傳 count=null / seed=""）
  useEffect(() => {
    setErr(parsed.err);

    const sameSeed = parsed.seed === seedApplied;
    const sameCount = parsed.count === countApplied;
    if (sameSeed && sameCount) return;

    onChange({ seed: parsed.seed, count: parsed.count });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.seed, parsed.count, parsed.err]);

  return (
    <Stack spacing={1.5}>
      {/* <Typography variant="body2" color="text.secondary">
        直接輸入即可生效；若 seed / count 不完整或不合法，規劃按鈕會自動停用。
      </Typography> */}

      <Grid container spacing={2} sx={{ width: "100%" }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="seed"
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            size="small"
            placeholder="例如 1234"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="count"
            type="number"
            value={countDraft}
            onChange={(e) => setCountDraft(e.target.value)}
            size="small"
            inputProps={{ min: 1 }}
            placeholder="例如 120"
          />
        </Grid>
      </Grid>

      {err && <Alert severity="error">{err}</Alert>}
    </Stack>
  );
}
