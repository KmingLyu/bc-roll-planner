// src/components/events/EventsPicker.tsx
import type { Event } from "../../../shared/models";
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  ListItemText,
  ListSubheader,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Typography,
} from "@mui/material";

type LoadState = "idle" | "loading" | "ok" | "error";
type EvKind = "upcoming" | "past";

export function EventsPicker(props: {
  loadState: LoadState;
  error: string;

  upcomingEvents: Event[];
  pastEvents: Event[];

  /** 多選 */
  value: string[];
  onChange: (next: string[]) => void;

  /** primary event：給 graph debug / simulator 用（planner 仍用全部 events） */
  primaryValue: string;
  onPrimaryChange: (v: string) => void;
}) {
  const {
    loadState,
    error,
    upcomingEvents,
    pastEvents,
    value,
    onChange,
    primaryValue,
    onPrimaryChange,
  } = props;

  const selectedSet = new Set(value);

  const findEvent = (v: string): Event | undefined =>
    upcomingEvents.find((e) => e.value === v) ??
    pastEvents.find((e) => e.value === v);

  const getKind = (v: string): EvKind | null => {
    if (upcomingEvents.some((e) => e.value === v)) return "upcoming";
    if (pastEvents.some((e) => e.value === v)) return "past";
    return null;
  };

  const selectedEvents = value
    .map((v) => findEvent(v))
    .filter(Boolean) as Event[];

  const renderValue = (selected: any) => {
    const arr = (selected as string[]) || [];
    if (!arr.length) return "（未選）";
    if (arr.length === 1) {
      const e = findEvent(arr[0]);
      return e ? `${e.name}` : arr[0];
    }
    return `已選 ${arr.length} 個 events`;
  };

  const renderMenuItem = (ev: Event, kind: EvKind) => {
    const checked = selectedSet.has(ev.value);

    return (
      <MenuItem key={ev.value} value={ev.value} dense>
        <Checkbox size="small" checked={checked} />
        <ListItemText
          primary={ev.name}
          slotProps={{
            primary: { noWrap: true, title: ev.name },
          }}
          sx={{ mr: 1 }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={kind === "upcoming" ? "Upcoming" : "Past"}
          sx={{ flexShrink: 0 }}
        />
      </MenuItem>
    );
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <Typography variant="body2" color="text.secondary">
          狀態：<b>{loadState}</b>
          ，Upcoming：{upcomingEvents.length}
          ，Past：{pastEvents.length}
        </Typography>
      </Stack>

      {loadState === "loading" && <LinearProgress />}
      {loadState === "error" && (
        <Alert severity="error">events 錯誤：{error}</Alert>
      )}

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
          MenuProps={{ PaperProps: { sx: { maxHeight: 520 } } }}
        >
          <ListSubheader disableSticky>
            Upcoming（{upcomingEvents.length}）
          </ListSubheader>

          {upcomingEvents.length ? (
            upcomingEvents.map((ev) => renderMenuItem(ev, "upcoming"))
          ) : (
            <MenuItem disabled dense>
              <ListItemText primary="（沒有 upcoming events）" />
            </MenuItem>
          )}

          <Divider sx={{ my: 0.5 }} />

          <ListSubheader disableSticky>
            Past（{pastEvents.length}）
          </ListSubheader>

          {pastEvents.length ? (
            pastEvents.map((ev) => renderMenuItem(ev, "past"))
          ) : (
            <MenuItem disabled dense>
              <ListItemText primary="（沒有 past events）" />
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {!!value.length && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {selectedEvents.slice(0, 20).map((ev) => {
            const kind = getKind(ev.value);
            const suffix = kind === "past" ? "（Past）" : "";
            return (
              <Chip
                key={ev.value}
                size="small"
                label={`${ev.name}${suffix}`}
                onDelete={() => onChange(value.filter((v) => v !== ev.value))}
                variant="outlined"
                color="default"
              />
            );
          })}
          {value.length > 20 && (
            <Chip
              size="small"
              label={`+${value.length - 20}`}
              variant="outlined"
            />
          )}
        </Box>
      )}

      <Typography variant="body2" color="text.secondary">
        Planner 會用「所有已選 events」一起規劃；Graph Debug / Simulator
        則用「主要 event」顯示。
      </Typography>
    </Stack>
  );
}
