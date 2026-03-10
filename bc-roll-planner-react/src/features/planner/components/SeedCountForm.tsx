import { useEffect, useMemo, useState } from "react";
import { Alert, Stack, TextField, Typography } from "@mui/material";
import Grid from "@mui/material/Grid";

export type SeedCountFormValue = {
  seed: string;
  countInput: string;
  manualCount: number | null;
  countError: string;
};

export function SeedCountForm(props: {
  seedApplied: string;
  countInput: string;
  autoCount: number;
  onChange: (v: SeedCountFormValue) => void;
}) {
  const { seedApplied, countInput, autoCount, onChange } = props;

  // Draft 用字串：可自然清空
  const [seedDraft, setSeedDraft] = useState<string>(seedApplied);
  const [countDraft, setCountDraft] = useState<string>(countInput);
  const [err, setErr] = useState<string>("");

  // 若父層值被外部改動（例如 reset），同步回 draft
  useEffect(() => {
    setSeedDraft(seedApplied);
  }, [seedApplied]);

  useEffect(() => {
    setCountDraft(countInput);
  }, [countInput]);

  // 解析/驗證：count 可留空；不合法時仍同步回父層，讓外部能 disable run
  const parsed = useMemo(() => {
    const s = seedDraft.trim();
    const cRaw = countDraft.trim();

    if (!cRaw) {
      return {
        seed: s,
        countInput: countDraft,
        manualCount: null,
        countError: "",
      };
    }

    const n = Number(cRaw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return {
        seed: s,
        countInput: countDraft,
        manualCount: null,
        countError: "count 必須是正整數",
      };
    }

    return {
      seed: s,
      countInput: countDraft,
      manualCount: n,
      countError: "",
    };
  }, [seedDraft, countDraft]);

  // 任何輸入變動都同步回父層
  useEffect(() => {
    setErr(parsed.countError);

    const sameSeed = parsed.seed === seedApplied;
    const sameInput = parsed.countInput === countInput;
    if (sameSeed && sameInput) return;

    onChange(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    parsed.seed,
    parsed.countInput,
    parsed.manualCount,
    parsed.countError,
    seedApplied,
    countInput,
  ]);

  return (
    <Stack spacing={1.25}>
      <Grid container spacing={1.25} sx={{ width: "100%" }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="seed"
            type="number"
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            size="small"
            placeholder="例如 1234"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Stack spacing={0.75}>
            <TextField
              fullWidth
              label="count"
              type="number"
              value={countDraft}
              onChange={(e) => setCountDraft(e.target.value)}
              size="small"
              inputProps={{ min: 1, step: 1 }}
              placeholder="留空則自動依資源計算"
            />

            {!err && (
              <Typography variant="caption" color="text.secondary">
                {countDraft.trim()
                  ? `目前將使用手動 count：${parsed.manualCount ?? "-"}`
                  : `目前將使用自動搜尋上限：${autoCount}`}
              </Typography>
            )}
          </Stack>
        </Grid>
      </Grid>

      {err && <Alert severity="error">{err}</Alert>}
    </Stack>
  );
}
