import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { Event } from "../../../shared/models";
import type { LoadState } from "../../ui/types";
import { SectionCard } from "../../ui/SectionCard";
import { LoadStateView } from "../../ui/LoadStateView";

export type EventsSectionProps = {
  eventsType: "upcoming" | "past";
  loadState: LoadState;
  events: Event[];
  error: string;

  // 先用 array 存，為未來複選預留
  selectedEventValues: string[];
  onChangeType: (t: "upcoming" | "past") => void;
  onChangeSelected: (values: string[]) => void;

  onReload: () => void;
};

export function EventsSection({
  eventsType,
  loadState,
  events,
  error,
  selectedEventValues,
  onChangeType,
  onChangeSelected,
  onReload,
}: EventsSectionProps) {
  const selected = selectedEventValues[0] || "";

  return (
    <SectionCard
      title="1) Events"
      action={
        <Button size="small" onClick={onReload}>
          重新載入
        </Button>
      }
    >
      <Box
        sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={eventsType}
          onChange={(_, v) => v && onChangeType(v)}
        >
          <ToggleButton value="upcoming">upcoming</ToggleButton>
          <ToggleButton value="past">past</ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="body2">
          狀態：<b>{loadState}</b>
        </Typography>
        <Typography variant="body2">筆數：{events.length}</Typography>
      </Box>

      <LoadStateView state={loadState} error={error} errorTitle="events 錯誤" />

      <Box sx={{ mt: 2 }}>
        <FormControl fullWidth size="small">
          <InputLabel>選擇 event</InputLabel>
          <Select
            label="選擇 event"
            value={selected}
            onChange={(e) => onChangeSelected([String(e.target.value)])}
          >
            {events.map((ev) => (
              <MenuItem key={ev.value} value={ev.value}>
                {ev.value} — {ev.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* 未來複選：這裡可換成 MUI Autocomplete multiple / Select multiple */}
      </Box>
    </SectionCard>
  );
}
