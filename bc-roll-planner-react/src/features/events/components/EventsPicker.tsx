import { useState } from "react";
import type { Event } from "@/types/models";
import { Drawer } from "@/components";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  InputAdornment,
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
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { getEventDisplayLines } from "@/utils/event-display";

type LoadState = "idle" | "loading" | "ok" | "error";
type EvKind = "upcoming" | "past";

function MobileEventLabel(props: { event: Event }) {
  const { event } = props;
  const { dateText, nameText, titleText } = getEventDisplayLines(event);

  return (
    <Box sx={{ minWidth: 0, flex: 1 }} title={titleText}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          lineHeight: 1.35,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {dateText}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          mt: 0.25,
          lineHeight: 1.35,
          fontWeight: 600,
          wordBreak: "break-word",
          display: "-webkit-box",
          overflow: "hidden",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
        }}
      >
        {nameText}
      </Typography>
    </Box>
  );
}

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

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectedSet = new Set(value);

  const findEvent = (v: string): Event | undefined =>
    upcomingEvents.find((e) => e.value === v) ??
    pastEvents.find((e) => e.value === v);

  const getKind = (v: string): EvKind | null => {
    if (upcomingEvents.some((e) => e.value === v)) return "upcoming";
    if (pastEvents.some((e) => e.value === v)) return "past";
    return null;
  };

  const clearAllEvents = () => {
    onChange([]);
    if (primaryValue) onPrimaryChange("");
  };

  const toggleEvent = (eventValue: string) => {
    if (selectedSet.has(eventValue)) {
      onChange(value.filter((v) => v !== eventValue));
      if (primaryValue === eventValue) onPrimaryChange("");
      return;
    }

    onChange([...value, eventValue]);
  };

  const selectedEvents = value
    .map((v) => findEvent(v))
    .filter(Boolean) as Event[];

  const renderSummary = (selected: string[]) => {
    if (!selected.length) return "（未選）";
    if (selected.length === 1) {
      const e = findEvent(selected[0]);
      return e ? e.name : selected[0];
    }
    return `已選 ${selected.length} 個 events`;
  };

  const renderMenuItem = (ev: Event, kind: EvKind) => {
    const checked = selectedSet.has(ev.value);
    const { dateText, nameText, titleText } = getEventDisplayLines(ev);

    return (
      <MenuItem key={ev.value} value={ev.value} dense>
        <Checkbox size="small" checked={checked} />
        <ListItemText
          primary={dateText}
          secondary={nameText}
          slotProps={{
            primary: {
              noWrap: true,
              title: titleText,
              color: "text.secondary",
              variant: "body2",
            },
            secondary: {
              title: titleText,
              color: "text.primary",
              variant: "body2",
              sx: {
                mt: 0.25,
                fontWeight: 600,
                lineHeight: 1.35,
                display: "-webkit-box",
                overflow: "hidden",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
              },
            },
          }}
          sx={{ mr: 1, my: 0.25 }}
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

  const renderMobileItem = (ev: Event, kind: EvKind) => {
    const checked = selectedSet.has(ev.value);

    return (
      <Box
        key={ev.value}
        role="button"
        tabIndex={0}
        onClick={() => toggleEvent(ev.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleEvent(ev.value);
          }
        }}
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          px: 2,
          py: 1.25,
          borderTop: "1px solid",
          borderColor: "divider",
          cursor: "pointer",
          backgroundColor: checked ? "action.selected" : "transparent",
        }}
      >
        <Checkbox
          checked={checked}
          tabIndex={-1}
          sx={{ mt: -0.35, ml: -0.5 }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onChange={() => toggleEvent(ev.value)}
        />

        <MobileEventLabel event={ev} />

        <Chip
          size="small"
          variant="outlined"
          label={kind === "upcoming" ? "Upcoming" : "Past"}
          sx={{ mt: 0.25, flexShrink: 0 }}
        />
      </Box>
    );
  };

  const renderMobileSection = (
    title: string,
    events: Event[],
    kind: EvKind,
    emptyText: string,
  ) => (
    <Box>
      <Box
        sx={{
          px: 2,
          py: 1.1,
          backgroundColor: "background.paper",
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="subtitle2" fontWeight={800}>
          {title}（{events.length}）
        </Typography>
      </Box>

      {events.length ? (
        events.map((ev) => renderMobileItem(ev, kind))
      ) : (
        <Box
          sx={{
            px: 2,
            py: 2,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {emptyText}
          </Typography>
        </Box>
      )}
    </Box>
  );

  return (
    <Stack spacing={1.25}>
      {loadState === "loading" && <LinearProgress />}
      {loadState === "error" && (
        <Alert severity="error">events 錯誤：{error}</Alert>
      )}

      {isMobile ? (
        <>
          <FormControl fullWidth size="small">
            <InputLabel shrink htmlFor="event-mobile-trigger">
              選擇卡池（多選）
            </InputLabel>
            <OutlinedInput
              id="event-mobile-trigger"
              notched
              readOnly
              label="選擇卡池（多選）"
              value={renderSummary(value)}
              onClick={() => setMobileOpen(true)}
              endAdornment={
                <InputAdornment position="end">
                  <ExpandMoreIcon color="action" />
                </InputAdornment>
              }
              sx={{
                cursor: "pointer",
                "& input": {
                  cursor: "pointer",
                  textOverflow: "ellipsis",
                },
              }}
            />
          </FormControl>

          <Drawer
            title="選擇卡池"
            headerRight={
              value.length ? (
                <Button
                  size="small"
                  color="inherit"
                  onClick={clearAllEvents}
                  sx={{ fontWeight: 700 }}
                >
                  清空全部
                </Button>
              ) : undefined
            }
            open={mobileOpen}
            onRequestClose={() => setMobileOpen(false)}
            onClose={() => setMobileOpen(false)}
            closeAriaLabel="關閉卡池選單"
            anchor="bottom"
            width="100%"
            paperSx={{
              width: "100%",
              maxHeight: "82vh",
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              p: 0,
            }}
            headerSx={{
              px: 2,
              pt: 1.2,
              pb: 0.8,
              position: "sticky",
              top: 0,
              zIndex: 1,
              backgroundColor: "background.paper",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
            bodySx={{ pt: 0, pb: 1.25 }}
          >
            <Stack spacing={0}>
              {renderMobileSection(
                "Upcoming",
                upcomingEvents,
                "upcoming",
                "（沒有 upcoming events）",
              )}
              <Divider />
              {renderMobileSection(
                "Past",
                pastEvents,
                "past",
                "（沒有 past events）",
              )}
            </Stack>
          </Drawer>
        </>
      ) : (
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
            renderValue={(selected) =>
              renderSummary((selected as string[]) || [])
            }
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
      )}

      {!!value.length && (
        <Stack spacing={0.75}>
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button size="small" onClick={clearAllEvents} sx={{ fontWeight: 700 }}>
              清空所有 event
            </Button>
          </Box>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {selectedEvents.slice(0, 20).map((ev) => {
              const kind = getKind(ev.value);
              const suffix = kind === "past" ? "（Past）" : "";
              const { dateText, nameText, titleText } = getEventDisplayLines(ev);
              const displayName = `${nameText}${suffix}`;
              return (
                <Chip
                  key={ev.value}
                  size="small"
                  label={
                    <Box sx={{ py: 0.25 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", lineHeight: 1.2 }}
                      >
                        {dateText}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: "block", lineHeight: 1.25, fontWeight: 600 }}
                      >
                        {displayName}
                      </Typography>
                    </Box>
                  }
                  onDelete={() =>
                    onChange(value.filter((v) => v !== ev.value))
                  }
                  variant="outlined"
                  color="default"
                  title={titleText}
                  sx={{
                    height: "auto",
                    alignItems: "flex-start",
                    "& .MuiChip-label": {
                      display: "block",
                      whiteSpace: "normal",
                      py: 0.5,
                    },
                  }}
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
        </Stack>
      )}
    </Stack>
  );
}
