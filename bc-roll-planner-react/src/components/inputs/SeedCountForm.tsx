// src/components/inputs/SeedCountForm.tsx
import { useEffect, useState } from "react";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

export function SeedCountForm(props: {
  seedApplied: string;
  countApplied: number | null;
  onApply: (v: { seed: string; count: number | null }) => void;
}) {
  const { seedApplied, countApplied, onApply } = props;

  // ✅ 用 string 才能自然支援清空欄位
  const [seedDraft, setSeedDraft] = useState<string>(seedApplied);
  const [countDraft, setCountDraft] = useState<string>(
    typeof countApplied === "number" ? String(countApplied) : ""
  );
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    setSeedDraft(seedApplied);
    setCountDraft(typeof countApplied === "number" ? String(countApplied) : "");
    setErr("");
  }, [seedApplied, countApplied]);

  function apply() {
    const s = seedDraft.trim();
    const cRaw = countDraft.trim();

    if (!s) return setErr("seed 不可為空");
    if (!cRaw) return setErr("count 不可為空");
    const c = Number(cRaw);
    if (!Number.isFinite(c) || c <= 0) return setErr("count 必須是正整數");

    setErr("");
    onApply({ seed: s, count: Math.floor(c) });
  }

  function resetToApplied() {
    setSeedDraft(seedApplied);
    setCountDraft(typeof countApplied === "number" ? String(countApplied) : "");
    setErr("");
  }

  function clearApplied() {
    setSeedDraft("");
    setCountDraft("");
    setErr("");
    onApply({ seed: "", count: null });
  }

  const appliedSeedText = seedApplied.trim() ? seedApplied : "-";
  const appliedCountText =
    typeof countApplied === "number" &&
    Number.isFinite(countApplied) &&
    countApplied > 0
      ? String(countApplied)
      : "-";

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        輸入不會觸發後續載入；只有按「套用」才會更新全域狀態（避免輸入卡頓）。
      </Typography>

      <Grid container spacing={2} sx={{ maxWidth: 640, width: "100%" }}>
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

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <Button variant="contained" onClick={apply}>
          套用（Apply）
        </Button>

        <Button variant="outlined" onClick={resetToApplied}>
          還原為已套用值
        </Button>

        <Button variant="text" color="warning" onClick={clearApplied}>
          清空已套用值
        </Button>

        <Typography variant="body2" color="text.secondary">
          目前套用：seed=<b>{appliedSeedText}</b>，count=
          <b>{appliedCountText}</b>
        </Typography>
      </Stack>

      {err && <Alert severity="error">{err}</Alert>}
    </Stack>
  );
}
