// src/components/events/EventsPicker.tsx
import type { Event } from "../../../shared/models";
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

type LoadState = "idle" | "loading" | "ok" | "error";

export function EventsPicker(props: {
  mode: "upcoming" | "past";
  onModeChange: (m: "upcoming" | "past") => void;

  loadState: LoadState;
  error: string;
  events: Event[];

  /** 多選 */
  value: string[];
  onChange: (next: string[]) => void;

  /** primary event：給 graph debug / simulator 用（planner 仍用全部 events） */
  primaryValue: string;
  onPrimaryChange: (v: string) => void;
}) {
  const {
    mode,
    onModeChange,
    loadState,
    error,
    events,
    value,
    onChange,
    primaryValue,
    onPrimaryChange,
  } = props;

  const selectedSet = new Set(value);

  const selectedEvents = value
    .map((v) => events.find((e) => e.value === v))
    .filter(Boolean) as Event[];

  const renderValue = (selected: any) => {
    const arr = (selected as string[]) || [];
    if (!arr.length) return "（未選）";
    if (arr.length === 1) {
      const e = events.find((x) => x.value === arr[0]);
      return e ? `${e.name}` : arr[0];
    }
    return `已選 ${arr.length} 個 events`;
  };

  return (
    <Stack spacing={1.5}>
      {/* 選擇 upcoming / past (之後改成不指定) */}
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_, v) => v && onModeChange(v)}
        >
          <ToggleButton value="upcoming">upcoming</ToggleButton>
          <ToggleButton value="past">past</ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="body2" color="text.secondary">
          狀態：<b>{loadState}</b>，筆數：{events.length}
        </Typography>
      </Stack>

      {loadState === "loading" && <LinearProgress />}
      {loadState === "error" && (
        <Alert severity="error">events 錯誤：{error}</Alert>
      )}

      {/* 多選 Select */}
      <FormControl fullWidth size="small">
        <InputLabel id="event-multi-label">選擇卡池（多選）</InputLabel>
        <Select
          labelId="event-multi-label"
          multiple
          value={value}
          onChange={(e) => {
            const next = e.target.value as string[];
            onChange(next);
          }}
          input={<OutlinedInput label="選擇卡池（多選）" />}
          renderValue={renderValue}
          MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}
        >
          {events.map((ev) => {
            const checked = selectedSet.has(ev.value);
            return (
              <MenuItem key={ev.value} value={ev.value} dense>
                <Checkbox size="small" checked={checked} />
                <ListItemText
                  primary={ev.name}
                  // secondary={ev.value}
                  slotProps={{
                    primary: { noWrap: true, title: ev.name },
                    // secondary: { noWrap: true, title: ev.value },
                  }}
                />
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>

      {/* 顯示已選 chips（省事也好確認）*/}
      {!!value.length && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {selectedEvents.slice(0, 20).map((ev) => (
            <Chip
              key={ev.value}
              size="small"
              label={ev.name}
              onDelete={() => onChange(value.filter((v) => v !== ev.value))}
              // variant={ev.value === primaryValue ? "filled" : "outlined"}
              variant={"outlined"}
              // color={ev.value === primaryValue ? "primary" : "default"}
              color={"default"}
            />
          ))}
          {value.length > 20 && (
            <Chip
              size="small"
              label={`+${value.length - 20}`}
              variant="outlined"
            />
          )}
        </Box>
      )}

      {/* Primary event（多選時很重要） */}
      {/* {value.length >= 1 && (
        <FormControl size="small" sx={{ maxWidth: 520 }}>
          <InputLabel id="event-primary-label">
            主要 event（Graph/Simulator 用）
          </InputLabel>
          <Select
            labelId="event-primary-label"
            label="主要 event（Graph/Simulator 用）"
            value={primaryValue || ""}
            onChange={(e) => onPrimaryChange(String(e.target.value))}
          >
            {value.map((v) => {
              const ev = events.find((x) => x.value === v);
              return (
                <MenuItem key={v} value={v}>
                  {ev ? `${ev.name}` : v}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      )} */}

      <Typography variant="body2" color="text.secondary">
        Planner 會用「所有已選 events」一起規劃；Graph Debug / Simulator
        則用「主要 event」顯示。
      </Typography>
    </Stack>
  );
}
